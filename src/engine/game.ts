import { CARD, getCard } from "../data/cards.ts";
export interface HandCard {
  uid: string;
  cardId: string;
}
export interface Follower extends HandCard {
  attack: number;
  health: number;
  canAttack: boolean;
  ward: boolean;
  summonedThisTurn: boolean;
  attackLocked: boolean;
}
export type Target = "enemy-leader" | string;
export type Action =
  | { type: "play"; uid: string; target?: Target }
  | { type: "attack"; uid: string; target: Target }
  | { type: "finish" };
export interface GameState {
  playerHp: number;
  enemyHp: number;
  pp: number;
  maxPp: number;
  rally: number;
  turn: number;
  ep: number;
  sep: number;
  player: Follower[];
  enemy: Follower[];
  hand: HandCard[];
  status: "playing" | "won" | "failed";
  log: { text: string; kind: "spell" | "attack" | "summon" | "finish" }[];
  damage: { target: string; amount: number; id: number } | null;
}
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
export function makeFollower(
  cardId: string,
  uid: string,
  ready = true,
): Follower {
  const c = getCard(cardId);
  return {
    uid,
    cardId,
    attack: c.attack,
    health: c.health,
    ward: c.ward,
    canAttack: ready,
    summonedThisTurn: !ready,
    attackLocked: false,
  };
}
export function initialState(): GameState {
  return {
    playerHp: 10,
    enemyHp: 6,
    pp: 3,
    maxPp: 8,
    turn: 8,
    ep: 0,
    sep: 0,
    rally: 6,
    player: [
      makeFollower(CARD.goliath, "player-goliath"),
      makeFollower(CARD.fighter, "player-fighter"),
    ],
    enemy: [makeFollower(CARD.goliath, "enemy-goliath")],
    hand: [
      { uid: "hand-attunement", cardId: CARD.attunement },
      { uid: "hand-quickblader", cardId: CARD.quickblader },
      { uid: "hand-blade", cardId: CARD.blade },
    ],
    status: "playing",
    log: [],
    damage: null,
  };
}
function assertPlaying(s: GameState) {
  if (s.status !== "playing")
    throw new RuleError("這次挑戰已結束，重新開始再試。");
}
export function playCost(s: GameState, cardId: string): number {
  return cardId === CARD.fighter && s.pp >= 4 ? 4 : getCard(cardId).cost;
}
export function targetsForAttack(s: GameState, uid: string): Target[] {
  const f = s.player.find((c) => c.uid === uid);
  if (s.status !== "playing" || !f?.canAttack || f.attackLocked) return [];
  const wards = s.enemy.filter((c) => c.ward);
  return wards.length
    ? wards.map((c) => c.uid)
    : [...s.enemy.map((c) => c.uid), "enemy-leader"];
}
export function targetsForSpell(s: GameState, uid: string): Target[] {
  const h = s.hand.find((c) => c.uid === uid);
  if (s.status !== "playing" || !h || s.pp < playCost(s, h.cardId)) return [];
  if (h.cardId === CARD.attunement) return s.enemy.map((c) => c.uid);
  if (h.cardId === CARD.blade)
    return [...s.enemy.map((c) => c.uid), "enemy-leader"];
  return [];
}
export function canSummon(s: GameState, uid: string): boolean {
  const h = s.hand.find((c) => c.uid === uid);
  return (
    s.status === "playing" &&
    !!h &&
    getCard(h.cardId).kind === "follower" &&
    s.pp >= playCost(s, h.cardId) &&
    s.player.length < 5
  );
}
export function legalActions(s: GameState): Action[] {
  if (s.status !== "playing") return [];
  const actions: Action[] = [];
  for (const h of s.hand) {
    if (canSummon(s, h.uid)) actions.push({ type: "play", uid: h.uid });
    for (const target of targetsForSpell(s, h.uid))
      actions.push({ type: "play", uid: h.uid, target });
  }
  for (const f of s.player)
    for (const target of targetsForAttack(s, f.uid))
      actions.push({ type: "attack", uid: f.uid, target });
  return actions;
}
function damageEnemy(s: GameState, target: string, damage: number) {
  if (target === "enemy-leader") s.enemyHp = Math.max(0, s.enemyHp - damage);
  else {
    const f = s.enemy.find((c) => c.uid === target);
    if (!f) throw new RuleError("目標已離場。");
    f.health -= damage;
  }
  s.damage = { target, amount: damage, id: s.log.length + 1 };
}
function removeDead(s: GameState) {
  s.player = s.player.filter((c) => c.health > 0);
  s.enemy = s.enemy.filter((c) => c.health > 0);
}
export function applyAction(original: GameState, action: Action): GameState {
  assertPlaying(original);
  const s = structuredClone(original);
  if (action.type === "finish") {
    s.status = s.enemyHp <= 0 ? "won" : "failed";
    s.log.push({
      text: `結束嘗試：對手剩餘 ${s.enemyHp} 點生命。`,
      kind: "finish",
    });
    return s;
  }
  if (action.type === "play") {
    const h = s.hand.find((c) => c.uid === action.uid);
    if (!h) throw new RuleError("這張卡牌不在手牌。");
    const c = getCard(h.cardId),
      cost = playCost(s, h.cardId);
    if (s.pp < cost) throw new RuleError(`PP 不足，需要 ${cost} PP。`);
    if (c.kind === "follower") {
      if (action.target) throw new RuleError("這張從者不需要指定目標。");
      if (s.player.length >= 5) throw new RuleError("我方場上已有 5 張卡牌。");
      const f = makeFollower(h.cardId, h.uid, c.storm);
      f.summonedThisTurn = true;
      if (h.cardId === CARD.fighter && cost === 4) {
        f.attack += 3;
        f.health += 3;
      }
      s.player.push(f);
      s.rally += 1;
      s.log.push({
        text: `使用 ${cost} PP 打出「${c.name}」${c.storm ? "，疾馳可立即攻擊" : ""}。`,
        kind: "summon",
      });
    } else {
      if (!action.target || !targetsForSpell(s, h.uid).includes(action.target))
        throw new RuleError("請選擇有效的敵方目標。");
      const targetName =
        action.target === "enemy-leader"
          ? "對手主戰者"
          : getCard(s.enemy.find((f) => f.uid === action.target)!.cardId).name;
      const amount = h.cardId === CARD.attunement ? 3 : 1;
      if (h.cardId === CARD.attunement && s.rally >= 10)
        s.enemy.find((f) => f.uid === action.target)!.attackLocked = true;
      damageEnemy(s, action.target, amount);
      s.log.push({
        text: `使用 ${cost} PP 打出「${c.name}」，對${targetName}造成 ${amount} 點傷害。`,
        kind: "spell",
      });
    }
    s.pp -= cost;
    s.hand = s.hand.filter((c) => c.uid !== action.uid);
  } else {
    const f = s.player.find((c) => c.uid === action.uid);
    if (!f) throw new RuleError("攻擊從者不在場上。");
    if (!f.canAttack || f.attackLocked)
      throw new RuleError("這張從者目前無法攻擊。");
    if (!targetsForAttack(s, f.uid).includes(action.target))
      throw new RuleError(
        s.enemy.some((c) => c.ward)
          ? "對手有守護從者，必須先處理守護。"
          : "攻擊目標無效。",
      );
    const name = getCard(f.cardId).name;
    if (action.target === "enemy-leader") {
      damageEnemy(s, action.target, f.attack);
      s.log.push({
        text: `「${name}」攻擊對手主戰者，造成 ${f.attack} 點傷害。`,
        kind: "attack",
      });
    } else {
      const enemy = s.enemy.find((c) => c.uid === action.target)!;
      const attack = f.attack,
        retaliation = enemy.attack;
      damageEnemy(s, enemy.uid, attack);
      f.health -= retaliation;
      s.log.push({
        text: `「${name}」攻擊「${getCard(enemy.cardId).name}」，雙方同時造成 ${attack}／${retaliation} 點傷害。`,
        kind: "attack",
      });
    }
    f.canAttack = false;
  }
  removeDead(s);
  if (s.enemyHp <= 0 && s.playerHp > 0) s.status = "won";
  else if (s.playerHp <= 0) s.status = "failed";
  return s;
}
