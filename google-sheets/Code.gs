const SHEET_NAME = "Lidlar";
const SECRET = "";

const HEADERS = [
  "Sana",
  "Navbat raqami",
  "Ism",
  "Telefon",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "Sahifa",
  "Referrer",
  "Event ID",
  "User agent",
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (SECRET && data.secret !== SECRET) {
      return json({ ok: false, error: "Unauthorized" });
    }

    const sheet = getSheet();
    const utm = parseUtm(data.page);
    const phone = String(data.phone || "");

    sheet.appendRow([
      Utilities.formatDate(new Date(data.createdAt || Date.now()), "Asia/Tashkent", "dd.MM.yyyy HH:mm:ss"),
      data.number || "",
      data.name || "",
      phone ? "'" + phone : "",
      utm.utm_source || "",
      utm.utm_medium || "",
      utm.utm_campaign || "",
      utm.utm_content || "",
      data.page || "",
      data.referrer || "",
      data.eventId || "",
      data.userAgent || "",
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#7d0e2d").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function parseUtm(url) {
  const result = {};
  const query = String(url || "").split("?")[1];
  if (!query) return result;
  query.split("#")[0].split("&").forEach(function (pair) {
    const parts = pair.split("=");
    const key = decodeURIComponent(parts[0] || "");
    if (key.indexOf("utm_") === 0) {
      result[key] = decodeURIComponent((parts[1] || "").replace(/\+/g, " "));
    }
  });
  return result;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
