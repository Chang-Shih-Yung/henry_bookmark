/**
 * WelcomeCutscene — Phaser 歡迎儀式(Phase 3.6,純 Phaser cinematic)。
 *
 * 取代 React `<WelcomeCard>` overlay,完全在 canvas 內完成:
 * - 半透明 backdrop overlay 蓋過 island
 * - 紙質 card 從下方滑入(paper texture polygon + 邊框)
 * - 小 pikmin sprite 在 card 左上(對應顏色)
 * - 標題 "{tribe} 來了。" + body flavor 文字(打字機效果)
 * - 「好」按鈕,點擊 → sfxTap + card 滑出 + resolve promise
 * - reduced-motion fallback:跳過動畫直接顯示完整 card,點即離開
 *
 * 跟 EggHatchScene 一樣不是獨立 Scene class,是 IslandScene 內呼叫的函式。
 */

import Phaser from 'phaser';
import { sfxChime, sfxTap } from '../audio';
import { createPikminSprite, PALETTE } from '../sprites';

export type WelcomeCutsceneOptions = {
  /** 渲染中心 — 通常是 scene 中央 */
  centerX: number;
  centerY: number;
  /** 顯示寬度(card 寬,跟 island 寬度差不多) */
  width: number;
  tribeName: string;
  pikminColor: string;
  /** Card body flavor 句子(由 React 傳進來,基於 pikminColor) */
  flavor: string;
  reducedMotion?: boolean;
};

/**
 * 在 scene 內播 welcome cutscene。回 Promise resolve 時 user 已點「好」,
 * 呼叫端做 setConsumedHatchId
 */
export async function runWelcomeCutscene(
  scene: Phaser.Scene,
  options: WelcomeCutsceneOptions,
): Promise<void> {
  const {
    centerX,
    centerY,
    width,
    tribeName,
    pikminColor,
    flavor,
    reducedMotion = false,
  } = options;

  const cardHeight = 200;
  const cardWidth = Math.min(width - 32, 320);

  // ============================================================
  // Backdrop — 半透明 dim
  // ============================================================
  const backdrop = scene.add.rectangle(
    centerX,
    centerY,
    width,
    centerY * 2 + 200,
    0x000000,
    0.5,
  );
  backdrop.setInteractive(); // 吃掉 tap 不傳給下面 island

  // ============================================================
  // Card body — paper rectangle + 邊框
  // ============================================================
  const card = scene.add.container(centerX, centerY + 80);

  const cardBg = scene.add.rectangle(0, 0, cardWidth, cardHeight, PALETTE.paper);
  cardBg.setStrokeStyle(2, PALETTE.paperEdge);
  card.add(cardBg);

  // 左上 pikmin sprite
  const pikminRefs = createPikminSprite(scene, pikminColor);
  pikminRefs.container.setPosition(-cardWidth / 2 + 36, -cardHeight / 2 + 36);
  pikminRefs.container.setScale(0.8);
  card.add(pikminRefs.container);

  // 標題
  const title = scene.add
    .text(-cardWidth / 2 + 70, -cardHeight / 2 + 18, `${tribeName} 來了。`, {
      fontSize: '16px',
      color: '#3a2c1f',
      fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0);
  card.add(title);

  // Body text(打字機進度)— 用 typedLen 控制
  const bodyText = scene.add
    .text(-cardWidth / 2 + 70, -cardHeight / 2 + 50, '', {
      fontSize: '13px',
      color: '#3a2c1f',
      fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
      wordWrap: { width: cardWidth - 90 },
      lineSpacing: 4,
    })
    .setOrigin(0, 0);
  card.add(bodyText);

  // 「好」按鈕
  const buttonBg = scene.add.rectangle(0, cardHeight / 2 - 24, cardWidth - 32, 32, 0x222222);
  buttonBg.setStrokeStyle(1, PALETTE.paperEdge);
  buttonBg.setInteractive({ useHandCursor: true });
  card.add(buttonBg);

  const buttonText = scene.add
    .text(0, cardHeight / 2 - 24, '好', {
      fontSize: '14px',
      color: '#fbfbfb',
      fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
    })
    .setOrigin(0.5, 0.5);
  card.add(buttonText);

  return new Promise((resolve) => {
    // ============================================================
    // 進場:從下滑入 + backdrop fade in
    // ============================================================
    backdrop.setAlpha(0);
    card.setY(centerY + 200);
    card.setAlpha(0);

    if (!reducedMotion) {
      sfxChime();

      scene.tweens.add({
        targets: backdrop,
        alpha: 0.5,
        duration: 250,
        ease: 'Cubic.Out',
      });

      scene.tweens.add({
        targets: card,
        y: centerY + 60,
        alpha: 1,
        duration: 350,
        ease: 'Back.Out',
      });
    } else {
      backdrop.setAlpha(0.5);
      card.setY(centerY + 60);
      card.setAlpha(1);
    }

    // ============================================================
    // 打字機 body text(60ms/字),reduced motion 跳過
    // ============================================================
    if (reducedMotion) {
      bodyText.setText(flavor);
    } else {
      let typedLen = 0;
      const typer = scene.time.addEvent({
        delay: 60,
        repeat: flavor.length - 1,
        startAt: 400, // 等 card 入場後才開始打字
        callback: () => {
          typedLen++;
          bodyText.setText(flavor.slice(0, typedLen));
        },
      });
      void typer;
    }

    // ============================================================
    // Button tap → 退場 + resolve
    // ============================================================
    const onTap = () => {
      sfxTap();
      buttonBg.disableInteractive();

      if (!reducedMotion) {
        scene.tweens.add({
          targets: card,
          y: centerY + 240,
          alpha: 0,
          duration: 280,
          ease: 'Cubic.In',
        });
        scene.tweens.add({
          targets: backdrop,
          alpha: 0,
          duration: 280,
          delay: 80,
          onComplete: () => {
            card.destroy();
            backdrop.destroy();
            resolve();
          },
        });
      } else {
        card.destroy();
        backdrop.destroy();
        resolve();
      }
    };

    buttonBg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onTap);
    buttonText.setInteractive();
    buttonText.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onTap);
  });
}
