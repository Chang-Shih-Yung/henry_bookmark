/**
 * Event bus — React ↔ Phaser scene 雙向訊息通道(Phase 3.5)。
 *
 * 為什麼用 event bus 而非 props:
 * - Phaser scene 是 OOP class,不是 React component,直接餵 props 不自然
 * - scene 內部任何時刻可能要通知 React(玩家點了 mascot、動畫播完了)
 * - React 任何時刻可能要指揮 scene(server 回了 newPikmin,scene 該生小精靈)
 *
 * 用最小自製 mitt-like 實作,避免新增 dependency。Type-safe。
 */

/* ============================================================
   Event types — 明確列出所有 React ↔ Phaser 訊息
   增刪事件時改這裡,TS 編譯期會抓到 mismatched listener
   ============================================================ */

export type IslandEvents = {
  /** React → Phaser:現在 island state 是 X(IslandScene 用來決定要 render 什麼) */
  'state:update': {
    tribeName: string;
    mascotAge: number;
    pikmin: ReadonlyArray<{
      id: string;
      color: 'green' | 'violet' | 'orange' | 'cyan' | 'grey';
      stage: string;
    }>;
    /** 是否還沒孵化(顯示蛋 vs 顯示 pikmin)*/
    hasHatched: boolean;
    /** 動畫中的 pikmin id,scene 跳過 render 避免跟 React EggHatchScene overlay 重疊 */
    hidePikminId: string | null;
  };

  /** Phaser → React:玩家點了 mascot(觸發 toast 一句話) */
  'mascot:tap': { x: number; y: number };

  /** Phaser → React:玩家點了 pikmin(Phase 5+ 觸發互動 / Phase 3.5 純記錄)*/
  'pikmin:tap': { id: string; color: string };

  /** Phaser → React:scene ready(代表 canvas 初始化完成,React 可以推 state 進來) */
  'scene:ready': null;

  /* ============================================================
     Phase 3.6 — 純 Phaser cinematic
     ============================================================ */

  /** React → Phaser:請播蛋孵化 cutscene(server trigger 來) */
  'cutscene:eggHatch': {
    pikminId: string;
    pikminColor: 'green' | 'violet' | 'orange' | 'cyan' | 'grey';
  };

  /** Phaser → React:蛋孵化 cutscene 動畫播完(scene 接下來 spawn idle pikmin)*/
  'cutscene:eggHatch:done': { pikminId: string };

  /** React → Phaser:請播 welcome cutscene */
  'cutscene:welcome': {
    pikminId: string;
    pikminColor: 'green' | 'violet' | 'orange' | 'cyan' | 'grey';
    tribeName: string;
    flavor: string;
  };

  /** Phaser → React:welcome cutscene user 按下「好」結束 */
  'cutscene:welcome:done': { pikminId: string };

  /** React → Phaser:請播月扣明信片儀式 cutscene */
  'cutscene:postcard': {
    postcardId: string;
    monthYYYYMM: string;
    body: string;
  };

  /** Phaser → React:postcard cutscene 完成(user 按「收下」)*/
  'cutscene:postcard:done': { postcardId: string };
};

type Listener<E extends keyof IslandEvents> = (data: IslandEvents[E]) => void;

class EventBus {
  private listeners = new Map<keyof IslandEvents, Set<Listener<keyof IslandEvents>>>();

  on<E extends keyof IslandEvents>(event: E, listener: Listener<E>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event)!;
    set.add(listener as Listener<keyof IslandEvents>);
    return () => {
      set.delete(listener as Listener<keyof IslandEvents>);
    };
  }

  emit<E extends keyof IslandEvents>(event: E, data: IslandEvents[E]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // 複製 set 防止 listener 在 emit 過程中修改原 set 導致 iteration 怪
    [...set].forEach((listener) => {
      try {
        (listener as Listener<E>)(data);
      } catch (err) {
        console.error(`[island-event-bus] listener for ${String(event)} threw`, err);
      }
    });
  }

  /** 清空所有 listeners — Phaser game destroy 時呼叫,避免 stale closure */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * 模組級單例 — React side 在 component lifecycle 內 on/off,Phaser scene 在
 * scene init 時 on/off。兩邊共用同一個 instance。
 *
 * 注意:Next.js 16 client component hot reload 可能造成此單例在 HMR 後 listeners
 * 殘留。islandEventBus.clear() 在 PhaserIslandHost unmount 時清。
 */
export const islandEventBus = new EventBus();
