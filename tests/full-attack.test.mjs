import test from "node:test";
import assert from "node:assert";
import { getAttackRoutine } from "../packages/shared/src/rules.js";

test("Routines calculation by BAB", () => {
  const c4 = { baseAttackBonus: 4 };
  assert.deepStrictEqual(getAttackRoutine(c4), [{ type: "primary", penalty: 0 }]);

  const c6 = { baseAttackBonus: 6 };
  assert.deepStrictEqual(getAttackRoutine(c6), [
    { type: "primary", penalty: 0 },
    { type: "iterative", penalty: -5 }
  ]);

  const c11 = { baseAttackBonus: 11 };
  assert.deepStrictEqual(getAttackRoutine(c11), [
    { type: "primary", penalty: 0 },
    { type: "iterative", penalty: -5 },
    { type: "iterative", penalty: -10 }
  ]);

  const c16 = { baseAttackBonus: 16 };
  assert.deepStrictEqual(getAttackRoutine(c16), [
    { type: "primary", penalty: 0 },
    { type: "iterative", penalty: -5 },
    { type: "iterative", penalty: -10 },
    { type: "iterative", penalty: -15 }
  ]);
});
