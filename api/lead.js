const START_NUMBER = 41;
const COUNTER_KEY = "doha:lead_counter";

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const ABACUS_URL =
  process.env.COUNTER_URL || "https://abacus.jasoncameron.dev/hit/doha-residence-uz/leads";

async function fetchWithTimeout(url, options = {}, ms = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function incrRedis() {
  const res = await fetchWithTimeout(`${REDIS_URL}/incr/${encodeURIComponent(COUNTER_KEY)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const { result } = await res.json();
  return Number(result);
}

async function incrAbacus() {
  const res = await fetchWithTimeout(ABACUS_URL);
  if (!res.ok) throw new Error(`Abacus ${res.status}`);
  const { value } = await res.json();
  return Number(value);
}

async function nextNumber() {
  const sources = REDIS_URL && REDIS_TOKEN ? [incrRedis, incrAbacus] : [incrAbacus];
  for (const incr of sources) {
    try {
      const count = await incr();
      if (count >= 1) return START_NUMBER - 1 + count;
    } catch (e) {
      console.error("Counter error:", e.message);
    }
  }
  return null;
}

async function sendToCrm(lead) {
  // TODO: CRM integratsiyasi shu yerga qo'shiladi, masalan:
  // await fetch(process.env.CRM_WEBHOOK_URL, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(lead),
  // });
  console.log("New lead:", JSON.stringify(lead));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (e) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = readBody(req);
  const name = String(body.name || "").trim().slice(0, 60);
  const phone = String(body.phone || "").replace(/[^\d+]/g, "");

  if (name.length < 2 || !/^\+998\d{9}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: "Invalid name or phone" });
  }

  const number = await nextNumber();
  const lead = {
    name,
    phone,
    number,
    page: body.page || null,
    referrer: body.referrer || null,
    userAgent: req.headers["user-agent"] || null,
    createdAt: new Date().toISOString(),
  };

  try {
    await sendToCrm(lead);
  } catch (e) {
    console.error("CRM error:", e);
  }

  return res.status(200).json({ ok: true, number });
};
