import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";
import { mkdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(projectDir, "public");
const MAX_NOTE_BYTES = 1_000_000;
const NOTE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const NOTE_ID_PATTERN = /^(?:[A-Za-z0-9]{9}|[A-Za-z0-9_-]{20,64})$/;

const staticFiles = new Map([
  ["/assets/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/assets/bundle.js", ["bundle.js", "text/javascript; charset=utf-8"]],
  ["/assets/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]]
]);

const vendorFiles = new Map([]);

function newNoteId() {
  return Array.from(
    { length: 9 },
    () => NOTE_ID_ALPHABET[randomInt(NOTE_ID_ALPHABET.length)]
  ).join("");
}

function setSecurityHeaders(response) {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_NOTE_BYTES) {
        const error = new Error("Note is too large");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function serveFile(response, filename, contentType, cacheControl = "no-cache") {
  try {
    const filePath = path.isAbsolute(filename) ? filename : path.join(publicDir, filename);
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": cacheControl
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}

export function createNoteServer({ dataDir = path.join(projectDir, "data") } = {}) {
  return createServer(async (request, response) => {
    setSecurityHeaders(response);

    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(303, {
          Location: `/n/${newNoteId()}`,
          "Cache-Control": "no-store"
        });
        response.end();
        return;
      }

      if (request.method === "GET" && staticFiles.has(url.pathname)) {
        const [filename, contentType] = staticFiles.get(url.pathname);
        await serveFile(response, filename, contentType);
        return;
      }

      if (request.method === "GET" && vendorFiles.has(url.pathname)) {
        const [filename, contentType] = vendorFiles.get(url.pathname);
        await serveFile(response, filename, contentType, "public, max-age=31536000, immutable");
        return;
      }

      const pageMatch = url.pathname.match(/^\/n\/([^/]+)$/);
      if (request.method === "GET" && pageMatch) {
        if (!NOTE_ID_PATTERN.test(pageMatch[1])) {
          sendJson(response, 404, { error: "Note not found" });
          return;
        }
        await serveFile(response, "index.html", "text/html; charset=utf-8");
        return;
      }

      const apiMatch = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
      if (apiMatch) {
        const noteId = apiMatch[1];
        if (!NOTE_ID_PATTERN.test(noteId)) {
          sendJson(response, 404, { error: "Note not found" });
          return;
        }

        const notePath = path.join(dataDir, `${noteId}.txt`);

        if (request.method === "GET") {
          let content = "";
          let updatedAt = null;
          try {
            const fileStat = await stat(notePath);
            updatedAt = fileStat.mtime.toISOString();
            content = await readFile(notePath, "utf8");
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          sendJson(response, 200, { id: noteId, content, updatedAt });
          return;
        }

        if (request.method === "PUT" || request.method === "POST") {
          const rawBody = await readRequestBody(request);
          let payload;
          try {
            payload = JSON.parse(rawBody);
          } catch {
            sendJson(response, 400, { error: "Invalid JSON" });
            return;
          }

          if (typeof payload.content !== "string") {
            sendJson(response, 400, { error: "Content must be a string" });
            return;
          }

          const contentSize = Buffer.byteLength(payload.content, "utf8");
          if (contentSize > MAX_NOTE_BYTES) {
            sendJson(response, 413, { error: "Note is too large" });
            return;
          }

          if (payload.updatedAt) {
            try {
              const currentStat = await stat(notePath);
              if (currentStat.mtime.toISOString() !== payload.updatedAt) {
                sendJson(response, 409, { error: "Conflict: Note was modified by another user" });
                return;
              }
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
          }

          await mkdir(dataDir, { recursive: true });
          const temporaryPath = `${notePath}.${randomBytes(6).toString("hex")}.tmp`;
          await writeFile(temporaryPath, payload.content, "utf8");
          await rename(temporaryPath, notePath);

          const savedStat = await stat(notePath);
          sendJson(response, 200, {
            saved: true,
            updatedAt: savedStat.mtime.toISOString()
          });
          return;
        }

        response.setHeader("Allow", "GET, PUT, POST");
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      if (error.statusCode === 413) {
        if (!response.headersSent) sendJson(response, 413, { error: "Note is too large" });
        return;
      }
      console.error(error);
      if (!response.headersSent) sendJson(response, 500, { error: "Internal server error" });
      else response.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 22099);
  const host = process.env.HOST || "0.0.0.0";
  const dataDir = process.env.DATA_DIR || path.join(projectDir, "data");
  const server = createNoteServer({ dataDir });

  server.listen(port, host, () => {
    console.log(`Simple Note is running at http://${host}:${port}`);
  });
}
