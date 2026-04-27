const config = require("../config");

const BASE = () => (config.baseUrl || "").replace(/\/$/, "");

/**
 * 与 web 的 localStorage key 一致，便于 H5 与小程序互通理解
 * @param {string} page 'chat' | 'dashboard' | 'planner'
 * @param {string} [entryId]
 */
function buildWebviewUrl(page, entryId) {
  const base = BASE();
  if (!base) return "";

  if (page === "chat") {
    let u = `${base}/chat`;
    if (entryId) u += `?entry=${encodeURIComponent(entryId)}`;
    return u;
  }
  if (page === "dashboard") {
    if (!entryId) return `${base}/dashboard`;
    return `${base}/dashboard/${encodeURIComponent(entryId)}`;
  }
  if (page === "planner") {
    if (!entryId) return `${base}/planner`;
    return `${base}/planner/${encodeURIComponent(entryId)}`;
  }
  return base;
}

module.exports = { buildWebviewUrl, BASE };
