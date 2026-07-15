"use strict";

const BODY_KEYS = ["body", "content", "contents", "message", "text", "description"];
const TITLE_KEYS = ["title", "subject", "name"];
const DATE_KEYS = ["publishedAt", "sortDate", "createdAt", "sentAt", "startDate", "date", "created"];

function firstString(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function plainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<\s*li(?:\s[^>]*)?>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectObjects(value, output = [], seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);
  if (!Array.isArray(value)) output.push(value);
  Object.values(value).forEach((child) => collectObjects(child, output, seen));
  return output;
}

function parseMessages(payloads, maximumEntries = 5) {
  const candidates = payloads.flatMap((payload) => collectObjects(payload));
  const messages = candidates
    .map((item) => {
      const body = plainText(firstString(item, BODY_KEYS));
      const title = plainText(firstString(item, TITLE_KEYS));
      const date = firstString(item, DATE_KEYS);
      const authorObject = item.author || item.sender || item.creator || item.owner;
      const authorName = firstString(authorObject, ["displayName", "fullName", "name"])
        || [authorObject?.firstname, authorObject?.surname].filter(Boolean).join(" ");
      const author = plainText(typeof authorObject === "string" ? authorObject : authorName);
      const groupObject = item.group || item.channel || item.recipientGroup;
      const group = plainText(typeof groupObject === "string" ? groupObject : firstString(groupObject, ["displayName", "title", "name"]));
      const selfLink = Array.isArray(item.links) && item.links.find((link) => link.rel === "self");
      return { id: String(item.id || item.uuid || selfLink?.id || ""), title, body, date, author, group };
    })
    .filter((item) => item.body && (item.date || item.title || item.author));

  const unique = new Map();
  messages.forEach((message) => {
    const key = message.id || `${message.date}|${message.title}|${message.body}`;
    if (!unique.has(key)) unique.set(key, message);
  });
  return [...unique.values()]
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .slice(0, maximumEntries);
}

module.exports = { parseMessages, plainText };
