/**
 * CheapShark onbellegini doldurur (konferans / cold start).
 * .env: WARMUP_SECRET (zorunlu), WARMUP_BASE_URL (varsayilan http://127.0.0.1:3000)
 */
const path = require("path");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const base = String(process.env.WARMUP_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const secret = String(process.env.WARMUP_SECRET || "").trim();

async function main() {
  if (!secret) {
    console.error("WARMUP_SECRET .env icinde tanimli olmali (sunucu ile ayni).");
    process.exit(1);
  }
  const url = `${base}/api/admin/warmup-cheapshark`;
  try {
    const res = await axios.post(
      url,
      { maxGameIds: 8 },
      {
        headers: { "X-Warmup-Secret": secret },
        validateStatus: () => true,
        timeout: 600000,
      }
    );
    console.log(JSON.stringify(res.data, null, 2));
    if (res.status >= 400 || res.data?.ok === false) process.exit(1);
  } catch (e) {
    if (e.response) {
      console.error(e.response.status, JSON.stringify(e.response.data, null, 2));
    } else {
      console.error(e.message);
    }
    process.exit(1);
  }
}

main();
