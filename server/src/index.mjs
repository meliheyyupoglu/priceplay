import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFile = path.resolve(__dirname, "../data/users.json");
const port = Number(process.env.PORT || 8787);

const app = express();
app.use(cors());
app.use(express.json());

async function readDb() {
  try {
    const raw = await readFile(dbFile, "utf8");
    const parsed = JSON.parse(raw);
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

async function writeDb(db) {
  await mkdir(path.dirname(dbFile), { recursive: true });
  await writeFile(dbFile, JSON.stringify(db, null, 2), "utf8");
}

function publicUser(u) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    nickname: u.nickname,
    email: u.email,
    phone: u.phone,
    createdAt: u.createdAt ?? null,
    updatedAt: u.updatedAt ?? null,
  };
}

function sessionToken() {
  return randomUUID().replace(/-/g, "");
}

async function authFromHeader(req) {
  const bearer = String(req.headers.authorization || "");
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
  if (!token) return null;
  const db = await readDb();
  const user = db.users.find((u) => String(u.sessionToken || "") === token);
  if (!user) return null;
  return { db, user, token };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const body = req.body || {};
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const nickname = String(body.nickname || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").replace(/\D/g, "");
  const password = String(body.password || "");

  if (!firstName || !lastName || !nickname || !email || !phone || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const db = await readDb();
  if (db.users.some((u) => String(u.email || "").toLowerCase() === email)) {
    return res.status(409).json({ error: "Email already used" });
  }
  if (db.users.some((u) => String(u.nickname || "").toLowerCase() === nickname)) {
    return res.status(409).json({ error: "Nickname already used" });
  }
  if (db.users.some((u) => String(u.phone || "").replace(/\D/g, "") === phone)) {
    return res.status(409).json({ error: "Phone already used" });
  }

  const now = new Date().toISOString();
  const token = sessionToken();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    firstName,
    lastName,
    nickname,
    email,
    phone,
    passwordHash,
    sessionToken: token,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(user);
  await writeDb(db);

  return res.json({ user: publicUser(user), token });
});

app.post("/api/auth/login", async (req, res) => {
  const body = req.body || {};
  const identifier = String(body.identifier || "").trim().toLowerCase();
  const password = String(body.password || "");
  const db = await readDb();
  const user = db.users.find(
    (u) =>
      String(u.email || "").toLowerCase() === identifier ||
      String(u.nickname || "").toLowerCase() === identifier,
  );
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, String(user.passwordHash || ""));
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  user.sessionToken = sessionToken();
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return res.json({ user: publicUser(user), token: user.sessionToken });
});

app.get("/api/auth/me", async (req, res) => {
  const auth = await authFromHeader(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ user: publicUser(auth.user) });
});

app.patch("/api/auth/profile", async (req, res) => {
  const auth = await authFromHeader(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const body = req.body || {};
  const nickname = String(body.nickname || auth.user.nickname).trim().toLowerCase();
  const phone = String(body.phone || auth.user.phone).replace(/\D/g, "");

  if (
    auth.db.users.some(
      (u) => u.id !== auth.user.id && String(u.nickname || "").toLowerCase() === nickname,
    )
  ) {
    return res.status(409).json({ error: "Nickname already used" });
  }
  if (
    auth.db.users.some(
      (u) => u.id !== auth.user.id && String(u.phone || "").replace(/\D/g, "") === phone,
    )
  ) {
    return res.status(409).json({ error: "Phone already used" });
  }

  auth.user.firstName = String(body.firstName || auth.user.firstName).trim();
  auth.user.lastName = String(body.lastName || auth.user.lastName).trim();
  auth.user.nickname = nickname;
  auth.user.phone = phone;
  auth.user.updatedAt = new Date().toISOString();
  await writeDb(auth.db);
  return res.json({ user: publicUser(auth.user) });
});

app.listen(port, () => {
  console.log(`[priceplay-server] listening on http://localhost:${port}`);
});
