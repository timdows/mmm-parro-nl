"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ParroClient } = require("../lib/parro-client");

test("combineert alle groepen en sorteert berichten op datum", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });

  global.fetch = async (url) => {
    let body;
    if (url.includes("/group?")) {
      body = { items: [
        { name: "Groep A", links: [{ rel: "self", id: 1 }] },
        { name: "Groep B", links: [{ rel: "self", id: 2 }] }
      ] };
    } else if (url.includes("group=1")) {
      body = { items: [{ id: "a", title: "Ouder", contents: "A", sortDate: "2026-01-01T10:00:00Z" }] };
    } else {
      body = { items: [{ id: "b", title: "Nieuwer", contents: "B", sortDate: "2026-01-02T10:00:00Z" }] };
    }
    return new Response(JSON.stringify(body), {
      status: 206,
      headers: { "content-type": "application/json", "content-range": `items 0-${body.items.length - 1}/${body.items.length}` }
    });
  };

  const client = new ParroClient({ loginTimeoutMs: 1000 }, process.cwd());
  const messages = await client.fetchAllGroupMessages({ authorization: "Bearer test" }, 5, []);
  assert.deepEqual(messages.map((message) => [message.title, message.group]), [
    ["Nieuwer", "Groep B"],
    ["Ouder", "Groep A"]
  ]);
});
