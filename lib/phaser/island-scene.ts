/**
 * IslandScene — Phaser 場景(Phase 3.5 + 3.5.1 procedural sprite polish)。
 *
 * 渲染:mascot、pikmin、egg-pot、雲、草叢、互動。
 * 互動:tap mascot / tap pikmin → emit event bus event 給 React。
 *
 * Phase 3.5.1 升級 vs 3.5:
 * - 純色圓圈 → procedural sprite(mascot 五官 + 身體、pikmin 大眼 + stem 葉子、egg-pot 茶杯造型 + 嫩芽)
 * - 加雲(背景持續飄)、草叢(地面點綴)
 * - Sprite 結構抽到 lib/phaser/sprites.ts,Phase 4 真實美術 sprite atlas 替換時改那邊
 */

import Phaser from 'phaser';
import { islandEventBus, type IslandEvents } from './event-bus';
import { sfxPikminTap, sfxTap, unlock as unlockAudio } from './audio';
import { runEggHatch } from './scenes/egg-hatch-scene';
import { runWelcomeCutscene } from './scenes/welcome-cutscene';
import {
  createCloudSprite,
  createEggPotSprite,
  createGrassTuft,
  createMascotSprite,
  createPikminSprite,
} from './sprites';

const ISLAND_WIDTH = 360;
const ISLAND_HEIGHT = 480;

/** 偵測 user OS 是否開啟「降低動態效果」(GDD §32.6 a11y 規格) */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

type MascotRefs = ReturnType<typeof createMascotSprite>;
type PikminRefs = ReturnType<typeof createPikminSprite>;
type EggRefs = ReturnType<typeof createEggPotSprite>;

export class IslandScene extends Phaser.Scene {
  private mascotRefs?: MascotRefs;
  private pikminContainers: Map<string, PikminRefs> = new Map();
  private eggRefs?: EggRefs;

  private currentState: IslandEvents['state:update'] | null = null;
  private unsubscribeStateUpdate?: () => void;
  private unsubscribeEggHatch?: () => void;
  private unsubscribeWelcome?: () => void;

  constructor() {
    super({ key: 'IslandScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // 環境(雲 + 草叢)— 持續飄 / 微擺
    this.spawnAmbientClouds();
    this.spawnGrassTufts();

    // 訂閱 React 推進來的 state
    this.unsubscribeStateUpdate = islandEventBus.on('state:update', (state) => {
      this.currentState = state;
      this.syncToState();
    });

    // 訂閱 React 觸發的 cutscene
    this.unsubscribeEggHatch = islandEventBus.on(
      'cutscene:eggHatch',
      async ({ pikminId, pikminColor }) => {
        await runEggHatch(this, {
          x: 250,
          y: 280,
          pikminColor,
          reducedMotion: prefersReducedMotion(),
        });
        islandEventBus.emit('cutscene:eggHatch:done', { pikminId });
      },
    );

    this.unsubscribeWelcome = islandEventBus.on(
      'cutscene:welcome',
      async ({ pikminId, pikminColor, tribeName, flavor }) => {
        await runWelcomeCutscene(this, {
          centerX: ISLAND_WIDTH / 2,
          centerY: ISLAND_HEIGHT / 2,
          width: ISLAND_WIDTH,
          tribeName,
          pikminColor,
          flavor,
          reducedMotion: prefersReducedMotion(),
        });
        islandEventBus.emit('cutscene:welcome:done', { pikminId });
      },
    );

    // 通知 React scene 已準備好
    islandEventBus.emit('scene:ready', null);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeStateUpdate?.();
      this.unsubscribeEggHatch?.();
      this.unsubscribeWelcome?.();
      this.pikminContainers.clear();
    });
  }

  /* ============================================================
     Ambient environment — 雲跟草叢,只在 create 時建一次,持續動
     ============================================================ */

  private spawnAmbientClouds() {
    // 3 朵不同大小的雲,從左飄到右,各自速度跟高度不同
    const clouds = [
      { y: 50, size: 'medium' as const, speed: 60_000, startX: -40 },
      { y: 90, size: 'small' as const, speed: 45_000, startX: -80 },
      { y: 130, size: 'small' as const, speed: 70_000, startX: -120 },
    ];

    clouds.forEach((c) => {
      const cloud = createCloudSprite(this, c.size);
      cloud.setPosition(c.startX, c.y);
      this.tweens.add({
        targets: cloud,
        x: ISLAND_WIDTH + 60,
        duration: c.speed,
        repeat: -1,
        ease: 'Linear',
        onRepeat: () => {
          cloud.setX(c.startX);
        },
      });
    });
  }

  private spawnGrassTufts() {
    // 6-8 撮草,散在「島嶼草地」高度範圍,微風搖擺
    const tuftPositions = [
      { x: 60, y: 400 },
      { x: 90, y: 440 },
      { x: 140, y: 410 },
      { x: 200, y: 450 },
      { x: 280, y: 420 },
      { x: 310, y: 390 },
      { x: 180, y: 470 },
    ];

    tuftPositions.forEach((pos, i) => {
      const tuft = createGrassTuft(this);
      tuft.setPosition(pos.x, pos.y);
      // 微風搖擺(skew rotation,各自相位)
      this.tweens.add({
        targets: tuft,
        rotation: 0.08,
        duration: 1200 + Math.random() * 600,
        delay: i * 150,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });
    });
  }

  /* ============================================================
     State sync
     ============================================================ */

  private syncToState() {
    if (!this.currentState) return;
    const { mascotAge, pikmin, hasHatched, hidePikminId } = this.currentState;

    this.ensureMascot(mascotAge);

    if (!hasHatched) {
      this.ensureEggPot();
    } else {
      this.removeEggPot();
    }

    const visible = pikmin.filter((p) => p.id !== hidePikminId);
    this.syncPikmin(visible);
  }

  private ensureMascot(age: number) {
    if (this.mascotRefs) {
      this.mascotRefs.ageText.setText(`${age} 歲`);
      return;
    }

    const refs = createMascotSprite(this, age);
    refs.container.setPosition(ISLAND_WIDTH / 2, ISLAND_HEIGHT / 2);

    // Tap mascot → audio unlock + sfx + squash-stretch + emit event
    refs.body.setInteractive();
    refs.body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      unlockAudio(); // iOS audio unlock(only first tap matters)
      sfxTap();
      this.tweens.add({
        targets: refs.container,
        scaleY: 0.9,
        scaleX: 1.1,
        duration: 110,
        yoyo: true,
        ease: Phaser.Math.Easing.Cubic.Out,
      });
      islandEventBus.emit('mascot:tap', {
        x: refs.container.x,
        y: refs.container.y,
      });
    });
    refs.head.setInteractive();
    refs.head.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      refs.body.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN);
    });

    // Idle bob
    this.tweens.add({
      targets: refs.container,
      y: ISLAND_HEIGHT / 2 - 4,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });

    this.mascotRefs = refs;
  }

  private ensureEggPot() {
    if (this.eggRefs) return;

    const refs = createEggPotSprite(this);
    refs.container.setPosition(250, 280);

    // 從上掉下進場
    refs.container.setY(280 - 40);
    refs.container.setAlpha(0);
    this.tweens.add({
      targets: refs.container,
      y: 280,
      alpha: 1,
      duration: 700,
      delay: 300,
      ease: Phaser.Math.Easing.Cubic.Out,
    });

    // 微微 idle 搖擺(嫩芽風中晃)
    this.tweens.add({
      targets: refs.container,
      rotation: 0.04,
      duration: 2200,
      delay: 1200,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });

    this.eggRefs = refs;
  }

  private removeEggPot() {
    if (!this.eggRefs) return;
    this.eggRefs.container.destroy();
    this.eggRefs = undefined;
  }

  private syncPikmin(list: PikminInput) {
    const incomingIds = new Set(list.map((p) => p.id));

    // 移除消失的
    for (const [id, refs] of this.pikminContainers) {
      if (!incomingIds.has(id)) {
        refs.container.destroy();
        this.pikminContainers.delete(id);
      }
    }

    // 新增 / 確保存在
    list.forEach((p, i) => {
      if (this.pikminContainers.has(p.id)) return;
      const pos = PIKMIN_POSITIONS[i] ?? PIKMIN_POSITIONS[0];

      const refs = createPikminSprite(this, p.color);
      refs.container.setPosition(pos.x, pos.y);

      // Tap → audio unlock + sfx + squash + emit
      refs.body.setInteractive();
      refs.body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        unlockAudio();
        sfxPikminTap();
        this.tweens.add({
          targets: refs.container,
          scaleY: 0.85,
          scaleX: 1.15,
          duration: 100,
          yoyo: true,
        });
        islandEventBus.emit('pikmin:tap', { id: p.id, color: p.color });
      });

      // Idle bob with random offset
      this.tweens.add({
        targets: refs.container,
        y: pos.y - 3,
        duration: 1500 + Math.random() * 600,
        delay: Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });

      this.pikminContainers.set(p.id, refs);
    });
  }
}
