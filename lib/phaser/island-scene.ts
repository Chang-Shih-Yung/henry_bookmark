/**
 * IslandScene — Phaser 場景(Phase 3.5 — Phaser 重寫第一階段)。
 *
 * 渲染:mascot、pikmin(已孵化的)、egg(未孵化時)、島嶼背景。
 * 互動:tap mascot / tap pikmin → emit event bus event 給 React。
 *
 * Phase 3.5 限制:
 * - 視覺仍是純色圓圈 + 葉子(Phase 4 美術替換成 sprite sheet 再來大改)
 * - 沒有 walk cycle / 沒粒子 / 沒音效(Phase 3.6 / 3.7 才加)
 * - 蛋孵化動畫由 React `<EggHatchScene>` overlay 處理(Phase 3.6 才搬進 scene)
 *
 * 為什麼還用「圓圈」:Phaser 真正的差異 Phase 4 真美術才會發揮,Phase 3.5
 * 重點是**驗證架構走得通** — React ↔ Phaser bridge、scene lifecycle、tween、
 * tap input、event bus 全部能 work。畫面相似度 95% 跟 Phase 3 一樣。
 */

import Phaser from 'phaser';
import { islandEventBus, type IslandEvents } from './event-bus';

const COLOR_TO_HEX: Record<string, number> = {
  // 對應 globals.css 的 --pikmin-* token(oklch → hex 近似)
  green: 0x9bd66d,   // pikmin-green
  violet: 0x8b5fbf,  // pikmin-violet
  orange: 0xf2a766,  // pikmin-orange
  cyan: 0x66c2d6,    // pikmin-cyan
  grey: 0xa6a6a6,    // pikmin-grey
};

const PALETTE = {
  skyDay: 0xc8e0ec,
  grass: 0xa3d99b,
  water: 0x88c2d6,
  sand: 0xe8d8a3,
  soil: 0x9c7a4f,
  paper: 0xeee0c2,
  grassDark: 0x4f8c5a,
  foreground: 0xfbfbfb,
} as const;

const ISLAND_WIDTH = 360;
const ISLAND_HEIGHT = 480;

const PIKMIN_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 250, y: 280 },
  { x: 110, y: 250 },
  { x: 230, y: 380 },
  { x: 130, y: 330 },
  { x: 200, y: 220 },
];

/* ============================================================
   IslandScene
   ============================================================ */

type PikminInput = IslandEvents['state:update']['pikmin'];

export class IslandScene extends Phaser.Scene {
  private mascotContainer?: Phaser.GameObjects.Container;
  private mascotAgeText?: Phaser.GameObjects.Text;
  private pikminContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private eggContainer?: Phaser.GameObjects.Container;

  private currentState: IslandEvents['state:update'] | null = null;

  // event bus subscription cleanup
  private unsubscribeStateUpdate?: () => void;

  constructor() {
    super({ key: 'IslandScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // 訂閱 React 推進來的 state
    this.unsubscribeStateUpdate = islandEventBus.on('state:update', (state) => {
      this.currentState = state;
      this.syncToState();
    });

    // 通知 React scene 已準備好接收 state
    islandEventBus.emit('scene:ready', null);

    // 場景 cleanup
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeStateUpdate?.();
      this.pikminContainers.clear();
    });
  }

  /* ============================================================
     State sync — 根據 currentState 增刪 sprite
     ============================================================ */
  private syncToState() {
    if (!this.currentState) return;
    const { tribeName, mascotAge, pikmin, hasHatched, hidePikminId } = this.currentState;
    void tribeName; // Phase 3.5 暫沒用,Phase 4 sprite 會用族名做客製

    this.ensureMascot(mascotAge);

    // 蛋:hasHatched=false 時顯示
    if (!hasHatched) {
      this.ensureEgg();
    } else {
      this.removeEgg();
    }

    // Pikmin:同步 list,過濾掉 hidePikminId(React EggHatchScene overlay 正在播)
    const visible = pikmin.filter((p) => p.id !== hidePikminId);
    this.syncPikmin(visible);
  }

  private ensureMascot(age: number) {
    if (this.mascotContainer) {
      // 更新年齡 text
      this.mascotAgeText?.setText(`${age} 歲`);
      return;
    }

    const container = this.add.container(ISLAND_WIDTH / 2, ISLAND_HEIGHT / 2);

    // Mascot body
    const body = this.add.circle(0, 0, 24, PALETTE.sand);
    body.setStrokeStyle(2, PALETTE.foreground);
    container.add(body);

    // Age text
    const ageText = this.add
      .text(0, 38, `${age} 歲`, {
        fontSize: '10px',
        color: '#fbfbfbcc',
        fontFamily: 'ui-monospace, SF Mono, monospace',
      })
      .setOrigin(0.5, 0);
    container.add(ageText);
    this.mascotAgeText = ageText;

    // Hit area + tap → event bus
    body.setInteractive();
    body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      // squash-stretch micro animation(Phase 3.5 簡化版)
      this.tweens.add({
        targets: body,
        scaleX: 1.15,
        scaleY: 0.85,
        duration: 100,
        yoyo: true,
        ease: Phaser.Math.Easing.Cubic.Out,
      });
      islandEventBus.emit('mascot:tap', { x: container.x, y: container.y });
    });

    // Idle bob — 持續上下浮動
    this.tweens.add({
      targets: container,
      y: ISLAND_HEIGHT / 2 - 4,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });

    this.mascotContainer = container;
  }

  private ensureEgg() {
    if (this.eggContainer) return;

    const container = this.add.container(250, 280);
    const egg = this.add.circle(0, 0, 20, PALETTE.paper);
    egg.setStrokeStyle(2, PALETTE.soil);
    container.add(egg);

    // 從上掉下進場
    container.setY(280 - 40);
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      y: 280,
      alpha: 1,
      duration: 700,
      delay: 300,
      ease: Phaser.Math.Easing.Cubic.Out,
    });

    this.eggContainer = container;
  }

  private removeEgg() {
    if (!this.eggContainer) return;
    this.eggContainer.destroy();
    this.eggContainer = undefined;
  }

  private syncPikmin(list: PikminInput) {
    const incomingIds = new Set(list.map((p) => p.id));

    // 移除不在 list 的舊 sprite
    for (const [id, container] of this.pikminContainers) {
      if (!incomingIds.has(id)) {
        container.destroy();
        this.pikminContainers.delete(id);
      }
    }

    // 新增 / 確保存在
    list.forEach((p, i) => {
      if (this.pikminContainers.has(p.id)) return;
      const pos = PIKMIN_POSITIONS[i] ?? PIKMIN_POSITIONS[0];
      const container = this.add.container(pos.x, pos.y);

      // 葉子 stem
      const stem = this.add.line(0, -28, 0, 0, 0, 14, PALETTE.grassDark, 1);
      stem.setLineWidth(2);
      container.add(stem);

      // 葉子(水滴形 simplified to ellipse for now)
      const leaf = this.add.ellipse(0, -32, 10, 8, COLOR_TO_HEX.green);
      leaf.setStrokeStyle(1.5, PALETTE.grassDark);
      container.add(leaf);

      // Body
      const body = this.add.circle(0, 0, 20, COLOR_TO_HEX[p.color] ?? 0xffffff);
      body.setStrokeStyle(2, PALETTE.foreground);
      container.add(body);

      // Hit area
      body.setInteractive();
      body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.tweens.add({
          targets: body,
          scaleX: 1.15,
          scaleY: 0.85,
          duration: 100,
          yoyo: true,
        });
        islandEventBus.emit('pikmin:tap', { id: p.id, color: p.color });
      });

      // Idle bob with random offset(避免所有 pikmin 同步上下動)
      this.tweens.add({
        targets: container,
        y: pos.y - 3,
        duration: 1500 + Math.random() * 600,
        delay: Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });

      this.pikminContainers.set(p.id, container);
    });
  }
}
