import { Footprints, HeartPulse, MousePointer2, Shield, SkipForward, Sparkles, Swords } from "lucide-react";
import { averageWeaponDamageForCombatant, EquipmentCatalog, getAmmunitionState, getEquippedWeaponEntry, getGrappleAttackEligibility, getGrappleEscapePreview, lifeStatus, Rules, calculatePathCostFeet, getAttackContextModifiers, getEffectiveAttackRoutine, getWeaponAttackTypeForTarget, getAttackLineInterception, createCombatRulesSnapshot, canApplySneakAttack, getEffectiveSneakAttackDice, validateSpecialManeuver, validateStandUp, SpellsCatalog, type Buff, type CombatOutcome, type CombatRoom, type Combatant, type GrappleEscapeType, type LifeStatus } from "@dnd-tactical/shared";
import { type ActionMode, type TacticMode } from "../../viewModel";
import { Collapsible, D20Control, RollControls } from "../common";
import { GmPanel } from "../GmPanel/GmPanel";
import { useMemo, useState } from "react";

export function ActionsPanel(props: {
  room: CombatRoom;
  snapshot: import("@dnd-tactical/shared").CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>;
  selected: Combatant | null;
  participantRole: "gm" | "player";
  canControlSelected: boolean;
  canEndCurrentTurn: boolean;
  canResolveOpportunity: (attacker: Combatant | undefined) => boolean;
  actionMode: ActionMode;
  tacticMode: TacticMode;
  targetId: string;
  targetPosition?: import("@dnd-tactical/shared").Position | null;
  targets: Combatant[];
  enemyTargets: Combatant[];
  aidAllies: Combatant[];
  pendingAidBuffs: Buff[];
  selectedAbility: Combatant["abilities"][number] | null;
  abilityTargets: Combatant[];
  targetDistanceFeet: number | null;
  rangePreview: string | null;
  d20Roll: string;
  autoD20: boolean;
  damage: string;
  autoDamage: boolean;
  fightingDefensively: boolean;
  selectedAbilityId: string;
  stabilizationRoll: string;
  autoStabilizationRoll: boolean;
  healAmount: string;
  hpOverride: string;
  hpMaxOverride: string;
  gmNote: string;
  gmMoveTarget: Combatant | null;
  gmMoveMode: boolean;
  movementPathLength: number;
  movementPathCost: number;
  isMoveDestinationOccupied: boolean;
  hasPendingOpportunities: boolean;
  pendingOpportunities: CombatRoom["pendingOpportunityAttacks"];
  chargePreviewPath: CombatRoom["combatants"][number]["position"][] | null;
  error: string | null;
  onSelectActionMode: (mode: ActionMode) => void;
  onStabilizationRollChange: (value: string) => void;
  onAutoStabilizationRollChange: (value: boolean) => void;
  onRollStabilization: () => void;
  onUndoMovementStep: () => void;
  onClearMovementPath: () => void;
  onConfirmMovementPath: () => void;
  onFiveFootStep: () => void;
  withdrawArmed: boolean;
  onToggleWithdraw: () => void;
  runArmed: boolean;
  onToggleRun: () => void;
  onTargetChange: (id: string) => void;
  onD20Change: (value: string) => void;
  onAutoD20Change: (value: boolean) => void;
  onDamageChange: (value: string) => void;
  onAutoDamageChange: (value: boolean) => void;
  onDeclareAttackMode: (mode: "standard" | "full", defensive: boolean) => void;
  onCancelAttackMode: () => void;
  onToggleFightingDefensively: () => void;
  onAttack: () => void;
  onTacticModeChange: (mode: TacticMode) => void;
  onUseTacticalAction: (action: "total-defense") => void;
  onCharge: () => void;
  onTrip: () => void;
  onBullRush: () => void;
  onGrapple: () => void;
  onGrappleEscape: (escapeType: GrappleEscapeType) => void;
  onStandUp: () => void;
  onAidAllyChange: (id: string) => void;
  aidAllyId: string;
  onAidAnother: () => void;
  onChooseAidBonus: (buffId: string, choice: "attack" | "ac") => void;
  onSelectedAbilityChange: (id: string) => void;
  onHealAmountChange: (value: string) => void;
  onUseAbility: (abilityId?: string) => void;
  onCastSpell?: (slotId: string) => void;
  onEndTurn: () => void;
  onGmMoveTargetChange: (id: string) => void;
  onToggleGmMoveMode: () => void;
  onHealSelected: () => void;
  onHpOverrideChange: (value: string) => void;
  onHpMaxOverrideChange: (value: string) => void;
  onGmSetHp: () => void;
  onGmSetStatus: (status: LifeStatus) => void;
  onGmClearOpportunities: () => void;
  onGmForceOutcome: (outcome: CombatOutcome) => void;
  onGmNoteChange: (value: string) => void;
  onGmAddNote: () => void;
  onResolveOpportunity: (id: string) => void;
}) {
  const { room, selected, snapshot } = props;
  const [selectedSpellSlotId, setSelectedSpellSlotId] = useState<string | null>(null);
  const [grappleEscapeType, setGrappleEscapeType] = useState<GrappleEscapeType>("grapple_check");
  const actionDisabled = !props.canControlSelected;
  const selectedTarget = room.combatants.find((combatant) => combatant.id === props.targetId) ?? null;
  const abilityAttackType = props.selectedAbility?.resolution.kind === "attack-roll" ? props.selectedAbility.resolution.attackType : null;
  const abilityTactical = selected && selectedTarget && abilityAttackType
    ? getAttackContextModifiers(snapshot, selected, selectedTarget).byAttackType[abilityAttackType]
    : null;
  const tripPreview = useMemo(
    () => selected && selectedTarget && props.tacticMode === "trip"
      ? validateSpecialManeuver(snapshot, selected, selectedTarget, "trip")
      : null,
    [snapshot, selected, selectedTarget, props.tacticMode]
  );
  const bullRushPreview = useMemo(
    () => selected && selectedTarget && props.tacticMode === "bull-rush"
      ? validateSpecialManeuver(snapshot, selected, selectedTarget, "bull_rush")
      : null,
    [snapshot, selected, selectedTarget, props.tacticMode]
  );
  const grapplePreview = useMemo(
    () => selected && selectedTarget && props.tacticMode === "grapple"
      ? validateSpecialManeuver(snapshot, selected, selectedTarget, "grapple")
      : null,
    [snapshot, selected, selectedTarget, props.tacticMode]
  );
  const standUpPreview = useMemo(
    () => selected && props.tacticMode === "stand-up" ? validateStandUp(snapshot, selected) : null,
    [snapshot, selected, props.tacticMode]
  );
  const grappleEscapePreview = useMemo(
    () => selected && props.tacticMode === "grapple-escape"
      ? getGrappleEscapePreview(snapshot, selected, grappleEscapeType)
      : null,
    [snapshot, selected, props.tacticMode, grappleEscapeType]
  );
  const grappleAttackEligibility = useMemo(
    () => selected ? getGrappleAttackEligibility(snapshot, selected) : null,
    [snapshot, selected]
  );
  const grappleAttackBlocked = grappleAttackEligibility?.ok === false;
  return <aside className="panel actions">
    <div className="panel-title"><Swords size={18} /> Acciones</div>
    {selected ? <>
      {lifeStatus(selected) === "dying" && <div className="stabilization-box">
        <div className="panel-title"><HeartPulse size={18} /> Estabilizacion</div>
        <div className="roll-header"><span>d100</span><label className="inline-check"><input type="checkbox" checked={props.autoStabilizationRoll} onChange={(event) => props.onAutoStabilizationRollChange(event.target.checked)} /> Auto</label></div>
        <input type="number" min="1" max="100" value={props.stabilizationRoll} disabled={props.autoStabilizationRoll} onChange={(event) => props.onStabilizationRollChange(event.target.value)} />
        <button onClick={props.onRollStabilization} disabled={actionDisabled || room.phase !== "active" || room.currentTurn.combatantId !== selected.id || room.currentTurn.usedStabilization}><HeartPulse size={16} /> Resolver estabilizacion</button>
      </div>}
      <div className="action-menu">
        <button className={"action-button move " + (props.actionMode === "move" ? "active" : "")} onClick={() => props.onSelectActionMode("move")} disabled={actionDisabled}><Footprints size={18} /> Mover</button>
        <button className={"action-button attack " + (props.actionMode === "attack" ? "active" : "")} style={grappleAttackBlocked ? { color: "var(--danger)", borderColor: "var(--danger)" } : undefined} title={grappleAttackBlocked ? grappleAttackEligibility?.error : undefined} onClick={() => props.onSelectActionMode("attack")} disabled={actionDisabled || grappleAttackBlocked}><Swords size={18} /> Atacar</button>
        <button className={"action-button ability " + (props.actionMode === "ability" ? "active" : "")} onClick={() => props.onSelectActionMode("ability")} disabled={actionDisabled || selected.abilities.length === 0}><Sparkles size={18} /> Habilidad</button>
        <button className={"action-button tactics " + (props.actionMode === "tactics" ? "active" : "")} onClick={() => props.onSelectActionMode("tactics")} disabled={actionDisabled}><Shield size={18} /> Tacticas</button>
        <button className={"action-button inspect " + (props.actionMode === "inspect" ? "active" : "")} onClick={() => props.onSelectActionMode("inspect")}><MousePointer2 size={18} /> Ver</button>
      </div>
      {props.hasPendingOpportunities && <div className="rules-box">Hay ataques de oportunidad pendientes. Resolvelos o limpialos como GM antes de continuar con otras acciones.</div>}
      {room.phase === "preparation" && <div className="rules-box">Preparacion: agrega combatientes, coloca las fichas con Mover y carga iniciativas antes de iniciar combate.</div>}
      {props.actionMode === "move" && <div className="action-panel move-panel">
        <div className="panel-title"><Footprints size={18} /> Movimiento</div>
        <div className="rules-box">{room.phase === "preparation" ? "Click en una casilla verde para colocar al combatiente seleccionado." : "Click en casillas verdes adyacentes para dibujar la ruta. Luego confirma el movimiento."}</div>
        <div className="rules-box">Movimiento usado: {room.currentTurn.movementUsedFeet} ft - Disponible: {Math.max(0, Rules.totalSpeedFeet(snapshot, selected) - room.currentTurn.movementUsedFeet)} ft - Ruta: {props.movementPathCost} ft - Paso 5 ft: {room.currentTurn.usedFiveFootStep ? "si" : "no"}</div>
        {props.isMoveDestinationOccupied && <div className="rules-box error-text">No puedes terminar tu movimiento en una casilla ocupada.</div>}
        {room.phase === "active" && <div className="button-row">
          <button onClick={props.onUndoMovementStep} disabled={props.movementPathLength === 0}>Deshacer paso</button>
          <button onClick={props.onClearMovementPath} disabled={props.movementPathLength === 0}>Limpiar ruta</button>
        </div>}
        {room.phase === "active" && <button className="primary move-confirm" onClick={props.onConfirmMovementPath} disabled={actionDisabled || props.movementPathLength === 0 || props.hasPendingOpportunities || props.isMoveDestinationOccupied}><Footprints size={18} /> {props.withdrawArmed ? "Confirmar Retirada" : props.runArmed ? "Confirmar Correr" : "Confirmar movimiento"}</button>}
        {room.phase === "active" && (() => {
          // MOVE-WITHDRAW: disponibilidad presentacional (el servidor decide la legalidad final).
          const turnVirgin = room.currentTurn.movementUsedFeet === 0 && !room.currentTurn.usedMoveAction && !room.currentTurn.usedStandardAction && !room.currentTurn.usedFullAttack && !room.currentTurn.usedFiveFootStep && !room.currentTurn.usedTotalDefense && room.currentTurn.attacksMade === 0 && room.currentTurn.attackMode === "none";
          return <>
            <div className="rules-box" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
              <strong>Retirada (Withdraw)</strong> — acción de asalto completo: hasta 2× velocidad y tu posición inicial no provoca ataques de oportunidad. El resto de la ruta provoca normalmente.<br />
              {props.withdrawArmed ? "✓ Armada: dibuja la ruta (presupuesto ×2) y confirma." : turnVirgin ? "✓ Disponible con el turno sin usar." : "✗ No disponible: la Retirada exige el turno completo sin acciones previas."}
            </div>
            <button className={props.withdrawArmed ? "primary move-confirm" : "move-confirm"} onClick={props.onToggleWithdraw} disabled={actionDisabled || (!props.withdrawArmed && !turnVirgin) || props.hasPendingOpportunities}><Footprints size={18} /> {props.withdrawArmed ? "Cancelar Retirada" : "Retirarse (×2 velocidad)"}</button>
          </>;
        })()}
        {room.phase === "active" && (() => {
          // MOVE-RUN: disponibilidad presentacional (el servidor decide la legalidad final:
          // linea recta, terreno dificil absoluto, FORBID_RUN, economia). Correr no tiene
          // variante limitada para Disabled — sin turno virgen o Incapacitado, sin via legal.
          const turnVirgin = room.currentTurn.movementUsedFeet === 0 && !room.currentTurn.usedMoveAction && !room.currentTurn.usedStandardAction && !room.currentTurn.usedFullAttack && !room.currentTurn.usedFiveFootStep && !room.currentTurn.usedTotalDefense && room.currentTurn.attacksMade === 0 && room.currentTurn.attackMode === "none";
          const isDisabled = lifeStatus(selected) === "disabled";
          const runAvailable = turnVirgin && !isDisabled;
          return <>
            <div className="rules-box" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
              <strong>Correr (Run)</strong> — acción de asalto completo: movimiento en línea recta hasta ×4 velocidad (×3 con armadura pesada). No hay paso de 5' este turno; el terreno difícil lo bloquea por completo. Sin la dote de Correr, pierdes Destreza (y Esquiva) a la CA hasta tu próximo turno.<br />
              {props.runArmed ? "✓ Armado: dibuja el destino en línea recta y confirma." : isDisabled ? "✗ No disponible: un combatiente Incapacitado no puede correr." : runAvailable ? "✓ Disponible con el turno sin usar." : "✗ No disponible: Correr exige el turno completo sin acciones previas."}
            </div>
            <button className={props.runArmed ? "primary move-confirm" : "move-confirm"} onClick={props.onToggleRun} disabled={actionDisabled || (!props.runArmed && !runAvailable) || props.hasPendingOpportunities}><Footprints size={18} /> {props.runArmed ? "Cancelar Correr" : "Correr (×4/×3 velocidad)"}</button>
          </>;
        })()}
        {room.phase === "active" && (() => {
          const canStep = !room.currentTurn.usedFiveFootStep && room.currentTurn.movementUsedFeet === 0 && !room.currentTurn.usedMoveAction && !room.currentTurn.usedTotalDefense;
          return <>
            <div className="rules-box" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
              <strong>Paso de 5 pies</strong> — posicionamiento libre sin ataque de oportunidad.<br />
              {room.currentTurn.usedFiveFootStep ? "✗ Ya usado este turno." : room.currentTurn.movementUsedFeet > 0 ? "✗ No disponible: ya usó movimiento." : room.currentTurn.usedMoveAction ? "✗ No disponible: ya usó acción de movimiento." : "✓ Disponible. Dibuja 1 casilla y confirma."}
            </div>
            <button className="primary move-confirm" onClick={props.onFiveFootStep} disabled={actionDisabled || !canStep || props.movementPathLength !== 1 || props.hasPendingOpportunities || props.isMoveDestinationOccupied}><Footprints size={18} /> Confirmar paso de 5 pies</button>
          </>;
        })()}
      </div>}
      {props.actionMode === "attack" && (() => {
        const attackTarget = props.targets.find((t) => t.id === props.targetId);
        const interception = selected && attackTarget ? getAttackLineInterception(snapshot, selected, attackTarget) : null;
        const attackType = selected && attackTarget ? getWeaponAttackTypeForTarget(snapshot, selected, attackTarget) : "melee";
        const attackContext = selected && attackTarget
          ? getAttackContextModifiers(snapshot, selected, attackTarget).byAttackType[attackType]
          : { attackBonus: 0, labelParts: [] };
        const routine = selected ? getEffectiveAttackRoutine(snapshot, selected, { attackType }) : [];
        const attacksMade = room.currentTurn.attacksMade || 0;
        const currentAttack = routine[attacksMade] || { effectiveAttackBonus: 0 };
        const hasRemainingAttacks = attacksMade < routine.length;
        const isPrepared = room.currentTurn.attackMode !== "none";
        const equippedWeapon = getEquippedWeaponEntry(selected);
        const ammunitionState = getAmmunitionState(selected, equippedWeapon);
        const ammunitionItems = selected.inventory.flatMap((item) => {
          const weapon = EquipmentCatalog.getWeapon(item.catalogId);
          return weapon?.isAmmunition ? [{ ...item, name: weapon.name }] : [];
        });
        const ammunitionBlocked = attackType === "ranged" && ammunitionState.required && ammunitionState.availableQuantity <= 0;
        
        return <div className="action-panel attack-panel">
          <div className="panel-title"><Swords size={18} /> Ataque</div>
          {grappleAttackBlocked && <div className="rules-box error-text" style={{ color: "var(--danger)" }}>{grappleAttackEligibility?.error}</div>}
          {grappleAttackEligibility?.ok && grappleAttackEligibility.value?.isGrappling && <div className="rules-box">Fuente permitida en Presa: {grappleAttackEligibility.value.sourceName}. forcejeo en presa -4.</div>}
          <div className="rules-box">
            <strong>Munición</strong><br />
            {ammunitionItems.length > 0 ? ammunitionItems.map((item) => <span key={item.itemId} style={{ marginRight: "0.75rem" }}>{item.name}: {item.quantity ?? 0}</span>) : "Sin proyectiles en la mochila."}
          </div>
          {ammunitionBlocked && <div className="rules-box error-text" style={{ color: "var(--danger)" }}>Sin munición compatible: el ataque a distancia está bloqueado.</div>}
          <div className="rules-box">Rojo: casillas amenazadas cuerpo a cuerpo. Naranja: alcance de ataque a distancia o arrojadizo.</div>
          
          {!isPrepared ? (
            <>
              <div className="switch-list" style={{ marginBottom: "1rem" }}>
                <button type="button" className={"switch-row " + (props.fightingDefensively ? "on" : "off")} onClick={props.onToggleFightingDefensively}>
                  <span>Luchar a la defensiva</span><span className="switch"><span /></span><strong>{props.fightingDefensively ? "ON" : "OFF"}</strong>
                </button>
              </div>
              <div className="rules-box">
                {props.fightingDefensively ? "Luchar a la defensiva: -4 al ataque. Otorga +2 CA después de resolver el primer ataque." : "Prepara el modo de ataque antes de seleccionar el objetivo."}
              </div>
              <div className="button-row" style={{ marginTop: "1rem" }}>
                <button className="primary" onClick={() => props.onDeclareAttackMode("standard", props.fightingDefensively)} disabled={actionDisabled || grappleAttackBlocked || room.phase !== "active" || room.currentTurn.usedStandardAction || room.currentTurn.usedFullAttack}>Preparar Ataque Estandar</button>
                <button className="primary" onClick={() => props.onDeclareAttackMode("full", props.fightingDefensively)} disabled={actionDisabled || grappleAttackBlocked || room.phase !== "active" || room.currentTurn.usedStandardAction || room.currentTurn.usedFullAttack || room.currentTurn.usedMoveAction || room.currentTurn.movementUsedFeet > 5}>Preparar Ataque Completo</button>
              </div>
            </>
          ) : (
            <>
              <div className="rules-box" style={{ fontWeight: "bold" }}>
                Modo: Ataque {room.currentTurn.attackMode === "full" ? "Completo" : "Estandar"} preparado.
                {room.currentTurn.defensiveFightingDeclared && " (Lucha Defensiva Activa)"}
              </div>
              {attacksMade === 0 && (
                <button className="secondary" style={{ marginBottom: "1rem" }} onClick={props.onCancelAttackMode} disabled={actionDisabled || room.phase !== "active"}>
                  Cancelar Modo
                </button>
              )}
              
              <label>Objetivo<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)}><option value="">Elegir</option>{props.targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
              {props.targetDistanceFeet !== null && <div className="rules-box">Distancia al objetivo: {props.targetDistanceFeet} ft.{props.rangePreview ? " " + props.rangePreview : ""}</div>}
              {attackContext.labelParts.length > 0 && <div className="rules-box">Modificadores de posicion: {attackContext.labelParts.join(", ")}</div>}
              {interception?.hasObstacleInterception && <div className="rules-box" style={{ color: "var(--danger)" }}>⚠️ El objetivo tiene cobertura (+4 CA) porque la linea de ataque atraviesa otra criatura.</div>}
              {selected && attackTarget && canApplySneakAttack(snapshot, selected, attackTarget) && <div className="rules-box sneak-attack-badge" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid var(--success)", color: "var(--success)", fontWeight: "bold", marginTop: "0.5rem" }}><Sparkles size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: "4px" }} />¡Ataque Furtivo disponible! +{getEffectiveSneakAttackDice(snapshot, selected)}d6</div>}
              {(() => {
                const provokesAoO = attackType === "ranged" && Rules.actionProvokesOpportunityAttack(snapshot, selected, "ranged-attack");
                return provokesAoO ? (
                  <div className="rules-box error-text" style={{ marginTop: "0.5rem" }}>
                    Advertencia: Un ataque a distancia estando amenazado provocara Ataques de Oportunidad interruptivos.
                  </div>
                ) : null;
              })()}
              <RollControls d20={props.d20Roll} autoD20={props.autoD20} damage={props.damage} autoDamage={props.autoDamage} defaultDamage={averageWeaponDamageForCombatant(selected)} onD20Change={props.onD20Change} onAutoD20Change={props.onAutoD20Change} onDamageChange={props.onDamageChange} onAutoDamageChange={props.onAutoDamageChange} />
              
              {routine.length > 1 && room.currentTurn.attackMode === "full" && <div className="rules-box" style={{ marginTop: "0.5rem" }}>
                <strong>Rutina iterativa por BAB</strong><br />
                {attacksMade >= routine.length ? "Secuencia completada." : `Ataque ${attacksMade + 1} de ${routine.length}: ${currentAttack.effectiveAttackBonus >= 0 ? "+" : ""}${currentAttack.effectiveAttackBonus}`}
              </div>}
              
              <button className="primary attack-confirm" onClick={props.onAttack} disabled={actionDisabled || grappleAttackBlocked || room.phase !== "active" || props.hasPendingOpportunities || !hasRemainingAttacks || ammunitionBlocked}>
                <Swords size={18} /> {attacksMade === 0 ? "Resolver primer ataque" : `Resolver ataque (${attacksMade + 1}/${routine.length})`}
              </button>
            </>
          )}
        </div>;
      })()}
      {props.actionMode === "tactics" && <div className="action-panel tactics-panel">
        <div className="panel-title"><Shield size={18} /> Tacticas</div>
        {props.pendingAidBuffs.length > 0 && <div className="rules-box">
          <strong>Ayudas pendientes</strong>
          {props.pendingAidBuffs.map((buff) => <div key={buff.id} className="button-row">
            <span>{buff.name} contra {buff.aidTargetName}</span>
            <button onClick={() => props.onChooseAidBonus(buff.id, "attack")} disabled={actionDisabled || props.hasPendingOpportunities}>+2 ataque</button>
            <button onClick={() => props.onChooseAidBonus(buff.id, "ac")} disabled={actionDisabled || props.hasPendingOpportunities}>+2 CA</button>
          </div>)}
        </div>}
        <label>Tactica<select value={props.tacticMode} onChange={(event) => props.onTacticModeChange(event.target.value as TacticMode)}>
          <option value="total-defense">Defensa total</option>
          <option value="charge">Carga</option>
          <option value="aid-another">Prestar ayuda</option>
          <option value="trip">Maniobra: Derribar</option>
          <option value="bull-rush">Maniobra: Embestir</option>
          <option value="grapple">Maniobra: Presa</option>
          <option value="grapple-escape">Maniobra: Escapar de Presa</option>
          <option value="stand-up">Levantarse</option>
        </select></label>
        {props.tacticMode === "total-defense" && <div className="tactic-card">
          <div className="rules-box">Defensa total: accion estandar, +4 de esquiva a la CA hasta el inicio del proximo turno. Renuncia a atacar, moverse, lanzar conjuros y hacer ataques de oportunidad.</div>
          <button className="primary tactics-confirm" onClick={() => props.onUseTacticalAction("total-defense")} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities}><Shield size={18} /> Defensa total</button>
        </div>}
        {props.tacticMode === "charge" && <div className="tactic-card">
          <RollControls d20={props.d20Roll} autoD20={props.autoD20} damage={props.damage} autoDamage={props.autoDamage} defaultDamage={averageWeaponDamageForCombatant(selected)} onD20Change={props.onD20Change} onAutoD20Change={props.onAutoD20Change} onDamageChange={props.onDamageChange} onAutoDamageChange={props.onAutoDamageChange} />
          <label>Objetivo enemigo<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)}><option value="">Elegir</option>{props.enemyTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          {props.targetId && <div className="rules-box">{props.chargePreviewPath ? "Ruta de carga prevista: " + calculatePathCostFeet(selected.position, props.chargePreviewPath, createCombatRulesSnapshot(room)) + " ft. La casilla final queda marcada en el tablero." : "No hay una ruta de carga recta y libre hacia ese objetivo."}</div>}
          <div className="rules-box">Carga: ruta recta y libre de al menos 10 ft hasta una casilla desde la que puedas atacar. Usa accion de asalto completo, +2 al ataque y -2 a la CA hasta tu proximo turno.</div>
          <button className="primary attack-confirm" onClick={props.onCharge} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !props.targetId || !props.chargePreviewPath}><Swords size={18} /> Cargar</button>
        </div>}
        {props.tacticMode === "aid-another" && <div className="tactic-card">
          <div className="split"><D20Control value={props.d20Roll} auto={props.autoD20} onValueChange={props.onD20Change} onAutoChange={props.onAutoD20Change} /><label>Aliado<select value={props.aidAllyId} onChange={(event) => props.onAidAllyChange(event.target.value)}><option value="">Elegir</option>{props.aidAllies.map((ally) => <option key={ally.id} value={ally.id}>{ally.name}</option>)}</select></label></div>
          <label>Oponente<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)}><option value="">Elegir</option>{props.enemyTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          <div className="rules-box">Prestar ayuda: debes amenazar al enemigo. Tiras ataque contra CA 10; si sale, el aliado gana una ayuda pendiente de 1 turno y elige +2 ataque o +2 CA contra ese enemigo.</div>
          <button className="primary tactics-confirm" onClick={props.onAidAnother} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !props.aidAllyId || !props.targetId}><Shield size={18} /> Prestar ayuda</button>
        </div>}
        {props.tacticMode === "trip" && <div className="tactic-card">
          <D20Control value={props.d20Roll} auto={props.autoD20} onValueChange={props.onD20Change} onAutoChange={props.onAutoD20Change} />
          <label>Objetivo enemigo<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)}><option value="">Elegir</option>{props.enemyTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          {!props.targetId && <div className="rules-box">Selecciona un enemigo para previsualizar alcance, AdO y flanqueo.</div>}
          {tripPreview && !tripPreview.ok && <div className="rules-box error-text">{tripPreview.error}</div>}
          {tripPreview?.ok && tripPreview.value?.maneuverId === "trip" && <>
            <div className="rules-box">Fuente: {tripPreview.value.sourceName}. Alcance {tripPreview.value.minReachFeet}-{tripPreview.value.maxReachFeet} ft. Touch AC {tripPreview.value.touchArmorClass}.{tripPreview.value.flankingBonus ? " Flanqueo +2 al toque." : " Sin bono de flanqueo."}</div>
            <div className={tripPreview.value.provokesOpportunityAttack ? "rules-box error-text" : "rules-box"}>
              {tripPreview.value.provokesOpportunityAttack
                ? tripPreview.value.defenderCanMakeOpportunityAttack
                  ? "Advertencia: el intento provocara un Ataque de Oportunidad interruptivo antes del toque."
                  : "El intento provoca AdO, pero este defensor no puede ejecutarlo ahora."
                : `No provoca AdO (${tripPreview.value.armedTrip ? "arma apta para Derribo" : "Derribo mejorado"}).`}
            </div>
            <div className="rules-box">Prueba prevista: FUE {tripPreview.value.attackerStrengthModifier >= 0 ? "+" : ""}{tripPreview.value.attackerStrengthModifier}, tamaño {tripPreview.value.attackerSizeModifier >= 0 ? "+" : ""}{tripPreview.value.attackerSizeModifier} contra {tripPreview.value.defenderAbility === "dexterity" ? "DES" : "FUE"} {tripPreview.value.defenderAbilityModifier >= 0 ? "+" : ""}{tripPreview.value.defenderAbilityModifier}, tamaño {tripPreview.value.defenderSizeModifier >= 0 ? "+" : ""}{tripPreview.value.defenderSizeModifier}.</div>
          </>}
          <button className="primary tactics-confirm" onClick={props.onTrip} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !tripPreview?.ok}><Swords size={18} /> Maniobra: Derribar</button>
        </div>}
        {props.tacticMode === "bull-rush" && <div className="tactic-card">
          <D20Control value={props.d20Roll} auto={props.autoD20} onValueChange={props.onD20Change} onAutoChange={props.onAutoD20Change} />
          <label>Objetivo enemigo<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)}><option value="">Elegir</option>{props.enemyTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          {!props.targetId && <div className="rules-box">Selecciona un enemigo para previsualizar alcance, riesgo de AdO y desplazamiento inicial.</div>}
          {bullRushPreview && !bullRushPreview.ok && <div className="rules-box error-text">{bullRushPreview.error}</div>}
          {bullRushPreview?.ok && bullRushPreview.value?.maneuverId === "bull_rush" && <>
            <div className="rules-box">Trayectoria potencial: {bullRushPreview.value.projectedPath.length * room.board.cellSizeFeet} ft; ancla final ({bullRushPreview.value.projectedFinalPosition.x}, {bullRushPreview.value.projectedFinalPosition.y}). El footprint final queda marcado en el tablero.</div>
            <div className={bullRushPreview.value.provokesOpportunityAttack ? "rules-box error-text" : "rules-box"}>
              {bullRushPreview.value.provokesOpportunityAttack
                ? bullRushPreview.value.defenderCanMakeOpportunityAttack
                  ? "Advertencia: el defensor ejecutara un Ataque de Oportunidad interruptivo; si causa dano, la Embestida se aborta."
                  : "La Embestida provoca AdO, pero este defensor no puede ejecutarlo ahora."
                : "La Embestida no provoca Ataque de Oportunidad."}
            </div>
            <div className="rules-box">Prueba prevista: FUE {bullRushPreview.value.attackerStrengthModifier >= 0 ? "+" : ""}{bullRushPreview.value.attackerStrengthModifier}, tamano {bullRushPreview.value.attackerSizeModifier >= 0 ? "+" : ""}{bullRushPreview.value.attackerSizeModifier} contra FUE {bullRushPreview.value.defenderStrengthModifier >= 0 ? "+" : ""}{bullRushPreview.value.defenderStrengthModifier}, tamano {bullRushPreview.value.defenderSizeModifier >= 0 ? "+" : ""}{bullRushPreview.value.defenderSizeModifier}.</div>
          </>}
          <button className="primary tactics-confirm" onClick={() => props.onBullRush()} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !bullRushPreview?.ok}><Swords size={18} /> Maniobra: Embestir</button>
        </div>}
        {props.tacticMode === "grapple" && <div className="tactic-card">
          <D20Control value={props.d20Roll} auto={props.autoD20} onValueChange={props.onD20Change} onAutoChange={props.onAutoD20Change} />
          <label>Objetivo enemigo<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)}><option value="">Elegir</option>{props.enemyTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          {!props.targetId && <div className="rules-box">Selecciona un enemigo para previsualizar toque, AdO y modificadores de Presa.</div>}
          {grapplePreview && !grapplePreview.ok && <div className="rules-box error-text">{grapplePreview.error}</div>}
          {grapplePreview?.ok && grapplePreview.value?.maneuverId === "grapple" && <>
            <div className="rules-box">Alcance {grapplePreview.value.minReachFeet}-{grapplePreview.value.maxReachFeet} ft. Touch AC {grapplePreview.value.touchArmorClass}.{grapplePreview.value.flankingBonus ? " Flanqueo +2 al toque." : " Sin bono de flanqueo."}</div>
            <div className={grapplePreview.value.provokesOpportunityAttack ? "rules-box error-text" : "rules-box"}>
              {grapplePreview.value.provokesOpportunityAttack
                ? grapplePreview.value.defenderCanMakeOpportunityAttack
                  ? "Advertencia: el defensor ejecutará un AdO interruptivo; si causa daño, la Presa se aborta."
                  : "La Presa provoca AdO, pero este defensor no puede ejecutarlo ahora."
                : "La Presa no provoca Ataque de Oportunidad."}
            </div>
            <div className="rules-box">Atacante: BAB {grapplePreview.value.attackerBaseAttackBonus >= 0 ? "+" : ""}{grapplePreview.value.attackerBaseAttackBonus}, FUE {grapplePreview.value.attackerStrengthModifier >= 0 ? "+" : ""}{grapplePreview.value.attackerStrengthModifier}, tamaño {grapplePreview.value.attackerSizeModifier >= 0 ? "+" : ""}{grapplePreview.value.attackerSizeModifier} = {grapplePreview.value.attackerGrappleModifier >= 0 ? "+" : ""}{grapplePreview.value.attackerGrappleModifier}.</div>
            <div className="rules-box">Defensor: BAB {grapplePreview.value.defenderBaseAttackBonus >= 0 ? "+" : ""}{grapplePreview.value.defenderBaseAttackBonus}, FUE {grapplePreview.value.defenderStrengthModifier >= 0 ? "+" : ""}{grapplePreview.value.defenderStrengthModifier}, tamaño {grapplePreview.value.defenderSizeModifier >= 0 ? "+" : ""}{grapplePreview.value.defenderSizeModifier} = {grapplePreview.value.defenderGrappleModifier >= 0 ? "+" : ""}{grapplePreview.value.defenderGrappleModifier}.</div>
          </>}
          <button className="primary tactics-confirm" onClick={props.onGrapple} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !grapplePreview?.ok}><Swords size={18} /> Maniobra: Presa</button>
        </div>}
        {props.tacticMode === "grapple-escape" && <div className="tactic-card">
          <D20Control value={props.d20Roll} auto={props.autoD20} onValueChange={props.onD20Change} onAutoChange={props.onAutoD20Change} />
          <label>Tipo de escape<select value={grappleEscapeType} onChange={(event) => setGrappleEscapeType(event.target.value as GrappleEscapeType)}>
            <option value="grapple_check">Prueba de Presa</option>
            <option value="escape_artist">Escapismo</option>
          </select></label>
          {grappleEscapePreview && !grappleEscapePreview.ok && <div className="rules-box error-text">{grappleEscapePreview.error}</div>}
          {grappleEscapePreview?.ok && grappleEscapePreview.value && <>
            <div className="rules-box">Escapista: {grappleEscapePreview.value.escapeParts.join(" + ")} = {grappleEscapePreview.value.escapeModifier >= 0 ? "+" : ""}{grappleEscapePreview.value.escapeModifier}.</div>
            <div className="rules-box">Retenedor {grappleEscapePreview.value.opponentName}: {grappleEscapePreview.value.defenderParts.join(" + ")} = {grappleEscapePreview.value.defenderModifier >= 0 ? "+" : ""}{grappleEscapePreview.value.defenderModifier}.</div>
          </>}
          <button className="primary tactics-confirm" onClick={() => props.onGrappleEscape(grappleEscapeType)} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !grappleEscapePreview?.ok}><Swords size={18} /> Maniobra: Escapar de Presa</button>
        </div>}
        {props.tacticMode === "stand-up" && <div className="tactic-card">
            {standUpPreview?.ok && standUpPreview.value
              ? <div className={"rules-box " + (!standUpPreview.value.provokesOpportunityAttacks ? "safe-action" : "")}>Levantarse: {standUpPreview.value.costFeet} pies. {standUpPreview.value.provokesOpportunityAttacks ? "Provoca ataques de oportunidad de los enemigos que amenacen tu posición." : "SEGURO (Sin AdO)"}</div>
              : <div className="rules-box">{standUpPreview?.error ?? "Levantarse requiere estar derribado."}</div>}
            <button className="primary tactics-confirm" onClick={props.onStandUp} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !standUpPreview?.ok}><Swords size={18} /> Levantarse</button>
          </div>}
      </div>}
      {props.actionMode === "ability" && <div className="action-panel ability-panel">
        <div className="panel-title"><Sparkles size={18} /> Habilidades y Conjuros</div>
        
        {/* HABILIDADES COMUNES */}
        {selected.abilities.length > 0 && <div className="rules-box" style={{ marginBottom: "1rem" }}>
          <strong>Aptitudes (Abilities)</strong><br />
          <label>Habilidad<select value={props.selectedAbilityId || props.selectedAbility?.id || ""} onChange={(event) => props.onSelectedAbilityChange(event.target.value)}><option value="">Elegir</option>{selected.abilities.map((ability) => <option key={ability.id} value={ability.id}>{ability.name}</option>)}</select></label>
          <label>Objetivo<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)}><option value="">Elegir</option>{props.abilityTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          {props.selectedAbility && <div className="rules-box">{props.selectedAbility.description} Alcance: {props.selectedAbility.rangeFeet} ft.</div>}
          {props.selectedAbility?.id === "cure-light-wounds" && <label>Curacion<input type="number" value={props.healAmount} onChange={(event) => props.onHealAmountChange(event.target.value)} /></label>}
          {props.selectedAbility?.id === "magic-missile" && <label>Daño<input type="number" value={props.damage} onChange={(event) => props.onDamageChange(event.target.value)} /></label>}
          {props.selectedAbility?.resolution.kind === "attack-roll" && <RollControls d20={props.d20Roll} autoD20={props.autoD20} damage={props.damage} autoDamage={props.autoDamage} defaultDamage={0} onD20Change={props.onD20Change} onAutoD20Change={props.onAutoD20Change} onDamageChange={props.onDamageChange} onAutoDamageChange={props.onAutoDamageChange} />}
          {abilityTactical && abilityTactical.labelParts.length > 0 && <div className="rules-box">Modificadores de posición: {abilityTactical.labelParts.join(", ")}</div>}
          <button className="primary ability-confirm" onClick={() => props.onUseAbility(props.selectedAbilityId || props.selectedAbility?.id || "")} disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || !props.selectedAbility}><Sparkles size={18} /> Usar habilidad</button>
        </div>}

        {/* CONJUROS PREPARADOS */}
        {selected.preparedSpells && selected.preparedSpells.length > 0 && <div className="rules-box" style={{ marginBottom: "1rem" }}>
          <strong>Conjuros Preparados</strong><br />
          <div className="spell-grid" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem", marginBottom: "1rem" }}>
            {selected.preparedSpells.map((slot) => {
              const spell = SpellsCatalog.require(slot.spellId);
              const isSelected = selectedSpellSlotId === slot.slotId;
              return (
                <button 
                  key={slot.slotId}
                  className={`spell-btn ${isSelected ? "selected" : ""}`}
                  style={{ opacity: slot.isExpended ? 0.5 : 1, filter: slot.isExpended ? "grayscale(100%)" : "none", padding: "0.5rem", border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)" }}
                  onClick={() => setSelectedSpellSlotId(slot.slotId)}
                  disabled={slot.isExpended}
                >
                  {spell.name}
                </button>
              );
            })}
          </div>

          {(() => {
            const activeSlot = selected.preparedSpells.find(s => s.slotId === selectedSpellSlotId);
            if (!activeSlot) return null;
            const spellDef = SpellsCatalog.require(activeSlot.spellId);
            const dcBreakdown = Rules.calculateSpellSaveDCBreakdown(snapshot, selected, activeSlot.spellId);
            
            let isOutOfRange = false;
            let targetDistance = 0;
            let targetSavePreview: { total: number; parts: string[] } | null = null;
            if (props.targetId) {
              const target = room.combatants.find(c => c.id === props.targetId);
              if (target) {
                targetDistance = calculatePathCostFeet(selected.position, [target.position], snapshot);
                if (targetDistance > spellDef.rangeFeet) {
                  isOutOfRange = true;
                }
                if (spellDef.savingThrowType !== "none") {
                  targetSavePreview = Rules.totalSavingThrow(snapshot, target, spellDef.savingThrowType);
                }
              }
            }

            return (
              <div className="spell-preview" style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "rgba(0,0,0,0.2)" }}>
                <strong>{spellDef.name}</strong> (Nivel {spellDef.level}) — Alcance: {spellDef.rangeFeet} ft.<br />
                {spellDef.savingThrowType === "none" ? (
                  <span>Sin tirada de salvación.<br /></span>
                ) : (
                  <span style={{ color: "var(--warning)" }}>
                    Salvación {spellDef.savingThrowType}: DC {dcBreakdown.total}
                    {targetSavePreview && <> vs bono del objetivo {targetSavePreview.total >= 0 ? "+" : ""}{targetSavePreview.total}</>}
                    {` — éxito: ${spellDef.saveEffect === "half" ? "mitad de daño" : spellDef.saveEffect === "negates" ? "niega el efecto" : "sin mitigación"}`}<br />
                  </span>
                )}
                <label style={{ marginTop: "0.5rem", display: "block" }}>Objetivo<select value={props.targetId} onChange={(event) => props.onTargetChange(event.target.value)} style={{ width: "100%" }}><option value="">Elegir</option>{props.abilityTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
                {(() => {
                  const provokesAoO = Rules.actionProvokesOpportunityAttack(snapshot, selected, "cast-spell");
                  return provokesAoO ? (
                    <div className="rules-box error-text" style={{ marginTop: "0.5rem" }}>
                      Advertencia: Lanzar este conjuro provocara Ataques de Oportunidad interruptivos.
                    </div>
                  ) : null;
                })()}
                {props.targetId && (
                  <div className={`rules-box ${isOutOfRange ? "error-text" : ""}`} style={{ marginTop: "0.5rem" }}>
                    Distancia al objetivo: {targetDistance} ft.
                    {isOutOfRange && " (FUERA DE ALCANCE)"}
                  </div>
                )}
                <button 
                  className="primary" 
                  style={{ marginTop: "0.5rem", width: "100%" }}
                  onClick={() => props.onCastSpell?.(activeSlot.slotId)}
                  disabled={actionDisabled || room.phase !== "active" || props.hasPendingOpportunities || activeSlot.isExpended || !props.targetId || isOutOfRange}
                >
                  <Sparkles size={16} /> Lanzar {spellDef.name}
                </button>
              </div>
            );
          })()}
        </div>}
        
        {selected.abilities.length === 0 && (!selected.preparedSpells || selected.preparedSpells.length === 0) && (
          <div className="rules-box">Este combatiente no tiene aptitudes ni conjuros preparados.</div>
        )}
      </div>}
      {room.phase === "active" && <button onClick={props.onEndTurn} disabled={!props.canEndCurrentTurn || props.hasPendingOpportunities}><SkipForward size={18} /> Terminar turno</button>}
      {props.participantRole === "gm" && <GmPanel room={room} selected={selected} gmMoveTarget={props.gmMoveTarget} gmMoveMode={props.gmMoveMode} healAmount={props.healAmount} hpOverride={props.hpOverride} hpMaxOverride={props.hpMaxOverride} gmNote={props.gmNote} onGmMoveTargetChange={props.onGmMoveTargetChange} onToggleGmMoveMode={props.onToggleGmMoveMode} onHealAmountChange={props.onHealAmountChange} onHealSelected={props.onHealSelected} onHpOverrideChange={props.onHpOverrideChange} onHpMaxOverrideChange={props.onHpMaxOverrideChange} onGmSetHp={props.onGmSetHp} onGmSetStatus={props.onGmSetStatus} onGmClearOpportunities={props.onGmClearOpportunities} onGmForceOutcome={props.onGmForceOutcome} onGmNoteChange={props.onGmNoteChange} onGmAddNote={props.onGmAddNote} />}
      {props.pendingOpportunities.length > 0 && <Collapsible title="Ataques de oportunidad" defaultOpen><div className="opportunity-list">
        {props.pendingOpportunities.map((opportunity) => {
          const attacker = room.combatants.find((combatant) => combatant.id === opportunity.attackerId);
          const target = room.combatants.find((combatant) => combatant.id === opportunity.targetId);
          return <div key={opportunity.id} className="opportunity-card">
            <strong>{attacker?.name ?? "Atacante"} contra {target?.name ?? "objetivo"}</strong>
            <small>{opportunity.reason}</small>
            <button onClick={() => props.onResolveOpportunity(opportunity.id)} disabled={!props.canResolveOpportunity(attacker)}><Swords size={16} /> Resolver con d20/daño actual</button>
          </div>;
        })}
      </div></Collapsible>}
    </> : <p>Agrega o selecciona un combatiente.</p>}
    {props.error && <p className="error">{props.error}</p>}
  </aside>;
}
