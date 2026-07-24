import { useState, useMemo } from "react";
import { lifeStatus, createCombatRulesSnapshot, type CombatOutcome, type Combatant, type LifeStatus, type Position } from "@dnd-tactical/shared";
import { ActionsPanel } from "./components/ActionsPanel/ActionsPanel";
import { Board } from "./components/Board/Board";
import { CombatLog } from "./components/CombatLog/CombatLog";
import { CombatantsPanel } from "./components/CombatantsPanel/CombatantsPanel";
import { ConnectionPanel } from "./components/ConnectionPanel/ConnectionPanel";
import { ResultScreen } from "./components/ResultScreen/ResultScreen";
import { useBoardSelection } from "./hooks/useBoardSelection";
import { useCombatActions } from "./hooks/useCombatActions";
import { useStoredProfiles } from "./hooks/useStoredProfiles";
import { useWebSocketRoom } from "./hooks/useWebSocketRoom";
import { ProfilesPage } from "./pages/ProfilesPage";
import { applicableEffectOptions, canParticipantControlCombatant, canParticipantEditInitiative, cellKey, getActiveEffectViews, isCombatantDestinationOccupied, isLegalNextPathStep, phaseLabel, sameCell, type ActionMode, type TacticMode, getCardinalDirection } from "./viewModel";
import { SpellsCatalog } from "@dnd-tactical/shared";

export function App() {
  if (window.location.pathname === "/profiles") return <ProfilesPage />;
  return <CombatApp />;
}

function CombatApp() {
  const [targetId, setTargetId] = useState<string>("");
  const [aidAllyId, setAidAllyId] = useState<string>("");
  const [d20Roll, setD20Roll] = useState("15");
  const [autoD20, setAutoD20] = useState(false);
  const [damage, setDamage] = useState("");
  const [autoDamage, setAutoDamage] = useState(false);
  const [stabilizationRoll, setStabilizationRoll] = useState("10");
  const [autoStabilizationRoll, setAutoStabilizationRoll] = useState(false);
  const [healAmount, setHealAmount] = useState("8");
  const [hpOverride, setHpOverride] = useState("");
  const [hpMaxOverride, setHpMaxOverride] = useState("");
  const [gmNote, setGmNote] = useState("");
  const [gmMoveMode, setGmMoveMode] = useState(false);
  const [gmMoveTargetId, setGmMoveTargetId] = useState("");
  const [fightingDefensively, setFightingDefensivelyState] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("inspect");
  const [tacticMode, setTacticMode] = useState<TacticMode>("total-defense");
  const [movementPath, setMovementPath] = useState<Position[]>([]);
  const [withdrawArmed, setWithdrawArmed] = useState(false);
  const [runArmed, setRunArmed] = useState(false);
  const [targetPosition, setTargetPosition] = useState<Position | null>(null);
  const [confirmD20, setConfirmD20] = useState("15");
  const [criticalDamage, setCriticalDamage] = useState("");
  const [selectedAbilityId, setSelectedAbilityId] = useState("");
  const [effectToApplyId, setEffectToApplyId] = useState("");
  const [effectDurationPreset, setEffectDurationPreset] = useState<"permanent" | "until_target_turn_end">("permanent");
  const { name, setName, roomCode, setRoomCode, mode, setMode, participant, room, catalog, selectedId, setSelectedId, selectedHeroTemplateId, setSelectedHeroTemplateId, selectedEnemyTemplateId, setSelectedEnemyTemplateId, error, setError, createRoom, joinRoom, roomCommand } = useWebSocketRoom({
    onHello: () => setActionMode("inspect"),
    onActiveTurnChanged: () => {
      setActionMode("inspect");
      setTargetId("");
      setAidAllyId("");
      setSelectedAbilityId("");
      setMovementPath([]);
    }
  });
  const rulesSnapshot = useMemo(() => room ? createCombatRulesSnapshot(room) : null, [room]);
  const activeEffects = useMemo(() => (room && selectedId) ? getActiveEffectViews(room, selectedId) : [], [room, selectedId]);
  const { active, selected, targets, enemyTargets, aidAllies, pendingAidBuffs, gmMoveTarget, selectedAbility, abilityTargets, targetDistanceFeet, rangePreview, pendingOpportunities, hasPendingOpportunities, chargePreviewPath, bullRushPreviewPath, displayedPath, movementPathCost, displayedPathCosts, highlightedCells } = useBoardSelection({ room, snapshot: rulesSnapshot, selectedId, participant, actionMode, tacticMode, selectedAbilityId, movementPath, gmMoveMode, gmMoveTargetId, targetId, withdrawArmed, runArmed });
  const { getD20Roll, getDamageRoll } = useCombatActions({ autoD20, d20Roll, setD20Roll, autoDamage, damage, setDamage });
  const { heroes: savedHeroProfiles, enemies: savedEnemyProfiles, toCombatTemplate } = useStoredProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const canControlSelected = canParticipantControlCombatant(participant, selected);
  const canEndCurrentTurn = participant?.role === "gm" || canParticipantControlCombatant(participant, active);

  function addCatalogCombatant(category: "heroes" | "enemies") {
    if (!room || !participant) return;
    const templateId = category === "heroes" ? selectedHeroTemplateId : selectedEnemyTemplateId;
    if (!templateId) return;
    roomCommand({ type: "add-catalog-combatant", roomCode: room.code, actorId: participant.id, category, templateId });
  }

  function addProfileCombatant() {
    if (!room || !participant || !selectedProfileId) return;
    const profile = [...savedHeroProfiles, ...savedEnemyProfiles].find((item) => item.id === selectedProfileId);
    if (!profile) return;
    roomCommand({ type: "add-profile-combatant", roomCode: room.code, actorId: participant.id, profile: toCombatTemplate(profile) });
  }

  function setInitiative(combatant: Combatant, value: string) {
    if (!room || !participant) return;
    const initiative = Number(value);
    if (!Number.isFinite(initiative)) return;
    roomCommand({ type: "set-initiative", roomCode: room.code, actorId: participant.id, combatantId: combatant.id, initiative });
  }

  function sortInitiative() {
    if (!room || !participant) return;
    roomCommand({ type: "sort-initiative", roomCode: room.code, actorId: participant.id });
    setActionMode("inspect");
    setMovementPath([]);
  }

  function declareDodgeTarget(combatantId: string, dodgeTargetId: string | null) {
    if (!room || !participant) return;
    roomCommand({ type: "declare-dodge-target", roomCode: room.code, actorId: participant.id, combatantId, targetId: dodgeTargetId });
  }

  function selectActionMode(mode: ActionMode) {
    setGmMoveMode(false);
    setActionMode(mode);
    if (mode !== "move") setMovementPath([]);
  }

  function moveSelected(to: Position, path?: Position[]) {
    if (!room || !participant || !selected) return;
    roomCommand({ type: "move-combatant", roomCode: room.code, actorId: participant.id, combatantId: selected.id, to, path });
  }

  function gmMoveSelected(to: Position) {
    if (!room || !participant || !gmMoveTarget) return;
    roomCommand({ type: "gm-move-combatant", roomCode: room.code, actorId: participant.id, combatantId: gmMoveTarget.id, to });
  }

  function handleCellClick(position: Position, token: Combatant | undefined) {
    if (!room || !selected) return;
    if (gmMoveMode && participant?.role === "gm") {
      if (token && token.id !== gmMoveTarget?.id) { setGmMoveTargetId(token.id); return; }
      if (!highlightedCells.has(cellKey(position))) return;
      gmMoveSelected(position);
      return;
    }
    if (actionMode === "move") {
      if (!canControlSelected) return;
      if (!highlightedCells.has(cellKey(position))) return;
      if (room.phase === "preparation") { moveSelected(position); return; }
      if (token && token.id !== selected.id) return;
      setMovementPath((current) => {
        const previous = current[current.length - 2];
        const last = current[current.length - 1];
        if (last && sameCell(last, position)) return current;
        if (previous && sameCell(previous, position)) return current.slice(0, -1);
        return [...current, position];
      });
      return;
    }
    if ((actionMode === "attack" || actionMode === "ability") && token && token.id !== selected.id) {
      setTargetId(token.id);
      if (actionMode === "ability") setTargetPosition(position);
      return;
    }
    if (actionMode === "ability" && (!token || token.id === selected.id)) {
      setTargetPosition(position);
      return;
    }
    if (token && room.phase !== "active") { setSelectedId(token.id); setTargetId(""); }
    if (token && room.phase === "active" && token.id !== selected.id) setTargetId(token.id);
  }

  function attack() {
    if (!room || !participant || !selected || !targetId) return;
    roomCommand({
      type: "resolve-attack",
      roomCode: room.code,
      actorId: participant.id,
      attackerId: selected.id,
      targetId,
      d20Roll: autoD20 ? null : getD20Roll(),
      damage: autoD20 ? null : getDamageRoll(selected),
      isAutoRoll: autoD20
    });
    clearActionOverlays();
  }

  function declareAttackMode(mode: "standard" | "full", defensive: boolean) {
    if (!room || !participant || !selected) return;
    roomCommand({
      type: "declare-attack-mode",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id,
      mode,
      defensive
    });
  }

  function cancelAttackMode() {
    if (!room || !participant || !selected) return;
    roomCommand({
      type: "cancel-attack-mode",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id
    });
  }

  function setFightingDefensively() {
    setFightingDefensivelyState((current) => !current);
  }

  function useTacticalAction(action: "total-defense") {
    if (!room || !participant || !selected) return;
    roomCommand({ type: "use-tactical-action", roomCode: room.code, actorId: participant.id, combatantId: selected.id, action });
    clearActionOverlays();
  }

  function charge() {
    if (!room || !participant || !selected || !targetId) return;
    roomCommand({
      type: "use-tactical-action",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id,
      action: "charge",
      targetId,
      d20Roll: getD20Roll(),
      damage: getDamageRoll(selected)
    });
    clearActionOverlays();
  }

  function trip() {
    if (!room || !participant || !selected || !targetId) return;
    const d20TouchRoll = getD20Roll();
    const d20OpposedRoll = getD20Roll();
    roomCommand({
      type: "resolve-special-maneuver",
      roomCode: room.code,
      actorId: participant.id,
      maneuver: {
        type: "trip",
        attackerId: selected.id,
        targetId,
        d20TouchRoll,
        d20OpposedRoll
      }
    });
    clearActionOverlays();
  }

  function bullRush() {
    if (!room || !participant || !selected || !targetId) return;
    roomCommand({
      type: "resolve-special-maneuver",
      roomCode: room.code,
      actorId: participant.id,
      maneuver: {
        type: "bull_rush",
        attackerId: selected.id,
        targetId,
        d20OpposedRoll: getD20Roll()
      }
    });
    clearActionOverlays();
  }

  function grapple() {
    if (!room || !participant || !selected || !targetId) return;
    roomCommand({
      type: "resolve-special-maneuver",
      roomCode: room.code,
      actorId: participant.id,
      maneuver: {
        type: "grapple",
        attackerId: selected.id,
        targetId,
        d20TouchRoll: autoD20 ? null : getD20Roll(),
        d20OpposedRoll: autoD20 ? null : getD20Roll(),
        isAutoRoll: autoD20
      }
    });
    clearActionOverlays();
  }

  function grappleEscape(escapeType: import("@dnd-tactical/shared").GrappleEscapeType) {
    if (!room || !participant || !selected) return;
    roomCommand({
      type: "resolve-grapple-escape",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id,
      escapeType,
      d20Roll: autoD20 ? null : getD20Roll(),
      isAutoRoll: autoD20
    });
    clearActionOverlays();
  }

  function standUp() {
    if (!room || !participant || !selected) return;
    roomCommand({
      type: "use-tactical-action",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id,
      action: "stand-up",
      tumbleRoll: getD20Roll(),
      isAutoRoll: autoD20
    });
    clearActionOverlays();
  }

  function aidAnother() {
    if (!room || !participant || !selected || !aidAllyId || !targetId) return;
    roomCommand({
      type: "use-tactical-action",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id,
      action: "aid-another",
      allyId: aidAllyId,
      targetId,
      d20Roll: getD20Roll()
    });
    clearActionOverlays();
  }

  function fiveFootStep() {
    if (!room || !participant || !selected || movementPath.length === 0) return;
    const destination = movementPath[movementPath.length - 1];
    roomCommand({
      type: "use-tactical-action",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id,
      action: "five-foot-step",
      to: destination
    });
    clearActionOverlays();
  }

  function chooseAidBonus(buffId: string, choice: "attack" | "ac") {
    if (!room || !participant || !selected) return;
    roomCommand({ type: "choose-aid-bonus", roomCode: room.code, actorId: participant.id, combatantId: selected.id, buffId, choice });
  }

  function confirmMovementPath() {
    if (!room || movementPath.length === 0) return;
    const destination = movementPath[movementPath.length - 1];
    // MOVE-WITHDRAW: con la Retirada armada, la ruta dibujada se envía como intención
    // táctica; el servidor deriva presupuesto, huella exenta, AdO y economía.
    if (withdrawArmed && participant && selected) {
      roomCommand({
        type: "use-tactical-action",
        roomCode: room.code,
        actorId: participant.id,
        combatantId: selected.id,
        action: "withdraw",
        to: destination,
        path: movementPath
      });
      clearActionOverlays();
      return;
    }
    // MOVE-RUN: con Correr armado, solo se envia el destino — el servidor deriva el camino
    // canonico en linea recta, el presupuesto x4/x3 y la economia; no se confia en la ruta
    // dibujada por el cliente para esta accion.
    if (runArmed && participant && selected) {
      roomCommand({
        type: "use-tactical-action",
        roomCode: room.code,
        actorId: participant.id,
        combatantId: selected.id,
        action: "run",
        to: destination
      });
      clearActionOverlays();
      return;
    }
    moveSelected(destination, movementPath);
    clearActionOverlays();
  }

  function undoMovementStep() {
    setMovementPath((current) => current.slice(0, -1));
  }

  function resolveOpportunity(opportunityId: string) {
    if (!room || !participant) return;
    const opportunity = room.pendingOpportunityAttacks.find((item) => item.id === opportunityId);
    const attacker = room.combatants.find((combatant) => combatant.id === opportunity?.attackerId);
    if (!attacker) return;
    roomCommand({
      type: "resolve-opportunity-attack",
      roomCode: room.code,
      actorId: participant.id,
      opportunityId,
      d20Roll: autoD20 ? null : getD20Roll(),
      damage: autoD20 ? null : getDamageRoll(attacker),
      isAutoRoll: autoD20
    });
  }

  function rollStabilization() {
    if (!room || !participant || !selected) return;
    if (!canControlSelected || room.currentTurn.combatantId !== selected.id || room.currentTurn.usedStabilization) return;
    const d100Roll = autoStabilizationRoll ? Math.floor(Math.random() * 100) + 1 : Number(stabilizationRoll);
    if (autoStabilizationRoll) setStabilizationRoll(String(d100Roll));
    roomCommand({
      type: "roll-stabilization",
      roomCode: room.code,
      actorId: participant.id,
      combatantId: selected.id,
      d100Roll
    });
  }

  function healSelected() {
    if (!room || !participant || !selected) return;
    const healTargetId = targetId || selected.id;
    roomCommand({ type: "heal-combatant", roomCode: room.code, actorId: participant.id, combatantId: healTargetId, amount: Number(healAmount), source: selected.abilities.some((ability) => ability.id === "cure-light-wounds") ? "Cure Light Wounds" : "Manual" });
  }

  function useAbility(abilityId = selectedAbilityId || selected?.abilities[0]?.id || "") {
    if (!room || !participant || !selected) return;
    const ability = selected.abilities.find((item) => item.id === abilityId);
    if (!ability) return;
    const abilityTargetId = targetId || (ability.target === "self" ? selected.id : "");
    if (!abilityTargetId) { setError("Elegi un objetivo para usar " + ability.name + "."); return; }
    if (ability.resolution.kind === "attack-roll") {
      const abilityDamage = rollAbilityDamage(ability.resolution.damageExpression, Number(damage || 0));
      if (autoDamage) setDamage(String(abilityDamage));
      roomCommand({ type: "resolve-ability-attack", roomCode: room.code, actorId: participant.id, casterId: selected.id, targetId: abilityTargetId, abilityId, d20Roll: getD20Roll(), damage: abilityDamage });
    } else {
      const amount = ability.resolution.kind === "healing" ? Number(healAmount) : ability.resolution.kind === "automatic-damage" ? Number(damage || 0) : null;
      roomCommand({ type: "use-ability", roomCode: room.code, actorId: participant.id, casterId: selected.id, targetId: abilityTargetId, abilityId, amount });
    }
    clearActionOverlays();
  }

  function castSpell(slotId: string) {
    if (!room || !participant || !selected) return;
    const slot = selected.preparedSpells?.find((s) => s.slotId === slotId);
    if (!slot || slot.isExpended) return;
    
    const spell = SpellsCatalog.get(slot.spellId);
    if (!spell) return;
    
    if (spell.target === "area") {
      if (!targetPosition) { setError("Elegi una posicion objetivo (click en el tablero) para el area de efecto."); return; }
      roomCommand({
        type: "cast-spell",
        roomCode: room.code,
        actorId: participant.id,
        casterId: selected.id,
        direction: getCardinalDirection(selected.position, targetPosition),
        targetPosition,
        slotId: slot.slotId,
        d20Roll: null,
        amount: null
      });
    } else {
      const spellTargetId = targetId || selected.id;
      if (!spellTargetId) { setError("Elegi un objetivo para lanzar el conjuro."); return; }
      
      roomCommand({
        type: "cast-spell",
        roomCode: room.code,
        actorId: participant.id,
        casterId: selected.id,
        targetId: spellTargetId,
        slotId: slot.slotId,
        d20Roll: null,
        amount: null
      });
    }
    clearActionOverlays();
  }

  function rollAbilityDamage(expression: string, manual: number): number {
    if (!autoDamage) return manual;
    const match = expression.match(/^(\d+)d(\d+)$/i);
    if (!match) return manual;
    const count = Number(match[1]);
    const sides = Number(match[2]);
    let total = 0;
    for (let index = 0; index < count; index += 1) total += Math.floor(Math.random() * sides) + 1;
    return total;
  }

  function clearActionOverlays() {
    setActionMode("inspect");
    setMovementPath([]);
    setTargetId("");
    setWithdrawArmed(false);
    setRunArmed(false);
  }

  function gmSetHp() {
    if (!room || !participant || !selected) return;
    roomCommand({ type: "gm-set-hp", roomCode: room.code, actorId: participant.id, combatantId: selected.id, hpCurrent: Number(hpOverride || selected.hpCurrent), hpMax: hpMaxOverride.trim() ? Number(hpMaxOverride) : undefined });
  }

  function gmSetStatus(status: LifeStatus) {
    if (!room || !participant || !selected) return;
    roomCommand({ type: "gm-set-status", roomCode: room.code, actorId: participant.id, combatantId: selected.id, status });
  }

  function gmClearOpportunities() {
    if (!room || !participant) return;
    roomCommand({ type: "gm-clear-opportunities", roomCode: room.code, actorId: participant.id });
  }

  function gmAddNote() {
    if (!room || !participant) return;
    roomCommand({ type: "gm-add-log", roomCode: room.code, actorId: participant.id, message: gmNote });
    setGmNote("");
  }

  function gmForceOutcome(outcome: CombatOutcome) {
    if (!room || !participant) return;
    roomCommand({ type: "gm-force-outcome", roomCode: room.code, actorId: participant.id, outcome });
  }

  function applyEffect() {
    if (!room || !participant || !selected || !effectToApplyId) return;
    roomCommand({
      type: "gm-apply-effect",
      roomCode: room.code,
      actorId: participant.id,
      targetId: selected.id,
      effectId: effectToApplyId,
      ...(effectDurationPreset === "until_target_turn_end" ? { durationPreset: effectDurationPreset } : {})
    });
    setEffectToApplyId("");
  }

  function removeEffect(instanceId: string) {
    if (!room || !participant) return;
    roomCommand({ type: "gm-remove-effect", roomCode: room.code, actorId: participant.id, instanceId });
  }

  function toggleGmMoveMode() {
    if (!selected) return;
    setGmMoveTargetId((current) => current || selected.id);
    setGmMoveMode((current) => !current);
    setActionMode("inspect");
    setMovementPath([]);
    setTargetId("");
  }

  function endTurn() {
    if (!room || !participant) return;
    roomCommand({ type: "end-turn", roomCode: room.code, actorId: participant.id });
  }



  if (!participant || !room) {
    return <ConnectionPanel name={name} roomCode={roomCode} mode={mode} error={error} onNameChange={setName} onRoomCodeChange={setRoomCode} onModeChange={setMode} onCreateRoom={createRoom} onJoinRoom={joinRoom} />;
  }

  if (room.phase === "finished" || room.outcome !== "ongoing") {
    return <ResultScreen room={room} />;
  }

  const threat = room.activeAttackThreat;
  const threatAttacker = threat ? room.combatants.find((c) => c.id === threat.attackerId) : null;
  const threatTarget = threat ? room.combatants.find((c) => c.id === threat.targetId) : null;
  const isAttackerControl = threatAttacker ? canParticipantControlCombatant(participant, threatAttacker) : false;
  const isGM = participant?.role === "gm";
  const showThreatModal = threat && (isAttackerControl || isGM);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">Sala {room.code} - {phaseLabel(room.phase)}</p><h1>{room.phase === "preparation" ? "Preparacion" : "Ronda " + room.round}</h1></div>
        <div className="topbar-actions"><a className="ghost-link" href="/profiles">Perfiles</a><div className="turn-pill">{room.phase === "active" ? "Turno: " + (active?.name ?? "sin iniciativa") : "Carga combatientes e iniciativas"}</div></div>
      </header>

      <section className="layout">
        <CombatantsPanel room={room} snapshot={rulesSnapshot!} catalog={catalog} active={active} selected={selected} participant={participant} savedHeroProfiles={savedHeroProfiles} savedEnemyProfiles={savedEnemyProfiles} selectedProfileId={selectedProfileId} selectedHeroTemplateId={selectedHeroTemplateId} selectedEnemyTemplateId={selectedEnemyTemplateId} canEditInitiative={(combatant) => canParticipantEditInitiative(participant, combatant)} canStartCombat={participant.role === "gm"} onProfileChange={setSelectedProfileId} onAddProfileCombatant={addProfileCombatant} onHeroTemplateChange={setSelectedHeroTemplateId} onEnemyTemplateChange={setSelectedEnemyTemplateId} onAddCatalogCombatant={addCatalogCombatant} onSetInitiative={setInitiative} onSortInitiative={sortInitiative} onSelectCombatant={(id) => { setSelectedId(id); setTargetId(""); setMovementPath([]); }} attackerId={targetId || undefined} canControlSelected={canControlSelected} onDeclareDodgeTarget={declareDodgeTarget} />

        <Board room={room} snapshot={rulesSnapshot!} selected={selected} targetId={targetId} displayedPath={displayedPath} displayedPathCosts={displayedPathCosts} highlightedCells={highlightedCells} chargePreviewPath={chargePreviewPath ?? bullRushPreviewPath} routeFootprintCombatant={tacticMode === "bull-rush" ? room.combatants.find((combatant) => combatant.id === targetId) ?? null : selected} onCellClick={handleCellClick} actionMode={actionMode} selectedAbility={selectedAbility} targetPosition={targetPosition} />

        <ActionsPanel room={room} snapshot={rulesSnapshot!} selected={selected} participantRole={participant.role} canControlSelected={canControlSelected} canEndCurrentTurn={canEndCurrentTurn} canResolveOpportunity={(attacker) => participant.role === "gm" || canParticipantControlCombatant(participant, attacker ?? null)} actionMode={actionMode} tacticMode={tacticMode} targetId={targetId} targets={targets} enemyTargets={enemyTargets} aidAllies={aidAllies} pendingAidBuffs={pendingAidBuffs} selectedAbility={selectedAbility} abilityTargets={abilityTargets} targetDistanceFeet={targetDistanceFeet} rangePreview={rangePreview} d20Roll={d20Roll} autoD20={autoD20} damage={damage} autoDamage={autoDamage} fightingDefensively={fightingDefensively} selectedAbilityId={selectedAbilityId} stabilizationRoll={stabilizationRoll} autoStabilizationRoll={autoStabilizationRoll} healAmount={healAmount} hpOverride={hpOverride} hpMaxOverride={hpMaxOverride} gmNote={gmNote} gmMoveTarget={gmMoveTarget} gmMoveMode={gmMoveMode} movementPathLength={movementPath.length} movementPathCost={movementPathCost} isMoveDestinationOccupied={movementPath[movementPath.length - 1] && selected ? isCombatantDestinationOccupied(room, rulesSnapshot!, selected, movementPath[movementPath.length - 1]!) : false} hasPendingOpportunities={hasPendingOpportunities} pendingOpportunities={pendingOpportunities} chargePreviewPath={chargePreviewPath} error={error} onSelectActionMode={selectActionMode} onStabilizationRollChange={setStabilizationRoll} onAutoStabilizationRollChange={setAutoStabilizationRoll} onRollStabilization={rollStabilization} onUndoMovementStep={undoMovementStep} onClearMovementPath={() => setMovementPath([])} onConfirmMovementPath={confirmMovementPath} onFiveFootStep={fiveFootStep} withdrawArmed={withdrawArmed} onToggleWithdraw={() => { setWithdrawArmed((armed) => !armed); setRunArmed(false); setMovementPath([]); }} runArmed={runArmed} onToggleRun={() => { setRunArmed((armed) => !armed); setWithdrawArmed(false); setMovementPath([]); }} onStandUp={standUp} onTargetChange={setTargetId} onD20Change={setD20Roll} onAutoD20Change={setAutoD20} onDamageChange={setDamage} onAutoDamageChange={setAutoDamage} onDeclareAttackMode={declareAttackMode} onCancelAttackMode={cancelAttackMode} onToggleFightingDefensively={setFightingDefensively} onAttack={attack} onTacticModeChange={(mode) => { setTacticMode(mode); setTargetId(""); setAidAllyId(""); }} onUseTacticalAction={useTacticalAction} onCharge={charge} onTrip={trip} onBullRush={bullRush} onGrapple={grapple} onGrappleEscape={grappleEscape} aidAllyId={aidAllyId} onAidAllyChange={setAidAllyId} onAidAnother={aidAnother} onChooseAidBonus={chooseAidBonus} onSelectedAbilityChange={(id) => { setSelectedAbilityId(id); setTargetId(""); }} onHealAmountChange={setHealAmount} onUseAbility={useAbility} onCastSpell={castSpell} onEndTurn={endTurn} onGmMoveTargetChange={setGmMoveTargetId} onToggleGmMoveMode={toggleGmMoveMode} onHealSelected={healSelected} onHpOverrideChange={setHpOverride} onHpMaxOverrideChange={setHpMaxOverride} onGmSetHp={gmSetHp} onGmSetStatus={gmSetStatus} onGmClearOpportunities={gmClearOpportunities} onGmForceOutcome={gmForceOutcome} onGmNoteChange={setGmNote} onGmAddNote={gmAddNote} onResolveOpportunity={resolveOpportunity} activeEffects={activeEffects} applicableEffects={applicableEffectOptions} effectToApplyId={effectToApplyId} effectDurationPreset={effectDurationPreset} onEffectToApplyChange={setEffectToApplyId} onEffectDurationPresetChange={setEffectDurationPreset} onApplyEffect={applyEffect} onRemoveEffect={removeEffect} />
      </section>

      <CombatLog room={room} />

      {threat && room.phase === "critical-confirmation" && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h2>💥 ¡Amenaza de Crítico!</h2>
            <p>
              <strong>{threatAttacker?.name}</strong> amenaza con un golpe crítico contra <strong>{threatTarget?.name}</strong> usando <strong>{threat.weaponName}</strong>.
            </p>
            <div className="stats-breakdown" style={{ margin: "1rem 0" }}>
              <p>Rango de amenaza: <strong>{threat.criticalThreatFrom}-20</strong> (Tirada inicial: d20={threat.initialD20Roll})</p>
              <p>Multiplicador de daño: <strong>x{threat.criticalMultiplier}</strong></p>
              <p>Daño normal a aplicar si falla: <strong>{threat.normalDamageBundle.total} HP</strong></p>
              <p>Modificador de ataque para confirmación: <strong>+{threat.attackBonusTotal}</strong></p>
              <p>CA del objetivo: <strong>{threat.targetArmorClass}</strong></p>
            </div>
            
            {showThreatModal ? (
              <div className="form-group-row">
                <div className="form-group">
                  <label htmlFor="confirm-d20">d20 de Confirmación</label>
                  <input
                    id="confirm-d20"
                    type="number"
                    min="1"
                    max="20"
                    value={confirmD20}
                    onChange={(e) => setConfirmD20(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-damage">Daño Crítico Total (x{threat.criticalMultiplier})</label>
                  <input
                    id="confirm-damage"
                    type="number"
                    min="0"
                    placeholder={String(threat.normalDamageBundle.components.reduce((sum, component) => sum + component.amount * (component.neverMultiply ? 1 : threat.criticalMultiplier), 0))}
                    value={criticalDamage}
                    onChange={(e) => setCriticalDamage(e.target.value)}
                  />
                </div>
                <div className="form-actions" style={{ marginTop: "1rem", display: "flex", gap: "10px" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      roomCommand({
                        type: "resolve-attack-confirmation",
                        roomCode: room.code,
                        actorId: participant.id,
                        d20Roll: autoD20 ? null : Number(confirmD20),
                        damage: autoD20 ? null : criticalDamage.trim() ? Number(criticalDamage) : null,
                        isAutoRoll: autoD20
                      });
                      setCriticalDamage("");
                    }}
                  >
                    Confirmar Crítico
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      roomCommand({
                        type: "cancel-attack-threat",
                        roomCode: room.code,
                        actorId: participant.id
                      });
                    }}
                  >
                    Cancelar Amenaza
                  </button>
                </div>
              </div>
            ) : (
              <div className="waiting-message">
                <p>⌛ Esperando que {threatAttacker?.name} (o el GM) resuelva la confirmación del crítico...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
