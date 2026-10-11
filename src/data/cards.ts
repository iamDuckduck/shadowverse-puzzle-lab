import raw from "./cards.json" with { type: "json" };
export interface CardDefinition {
  id: string;
  name: string;
  englishName: string;
  kind: "follower" | "spell";
  cost: number;
  attack: number;
  health: number;
  text: string;
  image: string;
  ward: boolean;
  storm: boolean;
  source: string;
  illustrator: string;
  setId: number;
}
export const cards = raw as CardDefinition[];
export const cardMap = Object.fromEntries(
  cards.map((c) => [c.id, c]),
) as Record<string, CardDefinition>;
export function getCard(id: string): CardDefinition {
  const definition = cardMap[id];
  if (!definition) throw new Error(`Unknown card: ${id}`);
  return definition;
}
export const CARD = {
  fighter: "10001110",
  goliath: "10001130",
  quickblader: "10021110",
  attunement: "10721310",
  blade: "90021310",
} as const;
