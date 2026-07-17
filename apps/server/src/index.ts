import cors from "cors";
import express from "express";
import http from "node:http";
import { WebSocketServer } from "ws";
import type { ClientCommand } from "@dnd-tactical/shared";
import { dispatchCommand } from "./commands/dispatcher.js";
import { clients, send, resetAllRoomsForTest } from "./room/roomStore.js";
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

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let rawData: unknown;
    try {
      rawData = JSON.parse(raw.toString());
    } catch (e) {
      send(socket, { type: "error", message: "Mensaje inválido." });
      return;
    }

    try {
      const validation = validateClientCommand(rawData);
      if (!validation.success) {
        send(socket, { type: "error", message: validation.error });
        return;
      }
      dispatchCommand(socket, validation.data);
    } catch (error) {
      send(socket, { type: "error", message: error instanceof Error ? error.message : "Error interno de servidor." });
    }
  });
  socket.on("close", () => clients.delete(socket));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("D&D Tactical server listening on http://localhost:" + PORT);
});
