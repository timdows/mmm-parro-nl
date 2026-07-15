"use strict";

function dateKey(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function selectMessages(messages, config = {}, now = new Date()) {
  const sorted = [...messages].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  if (!sorted.length) return [];

  if (config.displayMode === "latest") {
    const count = Number(config.maximumEntries) === 3 ? 3 : 5;
    return sorted.slice(0, count);
  }

  const timeZone = config.timeZone || "Europe/Amsterdam";
  const today = dateKey(now, timeZone);
  const todaysMessages = sorted.filter((message) => dateKey(message.date, timeZone) === today);
  if (!todaysMessages.length) return [sorted[0]];

  const newest = sorted[0];
  if (!todaysMessages.includes(newest)) return [newest, ...todaysMessages];
  return todaysMessages;
}

module.exports = { selectMessages, dateKey };
