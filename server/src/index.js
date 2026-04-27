const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const dotenv = require("dotenv");
const cron = require("node-cron");
const admin = require("firebase-admin");
const browseCategoriesList = require("./browseCategoriesData");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const CHEAPSHARK_BASE_URL =
  process.env.CHEAPSHARK_BASE_URL || "https://www.cheapshark.com/api/1.0";
/** CheapShark yanitlari — varsayilan 24 saat (429 riskini azaltir). .env: CACHE_TTL_SECONDS */
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 86400);
/** Upstream istekleri arasinda minimum bekleme (ms). */
const UPSTREAM_MIN_INTERVAL_MS = Number(process.env.UPSTREAM_MIN_INTERVAL_MS || 450);
/** 429 Retry-After saniye cok buyukse (or. 3600) warm-up/event loop kilitlenmesin. */
const MAX_RETRY_AFTER_MS = Number(process.env.MAX_RETRY_AFTER_MS || 8_000);
/** `0` = kullanici API isteklerinde CheapShark'a gitme; sadece bellek/disk. Doldurma: warmup veya CHEAPSHARK_DAILY_REFRESH_CRON. */
const CHEAPSHARK_UPSTREAM_ENABLED =
  String(process.env.CHEAPSHARK_UPSTREAM_ENABLED ?? "1").trim() !== "0";
/** `0` = TTL dolunca bile arka planda upstream tazeleme yok. */
const CHEAPSHARK_BACKGROUND_REFRESH =
  String(process.env.CHEAPSHARK_BACKGROUND_REFRESH ?? "1").trim() !== "0";
/** Bos degilse or. `0 4 * * *` — CheapShark toplu warm (upstream zorunlu); UPSTREAM_ENABLED=0 ile uyumlu. */
const CHEAPSHARK_DAILY_REFRESH_CRON = String(process.env.CHEAPSHARK_DAILY_REFRESH_CRON || "").trim();
/** Takip fiyat kontrolu — varsayilan gunde bir (09:00). .env: PRICE_CHECK_CRON */
const PRICE_CHECK_CRON = process.env.PRICE_CHECK_CRON || "0 9 * * *";
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";
/** Konferans / demo: POST /api/admin/warmup-cheapshark icin zorunlu (bos ise endpoint kapali). */
const WARMUP_SECRET = String(process.env.WARMUP_SECRET || "").trim();
const WARMUP_MAX_GAME_IDS = Math.min(
  80,
  Math.max(0, Number(process.env.WARMUP_MAX_GAME_IDS || 24))
);
const WARMUP_SEARCH_TITLES = String(process.env.WARMUP_SEARCH_TITLES || "elden,portal,gta")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .slice(0, 8);

const dataDir = path.join(__dirname, "..", "data");
const usersFile = path.join(dataDir, "users.json");
const devicesFile = path.join(dataDir, "devices.json");
const watchlistFile = path.join(dataDir, "watchlist.json");

const cache = new Map();
/** Son basarili /deals yanitlari (anahtar -> dizi); tam anahtar yoksa turune gore yedek. */
const dealsSnapshotByKey = new Map();
let lastGoodStores = null;
let lastUpstreamAt = 0;
let pushEnabled = false;
/** Stale dondurulduktan sonra upstream deneme araligi (ms). */
const backgroundRefreshAt = new Map();
const UPSTREAM_BACKGROUND_REFRESH_MS = 90_000;

/** Sunucu yeniden baslayinca 429 oncesi son CheapShark yanitlari */
const CHEAPSHARK_STALE_DISK = path.join(dataDir, "cheapshark_upstream_stale.json");
let persistStaleTimer = null;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again in a minute." },
});

app.use("/api", apiLimiter);

function initFirebaseAdmin() {
  if (!FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.log("Push disabled: FIREBASE_SERVICE_ACCOUNT_PATH is not set.");
    return;
  }
  try {
    const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    pushEnabled = true;
    console.log("Firebase Admin initialized. Push notifications enabled.");
  } catch (error) {
    pushEnabled = false;
    console.log(`Push disabled: Firebase init failed (${error.message}).`);
  }
}

function normalizeQueryForCache(query) {
  if (!query || typeof query !== "object") return {};
  const out = {};
  for (const [rawKey, rawVal] of Object.entries(query)) {
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;
    const key = String(rawKey);
    let val = rawVal;
    if (Array.isArray(val)) val = val[val.length - 1];
    out[key] = String(val);
  }
  return out;
}

function buildCacheKey(routePath, query) {
  const sortedEntries = Object.entries(normalizeQueryForCache(query)).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `${routePath}:${JSON.stringify(sortedEntries)}`;
}

function migrateLegacyCacheKey(legacyKey) {
  const idx = legacyKey.indexOf(":");
  if (idx < 0) return legacyKey;
  const routePath = legacyKey.slice(0, idx);
  const jsonPart = legacyKey.slice(idx + 1);
  try {
    const pairs = JSON.parse(jsonPart);
    if (!Array.isArray(pairs)) return legacyKey;
    const q = {};
    for (const pair of pairs) {
      if (Array.isArray(pair) && pair.length >= 2) q[String(pair[0])] = pair[1];
    }
    return buildCacheKey(routePath, q);
  } catch {
    return legacyKey;
  }
}

/** TTL icindeki taze onbellek (CheapShark upstream). */
function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.value;
}

/** Suresi dolmus dahil son basariyla alinan yanit — 429/5xx icin yedek. */
function getStaleCache(key) {
  const entry = cache.get(key);
  return entry ? entry.value : null;
}

function peekCachedCheapshark(key) {
  const entry = cache.get(key);
  return entry ? entry.value : null;
}

function isUsableCheapsharkSoft(routePath, data) {
  if (data == null) return false;
  if (routePath === "/deals") return Array.isArray(data) && data.length > 0;
  if (routePath === "/stores") return Array.isArray(data) && data.length > 0;
  if (routePath === "/games") {
    return typeof data === "object" && !Array.isArray(data) && Object.keys(data).length > 0;
  }
  return true;
}

function recordSnapshotForPersist(cacheKey, value) {
  if (cacheKey.startsWith("/deals:") && Array.isArray(value) && value.length > 0) {
    while (dealsSnapshotByKey.size >= 48) {
      const first = dealsSnapshotByKey.keys().next().value;
      dealsSnapshotByKey.delete(first);
    }
    dealsSnapshotByKey.set(cacheKey, value);
  }
  const storesKey = buildCacheKey("/stores", {});
  if (cacheKey === storesKey && value != null) {
    lastGoodStores = value;
  }
}

function setCached(key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
  recordSnapshotForPersist(key, value);
  schedulePersistStaleToDisk();
}

async function loadStaleFromDisk() {
  try {
    await fs.access(CHEAPSHARK_STALE_DISK);
  } catch {
    return;
  }
  try {
    const raw = await fs.readFile(CHEAPSHARK_STALE_DISK, "utf8");
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return;
    let n = 0;

    if (obj["__snapshot:stores"] != null) {
      lastGoodStores = obj["__snapshot:stores"];
      const sk = buildCacheKey("/stores", {});
      if (!cache.has(sk)) {
        cache.set(sk, { value: lastGoodStores, expiresAt: 0 });
        n += 1;
      }
    }

    const dealsMap = obj["__snapshot:dealsMap"];
    if (dealsMap && typeof dealsMap === "object" && !Array.isArray(dealsMap)) {
      for (const [dk, arr] of Object.entries(dealsMap)) {
        if (!Array.isArray(arr) || !arr.length) continue;
        const mk = migrateLegacyCacheKey(dk);
        dealsSnapshotByKey.set(mk, arr);
        if (!cache.has(mk)) {
          cache.set(mk, { value: arr, expiresAt: 0 });
          n += 1;
        }
      }
    }

    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("__")) continue;
      const key = migrateLegacyCacheKey(k);
      if (cache.has(key)) continue;
      cache.set(key, { value: v, expiresAt: 0 });
      recordSnapshotForPersist(key, v);
      n += 1;
    }
    if (n > 0) {
      console.log(`CheapShark: diskten ${n} eski anahtar yuklendi (429 korumasi).`);
    }
  } catch (e) {
    console.warn("CheapShark disk stale okunamadi:", e.message);
  }
}

function schedulePersistStaleToDisk() {
  clearTimeout(persistStaleTimer);
  persistStaleTimer = setTimeout(() => {
    void persistStaleToDisk();
  }, 4000);
}

async function persistStaleToDisk() {
  try {
    const maxKeys = 500;
    const keys = [...cache.keys()];
    const slice = keys.length > maxKeys ? keys.slice(keys.length - maxKeys) : keys;
    const obj = {};
    for (const k of slice) {
      const e = cache.get(k);
      if (e) obj[k] = e.value;
    }
    if (lastGoodStores != null) {
      obj["__snapshot:stores"] = lastGoodStores;
    }
    const dealsSnapOut = {};
    let di = 0;
    for (const [dk, arr] of dealsSnapshotByKey) {
      if (di >= 20) break;
      if (Array.isArray(arr) && arr.length > 0) {
        dealsSnapOut[dk] = arr;
        di += 1;
      }
    }
    if (Object.keys(dealsSnapOut).length > 0) {
      obj["__snapshot:dealsMap"] = dealsSnapOut;
    }
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(CHEAPSHARK_STALE_DISK, JSON.stringify(obj), "utf8");
  } catch (e) {
    console.warn("CheapShark disk stale yazilamadi:", e.message);
  }
}

async function waitForUpstreamSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, UPSTREAM_MIN_INTERVAL_MS - (now - lastUpstreamAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastUpstreamAt = Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseQueryFromCacheKey(fullKey) {
  const idx = fullKey.indexOf(":");
  if (idx < 0) return null;
  const routePath = fullKey.slice(0, idx);
  try {
    const pairs = JSON.parse(fullKey.slice(idx + 1));
    if (!Array.isArray(pairs)) return null;
    const q = {};
    for (const pair of pairs) {
      if (Array.isArray(pair) && pair.length >= 2) q[String(pair[0])] = String(pair[1]);
    }
    return { routePath, q };
  } catch {
    return null;
  }
}

function dealsQueryKindFromNormalized(q) {
  if (String(q.onSale || "") === "1") return "sale";
  return "popular";
}

function snapshotFallbackForRoute(routePath, qNorm) {
  if (routePath === "/stores") {
    if (lastGoodStores != null) return lastGoodStores;
    return null;
  }
  if (routePath !== "/deals") return null;
  const want = dealsQueryKindFromNormalized(qNorm);
  const exactKey = buildCacheKey(routePath, qNorm);
  const exact = dealsSnapshotByKey.get(exactKey);
  if (Array.isArray(exact) && exact.length > 0) return exact;

  for (const [k, arr] of dealsSnapshotByKey) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const p = parseQueryFromCacheKey(k);
    if (!p || p.routePath !== "/deals") continue;
    const nq = normalizeQueryForCache(p.q);
    if (dealsQueryKindFromNormalized(nq) === want) return arr;
  }
  return null;
}

async function fetchUpstreamCheapshark(routePath, qNorm, cacheKey) {
  const url = `${CHEAPSHARK_BASE_URL}${routePath}`;
  let delayMs = 500;
  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await waitForUpstreamSlot();
      const response = await axios.get(url, {
        params: Object.keys(qNorm).length ? qNorm : undefined,
        timeout: 15000,
        headers: {
          "User-Agent": "GamePriceProxy/1.0",
          Accept: "application/json",
        },
      });
      setCached(cacheKey, response.data);
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const retryAfterSec = Number(error.response?.headers?.["retry-after"]);
      const canRetry = status === 429 || (status >= 500 && status <= 599);
      if (canRetry && attempt < 4) {
        const fromHeader =
          Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? Math.min(retryAfterSec * 1000, MAX_RETRY_AFTER_MS)
            : null;
        const retryDelay = fromHeader != null ? fromHeader : delayMs;
        await sleep(retryDelay);
        delayMs *= 2;
      }
    }
  }

  const staleRaw =
    getStaleCache(cacheKey) ?? snapshotFallbackForRoute(routePath, qNorm);
  const stale = isUsableCheapsharkSoft(routePath, staleRaw) ? staleRaw : null;
  const status = lastError?.response?.status;
  if (stale != null && status !== 400) {
    console.warn(
      `[CheapShark] Upstream basarisiz (HTTP ${status ?? "—"}), eski onbellek donduruluyor: ${routePath}`
    );
    return stale;
  }

  throw lastError || new Error("Upstream unavailable");
}

async function cheapSharkGet(routePath, query, options = {}) {
  const forceUpstream = options.forceUpstream === true;
  const qNorm = normalizeQueryForCache(query);
  const cacheKey = buildCacheKey(routePath, qNorm);
  const cached = getCached(cacheKey);
  if (cached != null) {
    return cached;
  }

  const softRaw = getStaleCache(cacheKey) ?? snapshotFallbackForRoute(routePath, qNorm);
  const soft = isUsableCheapsharkSoft(routePath, softRaw) ? softRaw : null;
  if (soft != null) {
    const allowBg =
      CHEAPSHARK_BACKGROUND_REFRESH &&
      CHEAPSHARK_UPSTREAM_ENABLED &&
      !forceUpstream;
    if (allowBg) {
      const lastBg = backgroundRefreshAt.get(cacheKey) ?? 0;
      if (Date.now() - lastBg >= UPSTREAM_BACKGROUND_REFRESH_MS) {
        backgroundRefreshAt.set(cacheKey, Date.now());
        void fetchUpstreamCheapshark(routePath, qNorm, cacheKey).catch(() => {});
      }
    }
    return soft;
  }

  if (!CHEAPSHARK_UPSTREAM_ENABLED && !forceUpstream) {
    const err = new Error(
      "Bu anahtar icin onbellek yok ve CheapShark upstream kapali (CHEAPSHARK_UPSTREAM_ENABLED=0). Warmup veya gunluk cron ile doldur."
    );
    err.code = "CHEAPSHARK_CACHE_MISS";
    throw err;
  }

  return fetchUpstreamCheapshark(routePath, qNorm, cacheKey);
}

function gameIdsFromDealsPayload(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.gameID ?? raw.gameId ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function getWarmupSecretFromRequest(req) {
  const h = req.headers["x-warmup-secret"];
  if (typeof h === "string" && h.trim()) return h.trim();
  const b = req.body && typeof req.body === "object" ? req.body.secret : null;
  if (typeof b === "string" && b.trim()) return b.trim();
  return "";
}

async function runCheapSharkWarmup(opts) {
  const maxGameIds = opts?.maxGameIds != null ? opts.maxGameIds : WARMUP_MAX_GAME_IDS;
  const steps = [];
  const pushStep = (name, ok, ms, error) => {
    steps.push(error ? { name, ok, ms, error } : { name, ok, ms });
  };

  const run = async (name, fn) => {
    const s = Date.now();
    try {
      await fn();
      pushStep(name, true, Date.now() - s);
    } catch (e) {
      const err = e?.message || String(e);
      pushStep(name, false, Date.now() - s, err);
      throw Object.assign(new Error(err), { steps });
    }
  };

  await run("stores", () => cheapSharkGet("/stores", {}, { forceUpstream: true }));

  for (let page = 0; page < 4; page += 1) {
    await run(`deals_popular_p${page}`, () =>
      cheapSharkGet(
        "/deals",
        {
          sortBy: "Deal Rating",
          pageSize: "60",
          pageNumber: String(page),
        },
        { forceUpstream: true }
      )
    );
  }

  for (let page = 0; page < 4; page += 1) {
    await run(`deals_sale_p${page}`, () =>
      cheapSharkGet(
        "/deals",
        {
          onSale: "1",
          sortBy: "Savings",
          pageSize: "60",
          pageNumber: String(page),
        },
        { forceUpstream: true }
      )
    );
  }

  for (let si = 0; si < WARMUP_SEARCH_TITLES.length; si += 1) {
    const title = WARMUP_SEARCH_TITLES[si];
    await run(`games_search_${si}`, () =>
      cheapSharkGet("/games", { title, limit: "10" }, { forceUpstream: true })
    );
  }

  const keyPop0 = buildCacheKey("/deals", {
    sortBy: "Deal Rating",
    pageSize: "60",
    pageNumber: "0",
  });
  const popular0 = peekCachedCheapshark(keyPop0);
  const ids = gameIdsFromDealsPayload(popular0).slice(0, maxGameIds);

  for (const id of ids) {
    const s = Date.now();
    try {
      await cheapSharkGet("/games", { id }, { forceUpstream: true });
      pushStep(`games_id_${id}`, true, Date.now() - s);
    } catch (e) {
      pushStep(`games_id_${id}`, false, Date.now() - s, e?.message || String(e));
    }
  }

  return { steps, gameLookups: ids.length };
}

app.get("/health", (_req, res) => {
  const now = Date.now();
  let staleOnlyKeys = 0;
  for (const [, v] of cache) {
    if (now > v.expiresAt) staleOnlyKeys += 1;
  }
  res.json({
    ok: true,
    service: "cheapshark-proxy-server",
    cachedKeys: cache.size,
    staleOnlyKeys,
    staleDiskFile: CHEAPSHARK_STALE_DISK,
    cheapsharkUpstreamEnabled: CHEAPSHARK_UPSTREAM_ENABLED,
    cheapsharkBackgroundRefresh: CHEAPSHARK_BACKGROUND_REFRESH,
    cheapsharkDailyRefreshCron: CHEAPSHARK_DAILY_REFRESH_CRON || null,
  });
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "CheapShark proxy server is running",
    health: "/health",
    apiBase: "/api/cheapshark",
    browseCategories: "/api/browse/categories",
    warmup: WARMUP_SECRET ? "POST /api/admin/warmup-cheapshark (X-Warmup-Secret)" : null,
    cheapsharkUpstreamEnabled: CHEAPSHARK_UPSTREAM_ENABLED,
    cheapsharkBackgroundRefresh: CHEAPSHARK_BACKGROUND_REFRESH,
  });
});

app.get("/api/browse/categories", (_req, res) => {
  res.json(browseCategoriesList);
});

function cheapsharkRouteErrorStatus(err) {
  if (err.code === "CHEAPSHARK_CACHE_MISS") return 503;
  const s = err.response?.status;
  if (s === 429) return 502;
  if (typeof s === "number" && s >= 400 && s < 600) return s;
  return 502;
}

app.get("/api/cheapshark/deals", async (req, res) => {
  try {
    const data = await cheapSharkGet("/deals", req.query);
    res.json(data);
  } catch (error) {
    res.status(cheapsharkRouteErrorStatus(error)).json({
      error: "Failed to fetch CheapShark deals",
      detail: error.message,
    });
  }
});

app.get("/api/cheapshark/games", async (req, res) => {
  try {
    const data = await cheapSharkGet("/games", req.query);
    res.json(data);
  } catch (error) {
    res.status(cheapsharkRouteErrorStatus(error)).json({
      error: "Failed to fetch CheapShark games",
      detail: error.message,
    });
  }
});

app.get("/api/cheapshark/stores", async (req, res) => {
  try {
    const data = await cheapSharkGet("/stores", req.query);
    res.json(data);
  } catch (error) {
    res.status(cheapsharkRouteErrorStatus(error)).json({
      error: "Failed to fetch CheapShark stores",
      detail: error.message,
    });
  }
});

/** CheapShark `redirect?dealID=` zincirini takip edip nihai mağaza URL’sini döner (axios, Node uyumu). */
async function followCheapsharkDealRedirect(startUrl) {
  const ax = await axios.get(startUrl, {
    maxRedirects: 25,
    timeout: 18000,
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    },
  });
  const final =
    (ax.request && ax.request.res && ax.request.res.responseUrl) || ax.config.url || startUrl;
  return String(final);
}

app.get("/api/cheapshark/resolve-deal", async (req, res) => {
  const dealID = String(req.query.dealID || "").trim();
  if (!/^\d+$/.test(dealID)) {
    return res.status(400).send("Invalid dealID");
  }
  const start = `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(dealID)}`;
  try {
    const finalUrl = await followCheapsharkDealRedirect(start);
    if (!finalUrl || String(finalUrl).includes("cheapshark.com/redirect")) {
      return res.status(502).send("Could not resolve store URL");
    }
    return res.redirect(302, finalUrl);
  } catch (e) {
    return res.status(502).send(e.message || String(e));
  }
});

async function handlePostCheapsharkWarmup(req, res) {
  if (!WARMUP_SECRET) {
    return res.status(503).json({
      error: "Warmup disabled",
      detail: "Set WARMUP_SECRET in .env to enable POST /api/admin/warmup-cheapshark",
    });
  }
  if (getWarmupSecretFromRequest(req) !== WARMUP_SECRET) {
    return res.status(401).json({ error: "Invalid or missing warmup secret" });
  }
  let maxGameIds = WARMUP_MAX_GAME_IDS;
  const raw = req.body && typeof req.body === "object" ? req.body.maxGameIds : undefined;
  if (raw != null && Number.isFinite(Number(raw))) {
    maxGameIds = Math.min(80, Math.max(0, Number(raw)));
  }
  const t0 = Date.now();
  try {
    const { steps, gameLookups } = await runCheapSharkWarmup({ maxGameIds });
    await persistStaleToDisk();
    return res.json({
      ok: true,
      totalMs: Date.now() - t0,
      gameLookups,
      steps,
    });
  } catch (e) {
    const steps = e.steps || [];
    return res.status(502).json({
      ok: false,
      totalMs: Date.now() - t0,
      error: e.message || String(e),
      steps,
    });
  }
}

app.post("/api/admin/warmup-cheapshark", handlePostCheapsharkWarmup);
app.post("/api/admin/refresh-cheapshark", handlePostCheapsharkWarmup);

async function ensureUsersFile() {
  await ensureCollectionFile(usersFile, "users");
}

async function readUsers() {
  await ensureUsersFile();
  return readCollection(usersFile, "users");
}

async function writeUsers(users) {
  await writeCollection(usersFile, "users", users);
}

async function ensureCollectionFile(filePath, key) {
  try {
    await fs.access(filePath);
  } catch (_error) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ [key]: [] }, null, 2), "utf8");
  }
}

async function readCollection(filePath, key) {
  await ensureCollectionFile(filePath, key);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed[key]) ? parsed[key] : [];
}

async function writeCollection(filePath, key, list) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ [key]: list }, null, 2), "utf8");
}

async function readDevices() {
  return readCollection(devicesFile, "devices");
}

async function writeDevices(devices) {
  await writeCollection(devicesFile, "devices", devices);
}

async function readWatchlist() {
  return readCollection(watchlistFile, "watchlist");
}

async function writeWatchlist(watchlist) {
  await writeCollection(watchlistFile, "watchlist", watchlist);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidTrPhone(phoneDigits) {
  return /^0\d{10}$/.test(phoneDigits);
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const firstName = String(req.body?.firstName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const nicknameRaw = String(req.body?.nickname || "").trim();
    const nickname = nicknameRaw.toLowerCase();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || "");

    if (
      !firstName ||
      !lastName ||
      !nickname ||
      !email ||
      !phone ||
      password.length < 6
    ) {
      return res.status(400).json({
        error:
          "firstName, lastName, nickname, email, phone and password(min 6) are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email format invalid" });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: "Password must include upper, lower and number (min 6)",
      });
    }

    if (!isValidTrPhone(phone)) {
      return res.status(400).json({
        error: "Phone must be Turkish format and start with 0 (0XXXXXXXXXX)",
      });
    }

    const users = await readUsers();
    const emailExists = users.some((u) => u.email === email);
    if (emailExists) {
      return res.status(409).json({ error: "Email already used" });
    }

    const nicknameExists = users.some((u) => (u.nickname || "").toLowerCase() === nickname);
    if (nicknameExists) {
      return res.status(409).json({ error: "Nickname already used" });
    }

    const phoneExists = users.some((u) => (u.phone || "").trim() === phone);
    if (phoneExists) {
      return res.status(409).json({ error: "Phone already used" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: randomUUID(),
      firstName,
      lastName,
      nickname,
      email,
      phone,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await writeUsers(users);

    return res.status(201).json({
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      nickname: newUser.nickname,
      email: newUser.email,
      phone: newUser.phone,
      createdAt: newUser.createdAt,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Registration failed",
      detail: error.message,
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifierRaw = String(req.body?.identifier || "").trim();
    const identifier = identifierRaw.toLowerCase();
    const password = String(req.body?.password || "");

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: "identifier(email or nickname) and password are required" });
    }

    const users = await readUsers();
    const user = users.find(
      (u) =>
        (u.email || "").toLowerCase() === identifier ||
        (u.nickname || "").toLowerCase() === identifier
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({
      id: user.id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      nickname: user.nickname || "",
      email: user.email || "",
      phone: user.phone || "",
      createdAt: user.createdAt || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Login failed",
      detail: error.message,
    });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ error: "x-user-id header is required" });
    }
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({
      id: user.id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      nickname: user.nickname || "",
      email: user.email || "",
      phone: user.phone || "",
      createdAt: user.createdAt || null,
    });
  } catch (error) {
    return res.status(500).json({ error: "Profile fetch failed", detail: error.message });
  }
});

app.put("/api/auth/profile", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ error: "x-user-id header is required" });
    }

    const firstName = String(req.body?.firstName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const nickname = String(req.body?.nickname || "").trim().toLowerCase();
    const phone = normalizePhone(req.body?.phone);

    if (!firstName || !lastName || !nickname || !phone) {
      return res.status(400).json({
        error: "firstName, lastName, nickname and phone are required",
      });
    }
    if (!isValidTrPhone(phone)) {
      return res.status(400).json({
        error: "Phone must be Turkish format and start with 0 (0XXXXXXXXXX)",
      });
    }

    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx < 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const nicknameTaken = users.some(
      (u, i) => i != idx && (u.nickname || "").toLowerCase() === nickname
    );
    if (nicknameTaken) {
      return res.status(409).json({ error: "Nickname already used" });
    }

    const phoneTaken = users.some((u, i) => i != idx && normalizePhone(u.phone) === phone);
    if (phoneTaken) {
      return res.status(409).json({ error: "Phone already used" });
    }

    users[idx] = {
      ...users[idx],
      firstName,
      lastName,
      nickname,
      phone,
      updatedAt: new Date().toISOString(),
    };

    await writeUsers(users);
    const user = users[idx];
    return res.json({
      id: user.id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      nickname: user.nickname || "",
      email: user.email || "",
      phone: user.phone || "",
      createdAt: user.createdAt || null,
    });
  } catch (error) {
    return res.status(500).json({ error: "Profile update failed", detail: error.message });
  }
});

function getUserIdFromRequest(req) {
  return String(req.headers["x-user-id"] || "").trim();
}

function toPriceNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function sendPushToUser(userId, title, body, data = {}) {
  if (!pushEnabled) {
    return { ok: false, sent: 0, reason: "push_disabled" };
  }
  const devices = await readDevices();
  const targets = devices.filter((d) => d.userId === userId && d.token);
  if (targets.length === 0) {
    return { ok: false, sent: 0, reason: "no_device_token" };
  }

  const sendResults = await Promise.all(
    targets.map(async (device) => {
      try {
        await admin.messaging().send({
          token: device.token,
          notification: { title, body },
          data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
          ),
        });
        return { ok: true, token: device.token };
      } catch (_error) {
        return { ok: false, token: device.token };
      }
    })
  );

  const sent = sendResults.filter((r) => r.ok).length;
  return { ok: sent > 0, sent };
}

async function fetchCurrentGamePrice(gameId) {
  const game = await cheapSharkGet("/games", { id: gameId });
  const deals = Array.isArray(game?.deals) ? game.deals : [];
  let min = null;
  for (const deal of deals) {
    const p = toPriceNumber(deal?.price ?? deal?.salePrice);
    if (p == null) continue;
    min = min == null ? p : Math.min(min, p);
  }
  return min;
}

app.post("/api/devices/register", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "unknown").trim();
    if (!userId || !token) {
      return res.status(400).json({ error: "x-user-id header and token are required" });
    }

    const users = await readUsers();
    const userExists = users.some((u) => u.id === userId);
    if (!userExists) {
      return res.status(404).json({ error: "User not found" });
    }

    const devices = await readDevices();
    const now = new Date().toISOString();
    const existingIndex = devices.findIndex((d) => d.token === token);
    const record = {
      id: existingIndex >= 0 ? devices[existingIndex].id : randomUUID(),
      userId,
      token,
      platform,
      updatedAt: now,
    };
    if (existingIndex >= 0) {
      devices[existingIndex] = record;
    } else {
      devices.push(record);
    }
    await writeDevices(devices);
    return res.json({ ok: true, device: record });
  } catch (error) {
    return res.status(500).json({ error: "Device register failed", detail: error.message });
  }
});

app.get("/api/watchlist", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ error: "x-user-id header is required" });
    }
    const all = await readWatchlist();
    return res.json(all.filter((w) => w.userId === userId && w.isActive !== false));
  } catch (error) {
    return res.status(500).json({ error: "Watchlist fetch failed", detail: error.message });
  }
});

app.post("/api/watchlist", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const gameId = String(req.body?.gameId || "").trim();
    const gameTitle = String(req.body?.gameTitle || "").trim();
    const targetPrice = req.body?.targetPrice == null ? null : toPriceNumber(req.body?.targetPrice);
    if (!userId || !gameId || !gameTitle) {
      return res.status(400).json({ error: "x-user-id, gameId and gameTitle are required" });
    }

    const list = await readWatchlist();
    const idx = list.findIndex((w) => w.userId === userId && w.gameId === gameId);
    const now = new Date().toISOString();
    let currentPrice = null;
    try {
      currentPrice = await fetchCurrentGamePrice(gameId);
    } catch (_error) {
      // Ilk eklemede fiyat alinmasa da takip kaydi olussun.
      currentPrice = null;
    }
    const row = {
      id: idx >= 0 ? list[idx].id : randomUUID(),
      userId,
      gameId,
      gameTitle,
      targetPrice,
      lastPrice: currentPrice,
      lastNotifiedPrice: idx >= 0 ? list[idx].lastNotifiedPrice ?? null : null,
      lastNotifiedAt: idx >= 0 ? list[idx].lastNotifiedAt ?? null : null,
      isActive: true,
      updatedAt: now,
      createdAt: idx >= 0 ? list[idx].createdAt : now,
    };
    if (idx >= 0) {
      list[idx] = row;
    } else {
      list.push(row);
    }
    await writeWatchlist(list);
    return res.status(201).json(row);
  } catch (error) {
    return res.status(500).json({ error: "Watchlist add failed", detail: error.message });
  }
});

app.delete("/api/watchlist/:gameId", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const gameId = String(req.params?.gameId || "").trim();
    if (!userId || !gameId) {
      return res.status(400).json({ error: "x-user-id and gameId are required" });
    }
    const list = await readWatchlist();
    const next = list.filter((w) => !(w.userId === userId && w.gameId === gameId));
    await writeWatchlist(next);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Watchlist delete failed", detail: error.message });
  }
});

app.post("/api/notify/test", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ error: "x-user-id header is required" });
    }
    const result = await sendPushToUser(
      userId,
      "Test bildirim",
      "Push altyapisi calisiyor.",
      { type: "test" }
    );
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Test notify failed", detail: error.message });
  }
});

async function runPriceCheckCycle() {
  const list = await readWatchlist();
  const active = list.filter((w) => w.isActive !== false);
  if (active.length === 0) return;

  for (const item of active) {
    try {
      const currentPrice = await fetchCurrentGamePrice(item.gameId);
      if (currentPrice == null) continue;

      const previousPrice = toPriceNumber(item.lastPrice);
      const targetPrice = toPriceNumber(item.targetPrice);
      const lastNotifiedPrice = toPriceNumber(item.lastNotifiedPrice);
      const hitTarget = targetPrice != null ? currentPrice <= targetPrice : false;
      const shouldNotify = hitTarget && currentPrice !== lastNotifiedPrice;

      item.lastPrice = currentPrice;
      item.updatedAt = new Date().toISOString();

      if (shouldNotify) {
        const message = `${item.gameTitle} fiyati \$${currentPrice.toFixed(2)} oldu.`;
        const result = await sendPushToUser(item.userId, "Indirim yakalandi", message, {
          type: "price_drop",
          gameId: item.gameId,
          gameTitle: item.gameTitle,
          price: currentPrice,
        });
        if (result.ok) {
          item.lastNotifiedPrice = currentPrice;
          item.lastNotifiedAt = new Date().toISOString();
        }
      }
    } catch (_error) {}
  }

  await writeWatchlist(list);
}

async function startServer() {
  await loadStaleFromDisk();
  initFirebaseAdmin();
  cron.schedule(PRICE_CHECK_CRON, async () => {
    try {
      await runPriceCheckCycle();
    } catch (_error) {}
  });

  if (CHEAPSHARK_DAILY_REFRESH_CRON) {
    cron.schedule(CHEAPSHARK_DAILY_REFRESH_CRON, async () => {
      try {
        console.log("[CheapShark] Gunluk toplu yenileme (cron) basladi");
        await runCheapSharkWarmup({ maxGameIds: WARMUP_MAX_GAME_IDS });
        await persistStaleToDisk();
        console.log("[CheapShark] Gunluk toplu yenileme bitti");
      } catch (e) {
        console.warn("[CheapShark] Gunluk yenileme hata:", e.message || e);
      }
    });
  }

  app.listen(PORT, () => {
    console.log(`Proxy server is running on http://localhost:${PORT}`);
    console.log(`CheapShark cache TTL: ${CACHE_TTL_SECONDS}s (${Math.round(CACHE_TTL_SECONDS / 3600)}h)`);
    console.log(`CheapShark stale disk: ${CHEAPSHARK_STALE_DISK}`);
    console.log(
      `CheapShark upstream (kullanici API): ${CHEAPSHARK_UPSTREAM_ENABLED ? "acik" : "kapali — sadece onbellek"}`
    );
    console.log(
      `CheapShark arka plan tazeleme: ${CHEAPSHARK_BACKGROUND_REFRESH ? "acik" : "kapali"}`
    );
    if (CHEAPSHARK_DAILY_REFRESH_CRON) {
      console.log(`CheapShark gunluk toplu cron: ${CHEAPSHARK_DAILY_REFRESH_CRON}`);
    }
    console.log(`Price checker cron: ${PRICE_CHECK_CRON}`);
  });
}

startServer().catch((e) => {
  console.error("Server start failed:", e);
  process.exit(1);
});
