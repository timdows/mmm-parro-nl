/* global Module, Log */

Module.register("MMM-Parro-NL", {
  defaults: {
    title: "Parro",
    displayMode: "todayAndLatest",
    timeZone: "Europe/Amsterdam",
    maximumEntries: 5,
    connectionTimeout: 30000,
    showGroup: true,
    showDate: true,
    staleAfterDays: 3,
    showLastSynced: true
  },

  start() {
    this.messages = [];
    this.lastSyncedAt = null;
    this.error = null;
    this.loaded = false;
    this.connectionTimer = setTimeout(() => {
      if (!this.loaded) {
        this.error = "Geen antwoord van node_helper. Voer 'npm run diagnose' uit en controleer de MagicMirror-logs.";
        this.loaded = true;
        this.updateDom(500);
      }
    }, this.config.connectionTimeout);
    this.sendSocketNotification("PARRO_CONFIG", this.config);
  },

  getStyles() {
    return ["MMM-Parro-NL.css"];
  },

  getHeader() {
    return this.config.title;
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "PARRO_MESSAGES") {
      clearTimeout(this.connectionTimer);
      if (Array.isArray(payload)) {
        this.messages = payload;
        this.lastSyncedAt = null;
      } else {
        this.messages = Array.isArray(payload.messages) ? payload.messages : [];
        this.lastSyncedAt = payload.lastSyncedAt || null;
      }
      this.error = null;
      this.loaded = true;
      this.updateDom(500);
    }
    if (notification === "PARRO_ERROR") {
      clearTimeout(this.connectionTimer);
      this.error = payload.message;
      this.loaded = true;
      Log.error(`[MMM-Parro-NL] ${payload.message}`);
      this.updateDom(500);
    }
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "parro-wrapper";

    if (!this.loaded) {
      wrapper.className += " dimmed light small";
      wrapper.textContent = "Berichten laden…";
      return wrapper;
    }
    if (this.error) {
      wrapper.className += " parro-error small";
      wrapper.textContent = this.error;
      return wrapper;
    }
    if (!this.messages.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "dimmed light small";
      emptyState.textContent = "Geen berichten gevonden";
      wrapper.appendChild(emptyState);
      const status = this.buildStatus();
      if (status) wrapper.appendChild(status);
      return wrapper;
    }

    const list = document.createElement("ul");
    list.className = "parro-list";
    this.messages.forEach((message) => {
      const item = document.createElement("li");
      item.className = "parro-message";

      const heading = document.createElement("div");
      heading.className = "parro-heading";
      const title = document.createElement("span");
      title.className = "parro-title bright";
      title.textContent = message.title || message.author || "Parro-bericht";
      heading.appendChild(title);

      const metaParts = [];
      if (this.config.showGroup && message.group) metaParts.push(message.group);
      if (this.config.showDate && message.date) metaParts.push(this.formatDate(message.date));
      if (metaParts.length) {
        const meta = document.createElement("span");
        meta.className = "parro-meta dimmed";
        meta.textContent = ` · ${metaParts.join(" · ")}`;
        heading.appendChild(meta);
      }
      item.appendChild(heading);

      const body = document.createElement("div");
      body.className = "parro-body light";
      body.textContent = message.body || "";
      item.appendChild(body);
      list.appendChild(item);
    });
    wrapper.appendChild(list);

    const status = this.buildStatus();
    if (status) wrapper.appendChild(status);
    return wrapper;
  },

  buildStatus() {
    const lines = [];
    const latestMessageDate = this.messages[0] && this.messages[0].date;
    const staleAfterDays = Number(this.config.staleAfterDays);
    if (Number.isFinite(staleAfterDays) && staleAfterDays >= 0) {
      const daysWithoutNewMessages = this.daysSince(latestMessageDate);
      if (daysWithoutNewMessages !== null && daysWithoutNewMessages >= staleAfterDays) {
        lines.push(`Al ${daysWithoutNewMessages} dagen geen nieuwe berichten`);
      }
    }

    if (this.config.showLastSynced) {
      if (this.lastSyncedAt) {
        lines.push(`Laatst succesvol gesynchroniseerd: ${this.formatDateTime(this.lastSyncedAt)}`);
      } else {
        lines.push("Nog niet succesvol gesynchroniseerd");
      }
    }

    if (!lines.length) return null;
    const status = document.createElement("div");
    status.className = "parro-status dimmed small";
    lines.forEach((line) => {
      const lineElement = document.createElement("div");
      lineElement.className = "parro-status-line";
      lineElement.textContent = line;
      status.appendChild(lineElement);
    });
    return status;
  },

  daysSince(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const differenceMs = Date.now() - date.getTime();
    if (differenceMs < 0) return 0;
    return Math.floor(differenceMs / (24 * 60 * 60 * 1000));
  },

  formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  },

  formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }
});
