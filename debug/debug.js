"use strict";

const status = document.querySelector("#status");
const list = document.querySelector("#messages");
const syncStatus = document.querySelector("#sync-status");

function formatDate(value) {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function daysSince(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const differenceMs = Date.now() - date.getTime();
  if (differenceMs < 0) return 0;
  return Math.floor(differenceMs / (24 * 60 * 60 * 1000));
}

function renderSyncStatus({ messages, lastSyncedAt, staleAfterDays }) {
  const lines = [];
  const latestMessageDate = messages[0] && messages[0].date;
  const threshold = Number(staleAfterDays);
  if (Number.isFinite(threshold) && threshold >= 0) {
    const daysWithoutNewMessages = daysSince(latestMessageDate);
    if (daysWithoutNewMessages !== null && daysWithoutNewMessages >= threshold) {
      lines.push(`Al ${daysWithoutNewMessages} dagen geen nieuwe berichten`);
    }
  }
  if (lastSyncedAt) {
    lines.push(`Laatst succesvol gesynchroniseerd: ${formatDateTime(lastSyncedAt)}`);
  } else {
    lines.push("Nog niet succesvol gesynchroniseerd");
  }
  syncStatus.replaceChildren();
  lines.forEach((line) => {
    const lineElement = document.createElement("p");
    lineElement.className = "sync-status-line";
    lineElement.textContent = line;
    syncStatus.append(lineElement);
  });
}

fetch("/api/messages")
  .then(async (response) => {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    return payload;
  })
  .then((payload) => {
    const messages = payload.messages || [];
    status.remove();
    messages.forEach((message) => {
      const item = document.createElement("li");
      const heading = document.createElement("div");
      heading.className = "message-heading";
      const title = document.createElement("span");
      title.className = "message-title";
      title.textContent = message.title || message.author || "Parro-bericht";
      const meta = document.createElement("span");
      meta.className = "meta";
      const metaParts = [message.group, message.date && formatDate(message.date)].filter(Boolean);
      meta.textContent = metaParts.length ? ` · ${metaParts.join(" · ")}` : "";
      heading.append(title, meta);
      const body = document.createElement("p");
      body.className = "message-body";
      body.textContent = message.body;
      item.append(heading, body);
      list.append(item);
    });
    renderSyncStatus(payload);
  })
  .catch((error) => {
    status.className = "error";
    status.textContent = error.message;
  });
