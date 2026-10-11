import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Diamond,
  ExternalLink,
  Flag,
  History,
  Info,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Undo2,
  X,
} from "lucide-react";
import GameCard from "./components/GameCard";
import { asset } from "./assets";
import Modal from "./components/Modal";
import { cards, getCard } from "./data/cards";
import { puzzle } from "./data/puzzle";
import {
  applyAction,
  canSummon,
  initialState,
  legalActions,
  playCost,
  targetsForAttack,
  targetsForSpell,
} from "./engine/game";
import type { Action, Follower, GameState } from "./engine/game";

type Selection = { kind: "hand" | "player"; uid: string } | null;
type Dialog =
  | "sources"
  | "cards"
  | "rules"
  | "solution"
  | "card"
  | "reset"
  | "finish"
  | null;
const copyrightNotice =
  "This website/application is not affiliated with, endorsed by, sponsored by, or individually approved by Cygames. Cygames bears no responsibility for the operation or content of this website/application. The use of Cygames trademarks and other intellectual property is subject to the Cygames Fan Kit terms of use. For more information about Cygames, please visit the Cygames website (https://www.cygames.co.jp/en/).";

export default function App() {
  const [state, setState] = useState<GameState>(initialState);
  const [history, setHistory] = useState<GameState[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [tab, setTab] = useState<"details" | "log">("details");
  const [message, setMessage] = useState("");
  const [solved, setSolved] = useState(() => {
    try {
      return localStorage.getItem("wb-lethal-001-solved") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (state.status === "won") {
      setSolved(true);
      try {
        localStorage.setItem("wb-lethal-001-solved", "true");
      } catch {
        /* Practice remains available if storage is unavailable. */
      }
    }
  }, [state.status]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);
  function act(action: Action) {
    try {
      const next = applyAction(state, action);
      setHistory([...history, state]);
      setState(next);
      setSelection(null);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "無法執行操作。");
    }
  }
  function reset() {
    setState(initialState());
    setHistory([]);
    setSelection(null);
    setHints(0);
    setDialog(null);
    setMessage("");
  }
  function requestReset() {
    if (state.log.length) setDialog("reset");
    else reset();
  }
  function undo() {
    if (!history.length) return;
    setState(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setSelection(null);
  }
  const selectedInstance =
    selection?.kind === "hand"
      ? state.hand.find((c) => c.uid === selection.uid)
      : state.player.find((c) => c.uid === selection?.uid);
  const selectedCard = selectedInstance
    ? getCard(selectedInstance.cardId)
    : null;
  const targetIds = selection
    ? selection.kind === "hand"
      ? targetsForSpell(state, selection.uid)
      : targetsForAttack(state, selection.uid)
    : [];
  const canPlay =
    !!selection && selection.kind === "hand" && canSummon(state, selection.uid);
  function chooseTarget(target: string) {
    if (!selection) {
      if (target !== "enemy-leader") {
        const f = state.enemy.find((c) => c.uid === target);
        if (f) {
          setInspectId(f.cardId);
          setDialog("card");
        }
      }
      return;
    }
    act(
      selection.kind === "hand"
        ? { type: "play", uid: selection.uid, target }
        : { type: "attack", uid: selection.uid, target },
    );
  }
  function select(kind: "hand" | "player", uid: string) {
    if (state.status !== "playing") return;
    setSelection(selection?.uid === uid ? null : { kind, uid });
    setTab("details");
    if (
      kind === "player" &&
      !state.player.find((c) => c.uid === uid)?.canAttack
    )
      setMessage("這張從者已攻擊，或目前無法攻擊。");
  }
  function inspect(id: string) {
    setInspectId(id);
    setDialog("card");
  }
  function lane(followers: Follower[], side: "player" | "enemy") {
    const before = Math.floor((5 - followers.length) / 2),
      slots: (Follower | null)[] = [
        ...Array(before).fill(null),
        ...followers,
        ...Array(5 - followers.length - before).fill(null),
      ];
    return (
      <div className={`lane ${side}`}>
        <div className="lane-caption">
          <span>{side === "enemy" ? "對手戰場" : "我方戰場"}</span>
          <span>{followers.length} / 5</span>
        </div>
        <div className="lane-cards">
          {slots.map((f, i) =>
            f ? (
              <GameCard
                key={f.uid}
                instance={f}
                location={side}
                selected={selection?.uid === f.uid}
                targetable={targetIds.includes(f.uid)}
                onClick={() =>
                  side === "enemy"
                    ? chooseTarget(f.uid)
                    : select("player", f.uid)
                }
                onInspect={() => inspect(f.cardId)}
              />
            ) : (
              <div key={"empty" + i} className="empty-slot">
                <Diamond size={15} />
              </div>
            ),
          )}
        </div>
      </div>
    );
  }
  function leader(side: "player" | "enemy") {
    const enemy = side === "enemy",
      target = enemy && targetIds.includes("enemy-leader");
    const content = (
      <>
        <div className="leader-portrait">
          <img
            src={asset(
              `assets/leaders/character_${enemy ? "KaoriYuihara" : "MarieMalisse"}.png`,
            )}
            alt={enemy ? "Kaori Yuihara" : "Marie Malisse"}
          />
          <span
            className="leader-hp"
            data-testid={enemy ? "enemy-hp" : "player-hp"}
          >
            {enemy ? state.enemyHp : state.playerHp}
          </span>
        </div>
        <div className="leader-text">
          <small>{enemy ? "對手主戰者 · 巫師" : "我方主戰者 · 皇家護衛"}</small>
          <strong>{enemy ? "Kaori Yuihara" : "Marie Malisse"}</strong>
        </div>
        {target && (
          <span className="leader-target">
            選擇主戰者 <Target size={12} />
          </span>
        )}
      </>
    );
    return enemy ? (
      <button
        className={`leader enemy-leader ${target ? "targetable" : ""}`}
        data-testid="enemy-leader"
        onClick={() => chooseTarget("enemy-leader")}
        disabled={state.status !== "playing"}
        aria-label={`敵方主戰者，生命 ${state.enemyHp}${target ? "，可選目標" : ""}`}
      >
        {content}
      </button>
    ) : (
      <div className="leader">{content}</div>
    );
  }
  const statusText =
    state.status === "won"
      ? "斬殺成功"
      : state.status === "failed"
        ? "這次未能斬殺"
        : selection
          ? selectedCard?.kind === "follower" && selection.kind === "hand"
            ? "確認打出從者"
            : `已選擇 ${selectedCard?.name} · 點選目標`
          : "選擇手牌出牌，或選擇我方從者攻擊";
  const stuck = state.status === "playing" && legalActions(state).length === 0;
  return (
    <div className="app">
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setDialog(null);
          }}
        >
          <div className="brand-mark">
            <Swords size={25} />
          </div>
          <div>
            <strong>斬殺研究室</strong>
            <small>WORLDS BEYOND · PUZZLE LAB</small>
          </div>
        </a>
        <nav aria-label="主導覽">
          <span className="nav-active">斬殺挑戰</span>
          <button onClick={() => setDialog("cards")}>卡牌資料</button>
          <button onClick={() => setDialog("sources")}>
            素材來源 <ExternalLink size={12} />
          </button>
        </nav>
        <span className="unofficial">非官方玩家專案</span>
      </header>
      <main className="main">
        <div className="breadcrumb">
          <span>挑戰題庫</span>
          <ChevronRight size={12} />
          <span>皇家護衛</span>
          <ChevronRight size={12} />
          <span>PUZZLE {puzzle.number}</span>
        </div>
        <div className="title-row">
          <div>
            <div className="eyebrow">
              <span className="difficulty">{puzzle.difficulty}</span>
              <span>LETHAL CHALLENGE / {puzzle.number}</span>
              {solved && (
                <span className="completed">
                  <Trophy size={12} />
                  曾經完成
                </span>
              )}
            </div>
            <h1>{puzzle.title}</h1>
            <p>{puzzle.subtitle}</p>
          </div>
          <div className="title-actions">
            <button className="secondary" onClick={() => setDialog("rules")}>
              <CircleHelp size={15} />
              遊玩說明
            </button>
            <button className="secondary" onClick={requestReset}>
              <RotateCcw size={15} />
              重新開始
            </button>
          </div>
        </div>
        <div className="workspace">
          <section className="battle" aria-label="遊戲盤面">
            <img
              className="battle-background"
              src={asset("assets/ui/background_Swordcraft.png")}
              alt=""
            />
            <div className="battle-top">
              <span>
                <Swords size={12} /> 單回合斬殺
              </span>
              <span>第 {state.turn} 回合 · 我方回合</span>
            </div>
            {state.damage && (
              <div
                key={state.damage.id}
                className="combat-feedback"
                aria-hidden="true"
              >
                <strong>−{state.damage.amount}</strong>
                <span>
                  {state.damage.target === "enemy-leader"
                    ? "主戰者"
                    : "敵方從者"}
                  傷害
                </span>
              </div>
            )}
            <div className="enemy-area">
              {leader("enemy")}
              <div className="enemy-resource">
                <span>敵方生命</span>
                <strong>
                  {state.enemyHp}
                  <small> / 20</small>
                </strong>
              </div>
            </div>
            {lane(state.enemy, "enemy")}
            <div className="battle-divider">
              <span></span>
              <Diamond size={14} />
              <span></span>
            </div>
            {lane(state.player, "player")}
            <div className="player-area">
              {leader("player")}
              <div className="resources">
                <div className="pp-heading">
                  <span>PLAY POINTS</span>
                  <strong data-testid="pp">
                    {state.pp}
                    <small> / {state.maxPp}</small>
                  </strong>
                </div>
                <div className="pp-orbs">
                  {Array.from({ length: state.maxPp }, (_, i) => (
                    <span key={i} className={i < state.pp ? "lit" : ""} />
                  ))}
                </div>
                <div className="evolution">
                  <span>
                    進化 <b>{state.ep}</b>
                  </span>
                  <span>
                    超進化 <b>{state.sep}</b>
                  </span>
                  <span>
                    協作 <b>{state.rally}</b>
                  </span>
                </div>
              </div>
            </div>
            <div
              className={`action-bar ${selection ? "selecting" : ""} ${state.status === "won" ? "won" : ""}`}
              role="status"
            >
              <span>
                {state.status === "won" ? (
                  <Trophy size={16} />
                ) : selection ? (
                  <Target size={16} />
                ) : (
                  <Info size={15} />
                )}{" "}
                {statusText}
              </span>
              {selection && (
                <button
                  className="icon-btn"
                  aria-label="取消選擇"
                  onClick={() => setSelection(null)}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="hand-area">
              <div className="hand-heading">
                <span>
                  我方手牌 <b>{state.hand.length}</b>
                </span>
                <span>點擊卡牌選擇</span>
              </div>
              <div className="hand-cards">
                {state.hand.map((c) => (
                  <GameCard
                    key={c.uid}
                    instance={c}
                    location="hand"
                    selected={selection?.uid === c.uid}
                    affordable={state.pp >= playCost(state, c.cardId)}
                    onClick={() => select("hand", c.uid)}
                    onInspect={() => inspect(c.cardId)}
                  />
                ))}
                {!state.hand.length && (
                  <div className="hand-empty">手牌已用盡</div>
                )}
              </div>
            </div>
            <div className="battle-toolbar">
              <button
                className="text-btn"
                onClick={undo}
                disabled={!history.length}
              >
                <Undo2 size={14} />
                退回一步
              </button>
              <span>{state.log.length} 次操作</span>
              <button
                className="text-btn"
                onClick={() => setDialog("finish")}
                disabled={state.status !== "playing"}
              >
                <Flag size={14} />
                結束嘗試
              </button>
            </div>
          </section>
          <aside className="sidebar">
            <section className="objective panel">
              <div className="panel-kicker">
                <Target size={15} />
                挑戰目標<span>01 / 01</span>
              </div>
              <h2>{puzzle.goal}</h2>
              <div className="objective-stats">
                <span>
                  對手生命 <b>{state.enemyHp}</b>
                </span>
                <span>
                  剩餘 PP <b>{state.pp}</b>
                </span>
              </div>
              <details>
                <summary>
                  盤面設定與補充規則 <ChevronRight size={12} />
                </summary>
                <ul>
                  {puzzle.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
            </section>
            <section className="inspector panel">
              <div className="tabs">
                <button
                  className={tab === "details" ? "active" : ""}
                  onClick={() => setTab("details")}
                >
                  <BookOpen size={13} />
                  卡牌詳情
                </button>
                <button
                  className={tab === "log" ? "active" : ""}
                  onClick={() => setTab("log")}
                >
                  <History size={13} />
                  操作紀錄 <span>{state.log.length}</span>
                </button>
              </div>
              {tab === "details" ? (
                selectedCard ? (
                  <div className="card-detail">
                    <img
                      className="detail-art"
                      src={asset(selectedCard.image)}
                      alt={selectedCard.name}
                    />
                    <h3>{selectedCard.name}</h3>
                    <div className="detail-meta">
                      {selectedCard.kind === "spell" ? "法術" : "從者"} ·{" "}
                      {selectedCard.cost} PP
                    </div>
                    <p>{selectedCard.text}</p>
                    {canPlay ? (
                      <button
                        className="primary full"
                        data-testid="summon"
                        onClick={() =>
                          act({ type: "play", uid: selection!.uid })
                        }
                      >
                        打出從者 · {playCost(state, selectedCard.id)} PP{" "}
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <div className="target-help">
                        {targetIds.length
                          ? "點擊盤面上亮起的目標"
                          : "目前沒有可用目標或 PP 不足"}
                      </div>
                    )}
                    <button
                      className="text-btn source-link"
                      onClick={() => inspect(selectedCard.id)}
                    >
                      查看完整卡牌資料 <ExternalLink size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="inspect-empty">
                    <div className="inspect-symbol">
                      <Diamond size={24} />
                    </div>
                    <h3>每一步，都有可能。</h3>
                    <p>
                      選擇手牌或我方從者，
                      <br />
                      查看能力與下一個操作。
                    </p>
                    <div className="quick-guide">
                      <span>
                        <b>1</b> 選擇卡牌
                      </span>
                      <span>
                        <b>2</b> 指定目標
                      </span>
                      <span>
                        <b>3</b> 完成斬殺
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div className="log-list">
                  {state.log.length ? (
                    <ol>
                      {state.log.map((entry, i) => (
                        <li key={i}>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <p>{entry.text}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="log-empty">
                      <History size={24} />
                      <p>你的每一步會記錄在這裡。</p>
                    </div>
                  )}
                </div>
              )}
            </section>
            <section className="hint-panel panel">
              <div className="panel-kicker">
                <Sparkles size={14} />
                一點提示
              </div>
              {hints > 0 ? (
                <p>
                  {puzzle.hints[Math.min(hints - 1, puzzle.hints.length - 1)]}
                </p>
              ) : (
                <p>
                  卡住了？試試先想清楚，
                  <br />
                  哪一份傷害應該留給主戰者。
                </p>
              )}
              <button
                className="secondary full"
                onClick={() =>
                  setHints(Math.min(hints + 1, puzzle.hints.length))
                }
                disabled={hints >= puzzle.hints.length}
              >
                {hints === 0
                  ? "顯示提示"
                  : hints >= puzzle.hints.length
                    ? "已顯示全部提示"
                    : "下一個提示"}
                <ChevronRight size={14} />
              </button>
              <button
                className="text-btn solution-link"
                onClick={() => setDialog("solution")}
              >
                查看參考解法
              </button>
            </section>
            {state.status === "won" && (
              <section className="result won-result" data-testid="success">
                <Trophy size={28} />
                <h2>斬殺成功！</h2>
                <p>你用 {state.log.length} 次操作解開了盤面。</p>
                <button
                  className="primary full"
                  onClick={() => setDialog("solution")}
                >
                  對照參考解法
                </button>
                <button className="text-btn" onClick={reset}>
                  再試另一種次序
                </button>
              </section>
            )}
            {(state.status === "failed" || stuck) && (
              <section className="result fail-result" data-testid="failure">
                <Shield size={25} />
                <h3>{stuck ? "已沒有合法操作" : "這次未能斬殺"}</h3>
                <p>對手仍剩 {state.enemyHp} 點生命，試試不同的傷害分配。</p>
                <button className="secondary full" onClick={requestReset}>
                  重新挑戰
                </button>
              </section>
            )}
          </aside>
        </div>
        <div className="bottom-note">
          <Shield size={13} />
          <span>固定盤面 · 官方繁中卡牌資料 · 多種操作次序均可判定</span>
          <button onClick={() => setDialog("sources")}>
            查看資料來源 <ArrowRight size={12} />
          </button>
        </div>
      </main>
      <footer>
        <div>
          <span className="footer-brand">
            <Swords size={15} />
            斬殺研究室
          </span>
          <span>非官方玩家專案 · Shadowverse: Worlds Beyond™</span>
          <strong>© Cygames, Inc.</strong>
        </div>
        <p>{copyrightNotice}</p>
        <button className="text-btn" onClick={() => setDialog("sources")}>
          素材、資料來源與使用說明 <ExternalLink size={11} />
        </button>
      </footer>
      {message && (
        <div className="toast" role="alert">
          <Info size={16} />
          {message}
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog === "sources"
              ? "素材與資料來源"
              : dialog === "cards"
                ? "本題卡牌資料"
                : dialog === "rules"
                  ? "點擊盤面，解開斬殺"
                  : dialog === "solution"
                    ? "參考解法"
                    : dialog === "reset"
                      ? "重新開始？"
                      : dialog === "finish"
                        ? "結束這次嘗試？"
                        : "卡牌資料"
          }
          onClose={() => setDialog(null)}
        >
          {dialog === "rules" && (
            <div className="rules-content">
              <p>目標：在本回合把對手生命降至 0。每個操作都會按規則結算。</p>
              <ol>
                <li>點擊手牌法術，再點擊亮起的敵方目標。</li>
                <li>點擊手牌從者，再按「打出從者」。</li>
                <li>點擊我方可攻擊從者，再指定攻擊目標。</li>
              </ol>
              <p>
                守護會限制從者攻擊；法術仍按自己的能力選目標。普通新進場從者本回合不能攻擊，疾馳從者可以。
              </p>
              <p>
                使用「退回一步」或「重新開始」嘗試另一個方法。此版本只支援本題卡牌及單回合操作，沒有下一回合。
              </p>
            </div>
          )}
          {dialog === "solution" && (
            <div className="solution-content">
              <div className="solution-summary">
                <Swords size={20} />
                <span>解開守護 → 保留 4 點攻擊 → 疾馳與法術補足傷害</span>
              </div>
              <ol>
                {puzzle.solution.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p>
                以上是其中一種合法解法。出牌次序可以不同，系統按最終盤面判斷成功。
              </p>
              <button className="secondary" onClick={() => setDialog(null)}>
                <ArrowLeft size={14} />
                返回盤面
              </button>
            </div>
          )}
          {dialog === "reset" && (
            <>
              <p>目前的盤面與操作紀錄會回復至題目起點。</p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setDialog(null)}>
                  繼續挑戰
                </button>
                <button className="primary" onClick={reset}>
                  重新開始
                </button>
              </div>
            </>
          )}
          {dialog === "finish" && (
            <>
              <p>
                對手仍有 {state.enemyHp}{" "}
                點生命。結束後可以重新開始，或退回一步。
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setDialog(null)}>
                  繼續挑戰
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    act({ type: "finish" });
                    setDialog(null);
                  }}
                >
                  結束嘗試
                </button>
              </div>
            </>
          )}
          {(dialog === "cards" || dialog === "card") && (
            <div className="card-library">
              {(dialog === "card"
                ? cards.filter((c) => c.id === inspectId)
                : cards
              ).map((c) => (
                <article key={c.id}>
                  <img src={asset(c.image)} alt={c.name} />
                  <div>
                    <small>
                      {c.kind === "follower" ? "從者" : "法術"} · {c.cost} PP ·
                      ID {c.id}
                    </small>
                    <h3>{c.name}</h3>
                    <span className="english-name">{c.englishName}</span>
                    <p>{c.text}</p>
                    {c.kind === "follower" && (
                      <p>
                        原始攻擊／生命：{c.attack} / {c.health}
                      </p>
                    )}
                    <p className="muted">繪師：{c.illustrator}</p>
                    <a href={c.source} target="_blank" rel="noreferrer">
                      官方卡牌頁 <ExternalLink size={12} />
                    </a>
                  </div>
                </article>
              ))}
              <p className="muted">
                卡面顯示原始數值；戰場卡牌下方「目前」數值反映傷害及效果。卡牌資料為官方繁體中文版本。
              </p>
            </div>
          )}
          {dialog === "sources" && (
            <div className="sources-content">
              <p>
                遊戲、角色及卡牌素材：<strong>© Cygames, Inc.</strong>{" "}
                本站為非官方玩家研究原型。
              </p>
              <h3>卡牌圖片與效果</h3>
              <p>
                五張真實卡牌取自官方 Card
                Library，繁體中文資料快照及圖片存放於本專案。來源查核日期：2026-10-11。
              </p>
              <a
                href="https://shadowverse-wb.com/en/deck/cardslist/"
                target="_blank"
                rel="noreferrer"
              >
                官方 Card Library <ExternalLink size={12} />
              </a>
              <h3>主戰者與背景</h3>
              <p>
                Marie Malisse、Kaori Yuihara 及 Swordcraft 背景取自官方 Fan
                Kit。素材保留原檔，顯示時等比例縮放。
              </p>
              <a
                href="https://shadowverse-wb.com/en/special/fankit/"
                target="_blank"
                rel="noreferrer"
              >
                官方 Fan Kit <ExternalLink size={12} />
              </a>
              <h3>使用說明</h3>
              <p>
                Fan Kit
                素材受官方條款約束。卡牌圖片未核實有獨立再使用授權；此原型沒有聲稱獲官方授權。來源紀錄本身不代表使用許可。
              </p>
              <a
                href="https://shadowverse-wb.com/en/guideline/"
                target="_blank"
                rel="noreferrer"
              >
                官方內容指引 <ExternalLink size={12} />
              </a>
              <p className="muted">
                逐檔原始網址、日期及 SHA-256 記錄於 ASSET_SOURCES.md 及
                asset-manifest.json。
              </p>
              <a
                href={asset("data/asset-manifest.json")}
                target="_blank"
                rel="noreferrer"
              >
                查看素材來源清單 <ExternalLink size={12} />
              </a>
              <p className="legal-notice">{copyrightNotice}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
