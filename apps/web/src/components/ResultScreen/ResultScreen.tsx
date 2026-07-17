import { BarChart3, Footprints, Skull, Swords, Trophy } from "lucide-react";
import { lifeStatus, lifeStatusLabel, type CombatRoom, type Combatant } from "@dnd-tactical/shared";
import { Stat } from "../common";

export function ResultScreen({ room }: { room: CombatRoom }) {
  const players = room.combatants.filter((combatant) => combatant.type === "player");
  const enemies = room.combatants.filter((combatant) => combatant.type === "enemy");
  const totalDamage = room.combatants.reduce((sum, combatant) => sum + combatant.stats.damageDealt, 0);
  const totalDistance = room.combatants.reduce((sum, combatant) => sum + combatant.stats.distanceMovedFeet, 0);
  const totalKills = room.combatants.reduce((sum, combatant) => sum + combatant.stats.kills, 0);
  const title = room.outcome === "victory" ? "Victoria!" : "TPK!";
  const subtitle = room.outcome === "victory" ? "Todos los enemigos han caido." : "Todos los heroes han muerto.";
  return (
    <main className="end-shell">
      <section className={"end-hero " + room.outcome}>
        <div className="end-title-row">{room.outcome === "victory" ? <Trophy size={34} /> : <Skull size={34} />}<div><p className="eyebrow">Sala {room.code}</p><h1>{title}</h1></div></div>
        <p>{subtitle}</p>
        <div className="summary-grid">
          <Stat icon={<BarChart3 size={16} />} label="Rondas" value={String(room.round)} />
          <Stat icon={<Swords size={16} />} label="Daño total" value={String(totalDamage)} />
          <Stat icon={<Footprints size={16} />} label="Distancia" value={totalDistance + " ft"} />
          <Stat icon={<Skull size={16} />} label="Bajas" value={String(totalKills)} />
        </div>
      </section>
      <section className="results-layout">
        <ResultGroup title="Heroes" combatants={players} />
        <ResultGroup title="Enemigos" combatants={enemies} />
      </section>
      <section className="log-panel end-log">
        <div className="panel-title">Ultimos eventos</div>
        <ol>{room.log.slice(0, 8).map((entry) => <li key={entry.id} className={entry.kind}>{entry.message}</li>)}</ol>
      </section>
    </main>
  );
}

function ResultGroup({ title, combatants }: { title: string; combatants: Combatant[] }) {
  return <section className="result-panel"><div className="panel-title">{title}</div>{combatants.map((combatant) => <article key={combatant.id} className="result-row"><div className="result-name"><span className={"token-dot " + combatant.type}>{combatant.icon}</span><div><strong>{combatant.name}</strong><small>{lifeStatusLabel(lifeStatus(combatant))} - HP {combatant.hpCurrent}/{combatant.hpMax}</small></div></div><div className="result-stats"><span>Daño hecho <strong>{combatant.stats.damageDealt}</strong></span><span>Daño recibido <strong>{combatant.stats.damageTaken}</strong></span><span>Distancia <strong>{combatant.stats.distanceMovedFeet} ft</strong></span><span>Ataques <strong>{combatant.stats.attacksMade}</strong></span><span>Impactos <strong>{combatant.stats.hits}</strong></span><span>Fallos <strong>{combatant.stats.misses}</strong></span><span>Oportunidad <strong>{combatant.stats.opportunityAttacksMade}</strong></span><span>Bajas <strong>{combatant.stats.kills}</strong></span><span>Caidas <strong>{combatant.stats.timesDroppedToZero}</strong></span><span>Curacion <strong>{combatant.stats.healingReceived}</strong></span></div></article>)}</section>;
}
