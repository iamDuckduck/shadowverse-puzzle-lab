import { Shield, Swords, Zap, Check } from "lucide-react";
import { asset } from "../assets";
import { getCard } from "../data/cards";
import type { Follower, HandCard } from "../engine/game";
interface Props {
  instance: HandCard | Follower;
  location: "hand" | "player" | "enemy";
  selected?: boolean;
  targetable?: boolean;
  affordable?: boolean;
  onClick: () => void;
  onInspect: () => void;
}
export default function GameCard({
  instance,
  location,
  selected,
  targetable,
  affordable = true,
  onClick,
  onInspect,
}: Props) {
  const c = getCard(instance.cardId),
    f = "attack" in instance ? instance : null;
  return (
    <div
      className={`card-wrap ${selected ? "is-selected" : ""} ${targetable ? "is-target" : ""} ${!affordable ? "unaffordable" : ""}`}
    >
      <button
        className="game-card"
        data-testid={instance.uid}
        onClick={onClick}
        aria-label={`${c.name}${f ? `，攻擊 ${f.attack}，生命 ${f.health}` : `，${c.cost} PP`}${targetable ? "，可選目標" : ""}`}
        aria-pressed={selected}
      >
        <img src={asset(c.image)} alt={c.name} draggable="false" />
        {targetable && <span className="target-mark">選擇目標</span>}
        {selected && (
          <span className="selected-mark">
            <Check size={12} /> 已選擇
          </span>
        )}
      </button>
      {f ? (
        <div className="live-stats">
          <span className="live-label">目前</span>
          <span className="atk">
            <Swords size={11} />
            {f.attack}
          </span>
          <span className="def">♥ {f.health}</span>
        </div>
      ) : (
        <div className="hand-label">{c.name}</div>
      )}
      <div className="card-state">
        {f?.ward && (
          <span className="keyword">
            <Shield size={10} />
            守護
          </span>
        )}
        {c.storm && (
          <span className="keyword storm">
            <Zap size={10} />
            疾馳
          </span>
        )}
        {location === "player" && f && (
          <span className={f.canAttack ? "ready" : "spent"}>
            {f.canAttack ? "可攻擊" : "已用盡"}
          </span>
        )}
      </div>
      <button
        className="card-info"
        onClick={onInspect}
        aria-label={`查看${c.name}資料`}
      >
        查看卡牌
      </button>
    </div>
  );
}
