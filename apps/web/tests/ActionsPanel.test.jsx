import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCombatRulesSnapshot } from "@dnd-tactical/shared";
import { makeTestCombatant, makeTestRoom } from "../../../tests/test-utils.mjs";
import { ActionsPanel } from "../src/components/ActionsPanel/ActionsPanel";

afterEach(cleanup);

const button = (name) => screen.getByRole("button", { name });

function renderPanel(overrides = {}, roomOverrides = {}) {
  const selected = makeTestCombatant();
  const enemy = makeTestCombatant({
    id: "enemy", name: "Orco", type: "enemy", controlledBy: { type: "gm" },
    position: { x: 1, y: 0, zFeet: 0 },
  });
  const room = makeTestRoom({ combatants: [selected, enemy], turnOrder: [selected.id, enemy.id] });
  Object.assign(room, roomOverrides, {
    currentTurn: { ...room.currentTurn, ...roomOverrides.currentTurn },
  });
  const props = {
    room, snapshot: createCombatRulesSnapshot(room), selected,
    participantRole: "player", canControlSelected: true, canEndCurrentTurn: true,
    canResolveOpportunity: (attacker) => attacker?.id === selected.id,
    actionMode: "inspect", tacticMode: "total-defense",
    targetId: enemy.id, targets: [enemy], enemyTargets: [enemy],
    aidAllies: [], pendingAidBuffs: [], abilityTargets: [],
    targetDistanceFeet: 5, rangePreview: null, selectedAbility: null,
    d20Roll: "12", damage: "3", autoD20: false, autoDamage: false,
    movementPathLength: 1, movementPathCost: 5, pendingOpportunities: room.pendingOpportunityAttacks,
    hasPendingOpportunities: room.pendingOpportunityAttacks.length > 0,
    onEndTurn: vi.fn(), onAttack: vi.fn(), onDeclareAttackMode: vi.fn(),
    onConfirmMovementPath: vi.fn(), onResolveOpportunity: vi.fn(),
    ...overrides,
  };
  render(<ActionsPanel {...props} />);
  return { props, user: userEvent.setup() };
}

describe("ActionsPanel", () => {
  it("envía la intención de terminar un turno autorizado", async () => {
    const { props, user } = renderPanel();
    await user.click(button("Terminar turno"));
    expect(props.onEndTurn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["sin permiso", { canEndCurrentTurn: false }],
    ["con interacción bloqueada", { isInteractionLocked: true }],
    ["con reacción pendiente", { hasPendingOpportunities: true }],
  ])("impide terminar el turno %s", async (_label, overrides) => {
    const { props, user } = renderPanel(overrides);
    const end = button("Terminar turno");
    expect(end.disabled).toBe(true);
    await user.click(end);
    expect(props.onEndTurn).not.toHaveBeenCalled();
  });

  it("permite preparar ataque estándar tras moverse y bloquea el completo", async () => {
    const { props, user } = renderPanel({ actionMode: "attack", fightingDefensively: true }, {
      currentTurn: { usedMoveAction: true, movementUsedFeet: 10 },
    });
    const full = button("Preparar Ataque Completo");
    expect(full.disabled).toBe(true);
    await user.click(full);
    await user.click(button("Preparar Ataque Estandar"));
    expect(props.onDeclareAttackMode.mock.calls).toEqual([["standard", true]]);
  });

  it.each([
    ["con control", true, 1],
    ["sin control", false, 0],
  ])("protege la resolución de ataque %s", async (_label, canControlSelected, calls) => {
    const { props, user } = renderPanel({ actionMode: "attack", canControlSelected }, {
      currentTurn: { attackMode: "standard" },
    });
    const attack = button("Resolver primer ataque");
    expect(attack.disabled).toBe(!canControlSelected);
    await user.click(attack);
    expect(props.onAttack).toHaveBeenCalledTimes(calls);
  });

  it.each([false, true])("aplica la restricción de destino ocupado (%s)", async (occupied) => {
    const { props, user } = renderPanel({ actionMode: "move", isMoveDestinationOccupied: occupied });
    const move = button("Confirmar movimiento");
    expect(move.disabled).toBe(occupied);
    await user.click(move);
    expect(props.onConfirmMovementPath).toHaveBeenCalledTimes(occupied ? 0 : 1);
  });

  it.each([
    ["reacción propia", "hero-test", false, true],
    ["reacción ajena", "enemy", false, false],
    ["interacción bloqueada", "hero-test", true, false],
  ])("controla resolver y declinar una %s", async (_label, attackerId, locked, allowed) => {
    const { props, user } = renderPanel({ isInteractionLocked: locked }, {
      phase: "opportunity-resolution",
      pendingOpportunityAttacks: [{
        id: "reaction", attackerId, targetId: attackerId === "enemy" ? "hero-test" : "enemy",
        origin: { x: 1, y: 0, zFeet: 0 }, destination: { x: 2, y: 0, zFeet: 0 },
        reason: "Sale de una casilla amenazada", createdAt: "2026-01-01T00:00:00Z",
      }],
    });
    const resolve = button("Resolver con d20/daño actual");
    const decline = button("Declinar AdO");
    expect(resolve.disabled).toBe(!allowed);
    expect(decline.disabled).toBe(!allowed);
    await user.click(resolve);
    await user.click(decline);
    expect(props.onResolveOpportunity.mock.calls).toEqual(allowed ? [["reaction"], ["reaction", true]] : []);
    expect(screen.queryByRole("button", { name: "Terminar turno" })).toBeNull();
  });
});
