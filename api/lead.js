const START_NUMBER = 41;
const COUNTER_KEY = "doha:lead_counter";

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function nextNumber() {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/incr/${encodeURIComponent(COUNTER_KEY)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    if (!res.ok) return null;
    const { result } = await res.json();
    return START_NUMBER - 1 + Number(result);
  } catch (e) {
    return null;
  }
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
