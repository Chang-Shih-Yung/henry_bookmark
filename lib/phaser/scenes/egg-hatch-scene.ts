/**
 * EggHatchScene — Phaser 蛋孵化儀式(Phase 3.6,純 Phaser cinematic)。
 *
 * 取代 React `<EggHatchScene>` overlay,完全在 canvas 內完成:
 * - 蛋震動(rotation shake + sfxEggShake)
 * - 蛋裂(scale 0 + alpha 0 + sfxEggCrack)
 * - 碎蛋殼粒子 emitter(GameObjects.Particles,真粒子物理)
 * - Pikmin spring 跳出(scale 0→1 + y bounce + sfxPikminBorn)
 * - 完成後 emit 'eggHatch:done' 給 React,IslandScene 接手 idle bob
 *
 * 設計 — 不是獨立的 Phaser.Scene(那會 swap 整個 scene stack),而是 IslandScene
 * 內呼叫的 `runEggHatch(pikminColor): Promise<void>` 函式。Container 加在 island
 * scene 內,動畫 sequence 用 tween chain + setTimeout 串接。完成後 destroy。
 */

import Phaser from 'phaser';
import { sfxEggCrack, sfxEggShake, sfxPikminBorn } from '../audio';
import { createEggPotSprite, createPikminSprite, PALETTE } from '../sprites';

export type EggHatchOptions = {
  x: number;
  y: number;
  pikminColor: string;
  reducedMotion?: boolean;
};

/**
 * 在 scene 內播一次蛋孵化動畫。回 Promise resolved 時動畫完成,呼叫端可以
 * 接著 spawn 真的 idle pikmin。
 */
export async function runEggHatch(
  scene: Phaser.Scene,
  options: EggHatchOptions,
): Promise<void> {
  const { x, y, pikminColor, reducedMotion = false } = options;

  // ============================================================
  // Reduced motion → 跳過動畫,瞬間完成
  // ============================================================
  if (reducedMotion) {
    return Promise.resolve();
  }

  // ============================================================
  // 1. 建蛋盆 sprite
  // ============================================================
  const eggRefs = createEggPotSprite(scene);
  eggRefs.container.setPosition(x, y);

  return new Promise((resolve) => {
    // ============================================================
    // 2. 震動 phase(0-700ms)— 左右搖 + 漸強
    // ============================================================
    sfxEggShake();
    scene.tweens.add({
      targets: eggRefs.container,
      rotation: 0.12,
      duration: 80,
      yoyo: true,
      repeat: 5,
      ease: Phaser.Math.Easing.Sine.InOut,
    });

    // 半秒後再震一次 + 第二聲 shake
    scene.time.delayedCall(450, () => sfxEggShake());

    // ============================================================
    // 3. 裂開 phase(700-1100ms)— 蛋 scale 0 + crack sound + 粒子噴發
    // ============================================================
    scene.time.delayedCall(800, () => {
      sfxEggCrack();

      // 粒子 emitter — 碎蛋殼噴飛
      const particles = scene.add.particles(x, y - 4, 'shell', {
        // Phaser 4 沒有 default shell texture,用 quick texture 取代:
        // 拿動態建的 graphics texture 或用 emitterMode 'random' 不需 texture
      });
      // 因為我們沒預載 texture,改用 burst 一堆小 Graphics circle 飛出去
      void particles;
      particles.destroy(); // 不用 ParticleEmitter,改下面手動粒子

      emitShellShards(scene, x, y - 4);

      // 蛋本身縮小消失
      scene.tweens.add({
        targets: eggRefs.container,
        scale: 0,
        alpha: 0,
        rotation: 0.3,
        duration: 250,
        ease: Phaser.Math.Easing.Cubic.In,
        onComplete: () => {
          eggRefs.container.destroy();
        },
      });
    });

    // ============================================================
    // 4. Pikmin spring 跳出(1100-1700ms)
    // ============================================================
    scene.time.delayedCall(1150, () => {
      sfxPikminBorn();

      const pikminRefs = createPikminSprite(scene, pikminColor);
      pikminRefs.container.setPosition(x, y + 4);
      pikminRefs.container.setScale(0);

      // 從位置往上彈,然後落回正常 y
      scene.tweens.add({
        targets: pikminRefs.container,
        scale: 1,
        duration: 380,
        ease: Phaser.Math.Easing.Back.Out,
      });

      scene.tweens.add({
        targets: pikminRefs.container,
        y: y - 12,
        duration: 220,
        ease: Phaser.Math.Easing.Cubic.Out,
        yoyo: true,
      });

      // 動畫結束後 destroy 這個臨時 pikmin(IslandScene 會生真的 idle pikmin)
      scene.time.delayedCall(900, () => {
        scene.tweens.add({
          targets: pikminRefs.container,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            pikminRefs.container.destroy();
            resolve();
          },
        });
      });
    });
  });
}

/* ============================================================
   碎蛋殼粒子 — 用 Graphics 物件手動粒子(Phaser 4 ParticleEmitter API
   需 texture,我們沒預載 texture 圖檔,改用 12 個 small circle 手動 emit)
   ============================================================ */
function emitShellShards(scene: Phaser.Scene, x: number, y: number): void {
  const COUNT = 14;
  for (let i = 0; i < COUNT; i++) {
    const shard = scene.add.ellipse(
      x,
      y,
      4 + Math.random() * 3,
      2.5 + Math.random() * 1.5,
      PALETTE.paper,
    );
    shard.setStrokeStyle(1, PALETTE.paperEdge);

    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 60 + Math.random() * 50;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 30; // 偏上一點,模擬重力前的初速

    scene.tweens.add({
      targets: shard,
      x: x + dx,
      y: y + dy + 80, // +80 模擬重力落地
      rotation: (Math.random() - 0.5) * Math.PI * 3,
      alpha: 0,
      duration: 700 + Math.random() * 200,
      ease: 'Cubic.Out',
      onComplete: () => shard.destroy(),
    });
  }
}
