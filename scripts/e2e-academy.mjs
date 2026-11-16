import assert from "node:assert/strict";
import WebSocket from "ws";

async function connect() {
  const ws = new WebSocket("ws://localhost:3333");
  const inbox = [];
  ws.on("message", data => inbox.push(JSON.parse(data)));
  await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
  return {
    ws,
    send(command) { ws.send(JSON.stringify(command)); },
    async next(type) {
      for (let i = 0; i < 100; i++) {
        const index = inbox.findIndex(event => event.type === type);
        if (index >= 0) return inbox.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      throw new Error("Falta evento " + type);
    }
  };
}
const player = await connect();
const visitor = await connect();
try {
  player.send({ type: "start-academy", scenarioId: "camera" });
  const initial = await player.next("hello");
  assert.equal(initial.room.stateVersion, undefined);
  player.send({ type: "gm-undo-turn", actorId: initial.participant.id, roomCode: initial.room.code, steps: 1 });
  assert.match((await player.next("error")).message, /no disponible en este tutorial/i);
  visitor.send({ type: "join-room", name: "Visitante", role: "player", roomCode: initial.room.code });
  await visitor.next("error");
  player.send({ type: "end-turn", actorId: initial.participant.id, roomCode: initial.room.code });
  assert.equal((await player.next("academy-state")).state.status, "failed");
  player.send({ type: "restart-academy", attemptId: initial.academy.attemptId, extra: true });
  assert.match((await player.next("error")).message, /Comando de Academia inválido/);
  player.send({ type: "restart-academy", attemptId: initial.academy.attemptId });
  const next = await player.next("hello");
  assert.notEqual(next.room.code, initial.room.code);
  player.send({ type: "end-turn", actorId: initial.participant.id, roomCode: initial.room.code });
  await player.next("error");
  player.send({ type: "exit-academy", attemptId: next.academy.attemptId });
  await player.next("academy-exited");
  player.send({ type: "create-room", name: "GM" });
  assert.equal((await player.next("hello")).participant.role, "gm");
  console.log("Academia WebSocket: aislamiento, derrota, reinicio, rechazo obsoleto y salida correctos.");
} finally {
  player.ws.close();
  visitor.ws.close();
}
