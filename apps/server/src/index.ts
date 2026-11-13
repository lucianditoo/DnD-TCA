import cors from "cors";
import express from "express";
import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { TLSSocket } from "node:tls";
import { WebSocketServer } from "ws";
import { gameCatalog, isDemoCommandType, resumeGmSessionSchema, validateDemoCommand } from "@dnd-tactical/shared";
import { dispatchCommand } from "./commands/dispatcher.js";
import { handleDemoCommand } from "./demo/demoCommands.js";
import { destroyDemoSessionBySocket } from "./demo/sessionStore.js";
import { clients, resumeGmSession, send, resetAllRoomsForTest } from "./room/roomStore.js";
import { validateClientCommand } from "./validation/validateClientCommand.js";

const PORT = Number(process.env.PORT ?? 3333);

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

if (process.env.TEST_MODE === "true") {
  app.post("/api/test/reset", (_req, res) => {
    resetAllRoomsForTest();
    res.json({ ok: true, message: "System reset for test" });
  });
}

const tlsCert = process.env.WS_TLS_CERT;
const tlsKey = process.env.WS_TLS_KEY;
if (Boolean(tlsCert) !== Boolean(tlsKey)) throw new Error("WS_TLS_CERT y WS_TLS_KEY deben configurarse juntos.");
const server = tlsCert && tlsKey
  ? https.createServer({ cert: readFileSync(tlsCert), key: readFileSync(tlsKey) }, app)
  : http.createServer(app);
const wss = new WebSocketServer({ server });

const responsiveSockets = new WeakSet<object>();
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!responsiveSockets.delete(socket)) {
      socket.terminate();
      continue;
    }
    socket.ping();
    const participant = clients.get(socket);
    if (socket.readyState === socket.OPEN && participant?.role === "gm") send(socket, { type: "gm-session-heartbeat" });
  }
}, 15_000);
heartbeat.unref();
wss.on("close", () => clearInterval(heartbeat));

wss.on("connection", (socket, request) => {
  const peer = request.socket.remoteAddress;
  const loopbackPeer = peer === "127.0.0.1" || peer === "::ffff:127.0.0.1" || peer === "::1";
  const loopbackHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(request.headers.host ?? "");
  const loopbackOrigin = !request.headers.origin ||
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(request.headers.origin);
  const secureOrigin = loopbackOrigin || /^https:\/\//i.test(request.headers.origin ?? "");
  const allowGmResume = (request.socket instanceof TLSSocket && request.socket.encrypted && secureOrigin) ||
    (loopbackPeer && loopbackHost && loopbackOrigin &&
      !request.headers.forwarded && !request.headers["x-forwarded-for"] && !request.headers["x-forwarded-proto"]);
  responsiveSockets.add(socket);
  socket.on("pong", () => responsiveSockets.add(socket));
  socket.on("message", (raw) => {
    let rawData: unknown;
    try {
      rawData = JSON.parse(raw.toString());
    } catch (e) {
      send(socket, { type: "error", message: "Mensaje inválido." });
      return;
    }

    try {
      if (
        typeof rawData === "object" &&
        rawData !== null &&
        "type" in rawData &&
        typeof (rawData as { type?: unknown }).type === "string" &&
        isDemoCommandType((rawData as { type: string }).type)
      ) {
        const demoValidation = validateDemoCommand(rawData);
        if (!demoValidation.ok) {
          send(socket, { type: "error", message: demoValidation.error });
          return;
        }
        handleDemoCommand(socket, demoValidation.data);
        return;
      }

      if (typeof rawData === "object" && rawData !== null && "type" in rawData && rawData.type === "resume-gm-session") {
        const parsed = resumeGmSessionSchema.safeParse(rawData);
        if (!allowGmResume || !parsed.success) {
          send(socket, { type: "gm-resume-rejected", reason: "unavailable" });
          return;
        }
        const result = resumeGmSession(socket, parsed.data.roomCode, parsed.data.token);
        if (result.kind === "resumed") {
          send(socket, { type: "hello", participant: result.participant, room: result.room, catalog: gameCatalog });
        } else {
          send(socket, { type: "gm-resume-rejected", reason: result.kind });
        }
        return;
      }

      const validation = validateClientCommand(rawData);
      if (!validation.success) {
        send(socket, { type: "error", message: validation.error });
        return;
      }
      dispatchCommand(socket, validation.data, allowGmResume);
    } catch (error) {
      send(socket, { type: "error", message: error instanceof Error ? error.message : "Error interno de servidor." });
    }
  });
  socket.on("close", () => {
    destroyDemoSessionBySocket(socket);
    clients.delete(socket);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("D&D Tactical server listening on " + (tlsCert ? "https" : "http") + "://localhost:" + PORT);
});
