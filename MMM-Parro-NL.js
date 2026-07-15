/* global Module, Log */

Module.register("MMM-Parro-NL", {
  defaults: {
    title: "Parro",
    maximumEntries: 5,
    connectionTimeout: 30000,
    showGroup: true,
    showDate: true
  },

  start() {
    this.messages = [];
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
      this.messages = payload;
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
      wrapper.className += " dimmed light small";
      wrapper.textContent = "Geen berichten gevonden";
      return wrapper;
    }

    const list = document.createElement("ul");
    list.className = "parro-list";
    this.messages.slice(0, this.config.maximumEntries).forEach((message) => {
      const item = document.createElement("li");
      item.className = "parro-message";

      const heading = document.createElement("div");
      heading.className = "parro-title bright";
      heading.textContent = message.title || message.author || "Parro-bericht";
      item.appendChild(heading);

      const metaParts = [];
      if (this.config.showGroup && message.group) metaParts.push(message.group);
      if (this.config.showDate && message.date) metaParts.push(this.formatDate(message.date));
      if (metaParts.length) {
        const meta = document.createElement("div");
        meta.className = "parro-meta dimmed xsmall";
        meta.textContent = metaParts.join(" · ");
        item.appendChild(meta);
      }

      const body = document.createElement("div");
      body.className = "parro-body light small";
      body.textContent = message.body || "";
      item.appendChild(body);
      list.appendChild(item);
    });
    wrapper.appendChild(list);
    return wrapper;
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
