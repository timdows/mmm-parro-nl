"use strict";

const status = document.querySelector("#status");
const list = document.querySelector("#messages");

function formatDate(value) {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

fetch("/api/messages")
  .then(async (response) => {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    return payload.messages;
  })
  .then((messages) => {
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
  })
  .catch((error) => {
    status.className = "error";
    status.textContent = error.message;
  });
