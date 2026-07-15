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
      const title = document.createElement("h2");
      title.textContent = message.title || message.author || "Parro-bericht";
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = [message.group, message.date && formatDate(message.date)].filter(Boolean).join(" · ");
      const body = document.createElement("p");
      body.textContent = message.body;
      item.append(title, meta, body);
      list.append(item);
    });
  })
  .catch((error) => {
    status.className = "error";
    status.textContent = error.message;
  });
