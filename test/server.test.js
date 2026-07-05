import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createNoteServer } from "../server.js";

async function withServer(run) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "process-note-"));
  const server = createNoteServer({ dataDir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    await run(origin);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

test("home creates a random note URL", async () => {
  await withServer(async (origin) => {
    const response = await fetch(origin, { redirect: "manual" });
    assert.equal(response.status, 303);
    assert.match(response.headers.get("location"), /^\/n\/[A-Za-z0-9]{9}$/);
  });
});

test("a note can be opened, saved, and opened again", async () => {
  await withServer(async (origin) => {
    const id = "abcdefghijklmnopqrstuv";
    const endpoint = `${origin}/api/notes/${id}`;

    const emptyResponse = await fetch(endpoint);
    assert.equal(emptyResponse.status, 200);
    assert.equal((await emptyResponse.json()).content, "");

    const saveResponse = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Ý tưởng hôm nay\n- Làm một việc thật gọn" })
    });
    assert.equal(saveResponse.status, 200);
    assert.equal((await saveResponse.json()).saved, true);

    const savedResponse = await fetch(endpoint);
    assert.equal(
      (await savedResponse.json()).content,
      "Ý tưởng hôm nay\n- Làm một việc thật gọn"
    );
  });
});

test("invalid IDs are rejected", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/notes/not-valid`);
    assert.equal(response.status, 404);
  });
});

test("frontend js and css assets are served locally", async () => {
  await withServer(async (origin) => {
    const [bundleResponse, cssResponse] = await Promise.all([
      fetch(`${origin}/assets/bundle.js`),
      fetch(`${origin}/assets/style.css`)
    ]);

    assert.equal(bundleResponse.status, 200);
    assert.equal(cssResponse.status, 200);
    assert.match(bundleResponse.headers.get("content-type"), /^text\/javascript/);
    assert.match(cssResponse.headers.get("content-type"), /^text\/css/);
  });
});
