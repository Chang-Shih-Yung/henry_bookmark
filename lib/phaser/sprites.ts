/**
 * Procedural sprite builders(Phase 3.5.1)。
 *
 * 不用外部 PNG / SVG asset,用 Phaser Graphics API 純 code 畫出 mascot、
 * pikmin、egg-pot、雲、樹 — 比圓圈好太多,但離真 Pikmin Bloom 還有距離。
 *
 * 等 Phase 4 美術 sprite sheet 到位後,這些 function 整支被 sprite atlas 替換,
 * 但 Container 結構保持(Phaser Sprite 跟 Container 都是 GameObject)。
 *
 * 設計準則:
 * - 每個 sprite 是 Container,讓 idle bob / squash-stretch / scale 統一操作
 * - 描邊用 PALETTE.foreground(白),統一輪廓
 * - 顏色從 COLOR_TO_HEX / PALETTE 拿,不寫死(方便 Phase 4 主題切換)
 */

import Phaser from 'phaser';

/* ============================================================
   色票 — 對應 globals.css 的 oklch CSS variable(取 hex 近似)
   ============================================================ */
export const COLOR_TO_HEX: Record<string, number> = {
  green: 0x9bd66d,
  violet: 0xa56df0,
  orange: 0xf2a766,
  cyan: 0x66c2d6,
  grey: 0xc4c0bc,
};

export const PALETTE = {
  skyDay: 0xc8e0ec,
  grass: 0xa3d99b,
  grassDark: 0x4f8c5a,
  water: 0x88c2d6,
  sand: 0xe8d8a3,
  soil: 0x9c7a4f,
  soilDark: 0x6b4f2f,
  paper: 0xf2e6c8,
  paperEdge: 0xc9b889,
  foreground: 0xfbfbfb,
  shadow: 0x000000,
  black: 0x222222,
  skin: 0xfbe3c8,
  hair: 0x3a2c1f,
  shirt: 0x6090c0,
  cloud: 0xffffff,
  flowerPink: 0xf2a3c4,
  flowerYellow: 0xf2d864,
} as const;

/* ============================================================
   Mascot — 圓頭、簡單五官、襯衫式身體、手腳線條
   age text 是分開的 child container,scene 用 setText 更新
   ============================================================ */

export function createMascotSprite(scene: Phaser.Scene, age: number) {
  const container = scene.add.container(0, 0);

  // 陰影 ground
  const shadow = scene.add.ellipse(0, 30, 28, 6, PALETTE.shadow, 0.25);
  container.add(shadow);

  // 腳(兩條)
  const legL = scene.add.rectangle(-5, 22, 5, 10, PALETTE.skin);
  legL.setStrokeStyle(1.5, PALETTE.black);
  const legR = scene.add.rectangle(5, 22, 5, 10, PALETTE.skin);
  legR.setStrokeStyle(1.5, PALETTE.black);
  container.add([legL, legR]);

  // 身體(襯衫 — 圓角矩形 via rectangle + cap)
  const body = scene.add.rectangle(0, 8, 22, 18, PALETTE.shirt);
  body.setStrokeStyle(1.5, PALETTE.black);
  container.add(body);

  // 手(兩條)
  const armL = scene.add.rectangle(-13, 6, 4, 14, PALETTE.skin);
  armL.setStrokeStyle(1.5, PALETTE.black);
  const armR = scene.add.rectangle(13, 6, 4, 14, PALETTE.skin);
  armR.setStrokeStyle(1.5, PALETTE.black);
  container.add([armL, armR]);

  // 頭(圓 + 邊)
  const head = scene.add.circle(0, -8, 12, PALETTE.skin);
  head.setStrokeStyle(2, PALETTE.black);
  container.add(head);

  // 頭髮(頭頂半圓)
  const hair = scene.add.arc(0, -12, 12, 180, 360, false, PALETTE.hair);
  container.add(hair);

  // 眼睛(兩個小白圓 + 黑點)
  const eyeL = scene.add.circle(-4, -8, 1.8, PALETTE.black);
  const eyeR = scene.add.circle(4, -8, 1.8, PALETTE.black);
  container.add([eyeL, eyeR]);

  // 嘴(小弧 — 用 arc 模擬 smile)
  const mouth = scene.add.arc(0, -4, 3, 0, 180, false);
  mouth.setStrokeStyle(1, PALETTE.black);
  mouth.isFilled = false;
  container.add(mouth);

  // 年齡 text(浮在腳下方)
  const ageText = scene.add
    .text(0, 38, `${age} 歲`, {
      fontSize: '10px',
      color: '#fbfbfbcc',
      fontFamily: 'ui-monospace, SF Mono, monospace',
    })
    .setOrigin(0.5, 0);
  container.add(ageText);

  return { container, ageText, body, head };
}

/* ============================================================
   Pikmin — Pikmin Bloom 風,oval 身體 + 大眼 + mouth + 葉子 stem
   ============================================================ */

export type PikminColorKey = keyof typeof COLOR_TO_HEX;

export function createPikminSprite(
  scene: Phaser.Scene,
  color: string,
) {
  const container = scene.add.container(0, 0);
  const tint = COLOR_TO_HEX[color] ?? COLOR_TO_HEX.green;

  // 陰影
  const shadow = scene.add.ellipse(0, 22, 22, 5, PALETTE.shadow, 0.25);
  container.add(shadow);

  // 腳(兩個小橢圓)
  const footL = scene.add.ellipse(-5, 18, 5, 3, tint);
  footL.setStrokeStyle(1.2, PALETTE.black);
  const footR = scene.add.ellipse(5, 18, 5, 3, tint);
  footR.setStrokeStyle(1.2, PALETTE.black);
  container.add([footL, footR]);

  // 身體(oval taller than wide,Pikmin 比例)
  const body = scene.add.ellipse(0, 4, 22, 28, tint);
  body.setStrokeStyle(1.8, PALETTE.black);
  container.add(body);

  // 手(兩條短線)
  const armL = scene.add.line(0, 0, -11, 6, -14, 10, PALETTE.black);
  armL.setLineWidth(1.5);
  const armR = scene.add.line(0, 0, 11, 6, 14, 10, PALETTE.black);
  armR.setLineWidth(1.5);
  container.add([armL, armR]);

  // 眼睛(大白圓 + 黑點 — Pikmin 典型瞳孔)
  const eyeL = scene.add.circle(-4, 2, 3, PALETTE.foreground);
  eyeL.setStrokeStyle(1, PALETTE.black);
  const eyeR = scene.add.circle(4, 2, 3, PALETTE.foreground);
  eyeR.setStrokeStyle(1, PALETTE.black);
  const pupilL = scene.add.circle(-4, 2.5, 1.5, PALETTE.black);
  const pupilR = scene.add.circle(4, 2.5, 1.5, PALETTE.black);
  container.add([eyeL, eyeR, pupilL, pupilR]);

  // Stem(從頭頂長出 — 細線)
  const stem = scene.add.line(0, 0, 0, -11, 0, -19, PALETTE.grassDark, 1);
  stem.setLineWidth(2);
  container.add(stem);

  // 葉子(綠色橢圓,微傾)
  const leaf = scene.add.ellipse(0, -22, 12, 8, PALETTE.grass);
  leaf.setStrokeStyle(1.2, PALETTE.grassDark);
  leaf.setRotation(Math.PI / 8);
  container.add(leaf);

  // 葉子上一條 vein(小細節)
  const vein = scene.add.line(0, 0, 0, -22, 4, -20, PALETTE.grassDark, 0.6);
  vein.setLineWidth(0.8);
  container.add(vein);

  return { container, body };
}

/* ============================================================
   Egg-pot — 茶杯狀盆 + 嫩芽,取代純圓蛋(Pikmin Bloom 的 Big Flower Seedlings 風)
   ============================================================ */

export function createEggPotSprite(scene: Phaser.Scene) {
  const container = scene.add.container(0, 0);

  // 陰影 ground
  const shadow = scene.add.ellipse(0, 24, 32, 6, PALETTE.shadow, 0.3);
  container.add(shadow);

  // 盆主體(梯形 via polygon)
  const potShape = new Phaser.Geom.Polygon([
    -14, 22,  // bottom-left
    14, 22,   // bottom-right
    16, 8,    // right shoulder
    14, 0,    // rim-right
    -14, 0,   // rim-left
    -16, 8,   // left shoulder
  ]);
  const pot = scene.add.polygon(0, 0, potShape.points, PALETTE.paper);
  pot.setStrokeStyle(1.5, PALETTE.paperEdge);
  container.add(pot);

  // 盆把手(右側小弧)
  const handle = scene.add.arc(15, 10, 5, 270, 90, false);
  handle.setStrokeStyle(1.5, PALETTE.paperEdge);
  handle.isFilled = false;
  container.add(handle);

  // 盆裝飾紋(小十字 / 點點)
  const decoL = scene.add.text(-7, 8, '✻', {
    fontSize: '8px',
    color: '#9c7a4f',
  }).setOrigin(0.5);
  const decoR = scene.add.text(7, 8, '✻', {
    fontSize: '8px',
    color: '#9c7a4f',
  }).setOrigin(0.5);
  container.add([decoL, decoR]);

  // 土層(深褐橢圓蓋盆口)
  const soil = scene.add.ellipse(0, 0, 28, 6, PALETTE.soilDark);
  soil.setStrokeStyle(0.8, PALETTE.soil);
  container.add(soil);

  // 嫩芽 stem
  const sproutStem = scene.add.line(0, 0, 0, -2, 0, -16, PALETTE.grassDark, 1);
  sproutStem.setLineWidth(2);
  container.add(sproutStem);

  // 嫩芽葉(兩片小葉子對開)
  const leafL = scene.add.ellipse(-4, -14, 8, 5, PALETTE.grass);
  leafL.setStrokeStyle(1, PALETTE.grassDark);
  leafL.setRotation(-Math.PI / 4);
  const leafR = scene.add.ellipse(4, -14, 8, 5, PALETTE.grass);
  leafR.setStrokeStyle(1, PALETTE.grassDark);
  leafR.setRotation(Math.PI / 4);
  container.add([leafL, leafR]);

  // 嫩芽頂部小芽(圓形 dot)
  const sproutTop = scene.add.circle(0, -18, 2, PALETTE.grass);
  sproutTop.setStrokeStyle(0.5, PALETTE.grassDark);
  container.add(sproutTop);

  return { container, pot };
}

/* ============================================================
   雲(背景持續飄)
   ============================================================ */

export function createCloudSprite(scene: Phaser.Scene, size: 'small' | 'medium' = 'medium') {
  const container = scene.add.container(0, 0);
  const scale = size === 'small' ? 0.6 : 1;

  // 用 3 個重疊橢圓組合 fluffy cloud
  const c1 = scene.add.ellipse(-10 * scale, 0, 18 * scale, 10 * scale, PALETTE.cloud, 0.85);
  const c2 = scene.add.ellipse(0, -3 * scale, 22 * scale, 14 * scale, PALETTE.cloud, 0.85);
  const c3 = scene.add.ellipse(10 * scale, 0, 16 * scale, 10 * scale, PALETTE.cloud, 0.85);
  container.add([c1, c2, c3]);

  return container;
}

/* ============================================================
   草叢(地面上幾撮小草點綴)
   ============================================================ */

export function createGrassTuft(scene: Phaser.Scene) {
  const container = scene.add.container(0, 0);

  // 3 條短線
  const blade1 = scene.add.line(0, 0, 0, 0, -2, -5, PALETTE.grassDark, 1);
  blade1.setLineWidth(1.2);
  const blade2 = scene.add.line(0, 0, 0, 0, 0, -7, PALETTE.grassDark, 1);
  blade2.setLineWidth(1.2);
  const blade3 = scene.add.line(0, 0, 0, 0, 2, -5, PALETTE.grassDark, 1);
  blade3.setLineWidth(1.2);
  container.add([blade1, blade2, blade3]);

  return container;
}
