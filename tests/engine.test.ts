import test from "node:test";
import assert from "node:assert/strict";
import { CARD, getCard } from "../src/data/cards.ts";
import {
  applyAction,
  initialState,
  legalActions,
  makeFollower,
  targetsForAttack,
  targetsForSpell,
} from "../src/engine/game.ts";
import type { Action, GameState } from "../src/engine/game.ts";
const shot: Action = {
  type: "play",
  uid: "hand-attunement",
  target: "enemy-goliath",
};
const trade: Action = {
  type: "attack",
  uid: "player-fighter",
  target: "enemy-goliath",
};
const quick: Action = { type: "play", uid: "hand-quickblader" };
const blade: Action = {
  type: "play",
  uid: "hand-blade",
  target: "enemy-leader",
};
const goliath: Action = {
  type: "attack",
  uid: "player-goliath",
  target: "enemy-leader",
};
const quickAttack: Action = {
  type: "attack",
  uid: "hand-quickblader",
  target: "enemy-leader",
};
const run = (actions: Action[], state = initialState()) =>
  actions.reduce(applyAction, state);

test("verified card definitions match the selected official rules", () => {
  assert.equal(getCard(CARD.quickblader).cost, 1);
  assert.equal(getCard(CARD.quickblader).storm, true);
  assert.equal(getCard(CARD.goliath).ward, true);
  assert.equal(getCard(CARD.goliath).health, 5);
  assert.equal(getCard(CARD.attunement).kind, "spell");
  assert.equal(getCard(CARD.blade).cost, 1);
});
test("reference sequence wins through actual damage resolution", () => {
  const s = run([shot, trade, quick, goliath, quickAttack, blade]);
  assert.equal(s.status, "won");
  assert.equal(s.enemyHp, 0);
  assert.equal(s.pp, 0);
  assert.equal(s.playerHp, 10);
  assert.equal(
    s.player.some((f) => f.uid === "player-fighter"),
    false,
  );
  assert.equal(s.enemy.length, 0);
});
test("different legal sequences also win", () => {
  const s = run([blade, quick, trade, shot, quickAttack, goliath]);
  assert.equal(s.status, "won");
  assert.equal(s.enemyHp, 0);
});
test("ward blocks follower leader attacks without changing state", () => {
  const s = initialState(),
    snapshot = structuredClone(s);
  assert.throws(() => applyAction(s, goliath), /守護/);
  assert.deepEqual(s, snapshot);
  assert.deepEqual(targetsForAttack(s, "player-goliath"), ["enemy-goliath"]);
});
test("direct-damage spells bypass ward; follower-only spell cannot hit leader", () => {
  assert.equal(run([blade]).enemyHp, 5);
  assert.deepEqual(targetsForSpell(initialState(), "hand-blade"), [
    "enemy-goliath",
    "enemy-leader",
  ]);
  assert.throws(
    () => applyAction(initialState(), { ...shot, target: "enemy-leader" }),
    /有效/,
  );
});
test("combat damage is simultaneous and dead followers leave both boards", () => {
  const s = run([trade]);
  assert.equal(s.enemy[0].health, 3);
  assert.equal(s.player.length, 1);
  const killed = run([shot, trade]);
  assert.equal(killed.enemy.length, 0);
  assert.equal(killed.player.length, 1);
});
test("spending the large attacker on the guard loses lethal", () => {
  let s = run([
    shot,
    { type: "attack", uid: "player-goliath", target: "enemy-goliath" },
    quick,
  ]);
  s = run(
    [
      { type: "attack", uid: "player-fighter", target: "enemy-leader" },
      quickAttack,
      blade,
    ],
    s,
  );
  assert.equal(s.enemyHp, 2);
  assert.equal(s.status, "playing");
  assert.equal(legalActions(s).length, 0);
  assert.equal(applyAction(s, { type: "finish" }).status, "failed");
});
test("followers cannot attack twice and summoning does not grant normal immediate attacks", () => {
  const s = run([shot, trade, goliath]);
  assert.throws(() => applyAction(s, goliath), /無法攻擊/);
  const custom = initialState();
  custom.enemy = [];
  custom.hand = [{ uid: "fighter-hand", cardId: CARD.fighter }];
  const summoned = applyAction(custom, { type: "play", uid: "fighter-hand" });
  assert.throws(
    () =>
      applyAction(summoned, {
        type: "attack",
        uid: "fighter-hand",
        target: "enemy-leader",
      }),
    /無法攻擊/,
  );
  assert.equal(run([quick]).player.at(-1)!.canAttack, true);
});
test("not enough PP and full board reject summons without mutating state", () => {
  const s = initialState();
  s.pp = 0;
  assert.throws(() => applyAction(s, quick), /PP 不足/);
  assert.equal(s.hand.length, 3);
  const full = initialState();
  full.player = Array.from({ length: 5 }, (_, i) =>
    makeFollower(CARD.fighter, "f" + i),
  );
  assert.throws(() => applyAction(full, quick), /5 張/);
});
test("fighter enhance uses four PP and boosts both stats", () => {
  const s = initialState();
  s.pp = 4;
  s.hand = [{ uid: "fighter-hand", cardId: CARD.fighter }];
  const next = applyAction(s, { type: "play", uid: "fighter-hand" });
  assert.equal(next.pp, 0);
  assert.equal(next.player.at(-1)!.attack, 5);
  assert.equal(next.player.at(-1)!.health, 5);
});
test("rally increments on entering followers and attunement threshold applies", () => {
  const s = run([quick]);
  assert.equal(s.rally, 7);
  const boosted = initialState();
  boosted.rally = 10;
  assert.equal(applyAction(boosted, shot).enemy[0].attackLocked, true);
});
test("ended attempts reject further actions", () => {
  assert.throws(
    () =>
      applyAction(
        run([shot, trade, quick, goliath, quickAttack, blade]),
        quick,
      ),
    /結束/,
  );
  assert.throws(() => applyAction(run([{ type: "finish" }]), quick), /結束/);
});
test("exhaustive legal action search finds multiple wins and preserves invariants", () => {
  let wins = 0,
    deadEnds = 0;
  const stack: GameState[] = [initialState()];
  while (stack.length) {
    const s = stack.pop()!;
    assert.ok(s.pp >= 0);
    assert.ok(s.player.length <= 5);
    assert.ok(s.enemy.every((f) => f.health > 0));
    if (s.status === "won") {
      assert.equal(s.enemyHp, 0);
      wins++;
      continue;
    }
    const actions = legalActions(s);
    if (!actions.length) {
      deadEnds++;
      continue;
    }
    for (const action of actions) stack.push(applyAction(s, action));
  }
  assert.ok(wins > 1);
  assert.ok(deadEnds > 0);
});
