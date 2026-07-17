import type { CombatRoom } from "@dnd-tactical/shared";

export function CombatLog({ room }: { room: CombatRoom }) {
  return <section className="log-panel">
    <div className="panel-title">Log de combate</div>
    <ol>{room.log.map((entry) => <li key={entry.id} className={entry.kind}>{entry.message}</li>)}</ol>
  </section>;
}
