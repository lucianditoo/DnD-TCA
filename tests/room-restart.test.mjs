import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

test("reinicio real recupera al GM original y conserva el descarte de checkpoints", { timeout: 25_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "dnd-restart-"));
  const file = join(dir, "room-history.json");
  const port = await freePort();
  let child;
  let socket;
  let lan;

  async function start() {
    const entry = 'process.on("message", signal => { if (signal === "SIGINT") process.emit(signal); }); await import("./apps/server/src/index.ts");';
    child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", entry], {
      env: { ...process.env, PORT: String(port), TEST_MODE: "true", DND_ROOM_STORE_PATH: file },
      stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true,
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error("El servidor salió antes de escuchar");
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
      } catch {}
      if (attempt === 99) throw new Error("El servidor no inició");
      await delay(50);
    }
    socket = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(socket, "open");
  }

  async function stop(gracefully = true) {
    socket?.terminate();
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    if (!gracefully) {
      child.kill("SIGKILL");
      await exited;
      return;
    }
    // Windows does not deliver POSIX signals to another process. Invoke the
    // real server's SIGINT handler in the child and verify it exits cleanly.
    const timeout = setTimeout(() => child.kill("SIGKILL"), 3_000);
    try {
      child.send("SIGINT");
      assert.deepEqual(await exited, [0, null]);
    } finally {
      clearTimeout(timeout);
    }
  }

  function command(payload, expected) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { socket.off("message", onMessage); reject(new Error("No llegó " + expected)); }, 2500);
      function onMessage(raw) {
        const event = JSON.parse(String(raw));
        if (![expected, "error", "gm-resume-rejected"].includes(event.type)) return;
        clearTimeout(timeout);
        socket.off("message", onMessage);
        if (event.type === expected) resolve(event);
        else reject(new Error("Se esperaba " + expected + ", llegó " + event.type + ": " + (event.message ?? event.reason)));
      }
      socket.on("message", onMessage);
      socket.send(JSON.stringify(payload));
    });
  }

  try {
    await start();
    const { participant, room, gmResumeToken } = await command({ type: "create-room", name: "GM reinicio" }, "hello");
    assert.ok(gmResumeToken);
    let version = room.stateVersion;
    async function apply(type, details = {}) {
      const event = await command({ type, roomCode: room.code, actorId: participant.id,
        ...(type !== "gm-undo-turn" && { stateVersion: version }), ...details }, "room-update");
      version = event.room.stateVersion;
      return event.room;
    }
    await apply("add-catalog-combatant", { category: "heroes", templateId: "bane" });
    const prepared = await apply("add-catalog-combatant", { category: "enemies", templateId: "canocrock" });
    const [hero, enemy] = prepared.combatants;
    await apply("set-initiative", { combatantId: hero.id, initiative: 20 });
    await apply("set-initiative", { combatantId: enemy.id, initiative: 10 });
    await apply("sort-initiative");
    await apply("end-turn");
    await apply("end-turn");
    const prior = await apply("gm-undo-turn", { steps: 1 });
    assert.equal(prior.currentTurn.combatantId, enemy.id);
    lan = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Host: "lan.example" } });
    await once(lan, "open");
    const lanHello = once(lan, "message");
    lan.send(JSON.stringify({ type: "create-room", name: "GM LAN" }));
    const [rawLan] = await lanHello;
    const lanRoom = JSON.parse(String(rawLan));
    assert.equal(lanRoom.type, "hello");
    assert.equal(lanRoom.gmResumeToken, undefined);
    lan.terminate();
    await stop(false);

    const saved = await readFile(file, "utf8");
    assert.ok(!saved.includes(gmResumeToken));
    assert.deepEqual(Object.keys(JSON.parse(saved).rooms), [room.code]);

    await start();
    const invalid = await command({ type: "resume-gm-session", roomCode: room.code, token: "a".repeat(43) }, "gm-resume-rejected");
    assert.equal(invalid.reason, "unavailable");
    const resumed = await command({ type: "resume-gm-session", roomCode: room.code, token: gmResumeToken }, "hello");
    assert.deepEqual(resumed.participant, participant);
    assert.deepEqual(resumed.room, prior);
    const restored = await apply("gm-undo-turn", { steps: 1 });
    assert.equal(restored.currentTurn.combatantId, hero.id);
    assert.equal(restored.stateVersion, 2);
    const rejected = await command({ type: "gm-undo-turn", roomCode: room.code, actorId: participant.id, steps: 1 }, "error");
    assert.match(rejected.message, /historial suficiente/);

    await stop();
    const expired = JSON.parse(await readFile(file, "utf8"));
    expired.rooms[room.code].expiresAt = Date.now() - 1;
    await writeFile(file, JSON.stringify(expired), "utf8");
    await start();
    const result = await command({ type: "resume-gm-session", roomCode: room.code, token: gmResumeToken }, "gm-resume-rejected");
    assert.equal(result.reason, "unavailable");
  } finally {
    lan?.terminate();
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
