/**
 * PostcardCutscene — Phaser 月扣明信片儀式(Phase 3.7,純 Phaser cinematic)。
 *
 * 取代 React `<PostcardRitual>` vaul drawer 的「monthly trigger 自動推進」流程。
 * (PostcardsInbox 點歷史信件 reopen 仍走 React vaul drawer — 那是 archive
 * browse 不是 first-time ritual,差異化 UX 是對的。)
 *
 * 動畫節拍:
 *   T0       backdrop 暗下(0→0.6 alpha, 250ms)
 *   T1       paper card 從上飄下(top → center, 600ms, Cubic.Out)
 *            + sfxChime(三音 C5/E5/G5)
 *   T2       月份 label 淡入
 *   T3       body 打字機(60ms/字,Chinese-safe word wrap)
 *   T4       打字完成 → 戳章 fade-in + sfxStamp + 「收下」按鈕亮
 *   T5       user 按「收下」 → sfxTap
 *            + 戳章 spring 飛向螢幕右下角(fly off canvas + rotation)
 *            + 同時 paper card 滑上消失
 *            + backdrop 淡出
 *   T6       resolve promise
 *
 * Reduced motion fallback:
 *   - backdrop 直接 0.6 alpha
 *   - card 直接定位
 *   - body 立刻完整顯示
 *   - 戳章直接 visible
 *   - user 點「收下」 → 直接 resolve(沒 fly)
 */

import Phaser from 'phaser';
import { sfxChime, sfxStamp, sfxTap } from '../audio';
import { PALETTE } from '../sprites';

export type PostcardCutsceneOptions = {
  centerX: number;
  centerY: number;
  width: number;   // canvas 寬,用來決定 card 寬度上限 + 戳章飛出方向
  height: number;  // canvas 高
  monthYYYYMM: string;
  body: string;
  reducedMotion?: boolean;
};

const TYPEWRITER_MS_PER_CHAR = 60;

/**
 * 在 scene 內播 postcard cutscene。回 Promise resolve 時 user 已按「收下」。
 */
export async function runPostcardCutscene(
  scene: Phaser.Scene,
  options: PostcardCutsceneOptions,
): Promise<void> {
  const {
    centerX,
    centerY,
    width,
    height,
    monthYYYYMM,
    body,
    reducedMotion = false,
  } = options;

  const cardWidth = Math.min(width - 32, 320);
  const cardHeight = 280;

  /* ============================================================
     Backdrop — 半透明 dim
     ============================================================ */
  const backdrop = scene.add.rectangle(
    centerX,
    centerY,
    width + 100,
    height + 200,
    0x000000,
    0,
  );
  backdrop.setInteractive(); // 吃 tap

  /* ============================================================
     Paper card container
     ============================================================ */
  const card = scene.add.container(centerX, centerY);

  // 紙質背景(米色)
  const paperBg = scene.add.rectangle(0, 0, cardWidth, cardHeight, PALETTE.paper);
  paperBg.setStrokeStyle(2, PALETTE.paperEdge);
  card.add(paperBg);

  // 紙邊微 deckle(用 4 條短線模擬手撕邊)
  for (let i = 0; i < 4; i++) {
    const side = scene.add.line(0, 0, 0, 0, 0, 0, PALETTE.paperEdge, 0.4);
    void side; // Phase 3.8 才做 deckle 邊,Phase 3.7 minimal
  }

  // 月份 label(top-left)
  const monthLabel = scene.add
    .text(-cardWidth / 2 + 16, -cardHeight / 2 + 12, formatMonth(monthYYYYMM), {
      fontSize: '11px',
      color: '#7a6a4f',
      fontFamily: 'ui-monospace, SF Mono, monospace',
    })
    .setOrigin(0, 0);
  card.add(monthLabel);

  // Body text(typewriter,空字開始)
  const bodyText = scene.add
    .text(-cardWidth / 2 + 16, -cardHeight / 2 + 40, '', {
      fontSize: '14px',
      color: '#3a2c1f',
      fontFamily: '"Noto Serif TC", "PingFang TC", "Songti TC", serif',
      wordWrap: {
        width: cardWidth - 32,
        useAdvancedWrap: true, // Chinese char-by-char wrap
      },
      lineSpacing: 6,
    })
    .setOrigin(0, 0);
  card.add(bodyText);

  // 打字機游標(閃爍)
  const cursor = scene.add.rectangle(0, 0, 1.5, 16, 0x3a2c1f, 0.7);
  cursor.setVisible(false);
  card.add(cursor);

  // 戳章 — 預設不可見,打字完才 fade-in
  const stampContainer = scene.add.container(cardWidth / 2 - 36, cardHeight / 2 - 36);
  stampContainer.setRotation(-0.2);
  stampContainer.setScale(0);
  card.add(stampContainer);

  const stampCircle = scene.add.circle(0, 0, 28, PALETTE.paper);
  stampCircle.setStrokeStyle(2, 0xa86b3c); // 戳章紅褐邊
  stampContainer.add(stampCircle);

  const stampText1 = scene.add
    .text(0, -6, '月扣', {
      fontSize: '10px',
      color: '#a86b3c',
      fontFamily: 'ui-monospace, SF Mono, monospace',
    })
    .setOrigin(0.5, 0.5);
  const stampText2 = scene.add
    .text(0, 6, formatStampMonth(monthYYYYMM), {
      fontSize: '9px',
      color: '#a86b3c',
      fontFamily: 'ui-monospace, SF Mono, monospace',
    })
    .setOrigin(0.5, 0.5);
  stampContainer.add([stampText1, stampText2]);

  /* ============================================================
     「收下」按鈕(在 card 底部,初期 disabled)
     ============================================================ */
  const buttonContainer = scene.add.container(0, cardHeight / 2 + 28);
  card.add(buttonContainer);

  const buttonBg = scene.add.rectangle(0, 0, cardWidth - 60, 36, 0x444444);
  buttonBg.setStrokeStyle(1, PALETTE.paperEdge);
  buttonBg.setAlpha(0.5); // disabled look
  buttonContainer.add(buttonBg);

  const buttonText = scene.add
    .text(0, 0, '看完了…', {
      fontSize: '13px',
      color: '#888',
      fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
    })
    .setOrigin(0.5, 0.5);
  buttonContainer.add(buttonText);

  return new Promise((resolve) => {
    /* ============================================================
       進場 — backdrop fade + card 從上飄下
       ============================================================ */
    if (reducedMotion) {
      backdrop.setAlpha(0.6);
      card.setY(centerY);
      // 立即顯示全部 body
      bodyText.setText(body);
      stampContainer.setScale(1);
      enableButton();
    } else {
      card.setY(-cardHeight / 2 - 40);

      scene.tweens.add({
        targets: backdrop,
        alpha: 0.6,
        duration: 250,
        ease: 'Cubic.Out',
      });

      scene.tweens.add({
        targets: card,
        y: centerY,
        duration: 700,
        delay: 100,
        ease: 'Cubic.Out',
        onComplete: () => {
          sfxChime();
          startTypewriter();
        },
      });
    }

    /* ============================================================
       Typewriter
       ============================================================ */
    function startTypewriter() {
      cursor.setVisible(true);

      let typedLen = 0;

      // 游標位置 update
      const updateCursor = () => {
        // Phaser text 的 width / height 是渲染後的 size,從中算 cursor 位置
        const lines = bodyText.text.split('\n');
        const lastLine = lines[lines.length - 1];
        const lineHeight = 14 + 6; // fontSize + lineSpacing
        const cursorY =
          bodyText.y - cardHeight / 2 + 40 + (lines.length - 1) * lineHeight + 8;
        // 用 Phaser text measure 算最後行寬(粗略,因為中文等寬假設)
        const measureText = scene.add.text(0, 0, lastLine, {
          fontSize: '14px',
          fontFamily: '"Noto Serif TC", "PingFang TC", serif',
        });
        const w = measureText.width;
        measureText.destroy();
        cursor.setPosition(bodyText.x - cardHeight / 2 + 16 + w - cardWidth / 2 + 24, cursorY);
      };

      // 簡化版:游標跟在 body 末尾(不精準算位置,只在 body 結束處放)
      // 因為 Phaser Text 動態 wordwrap 算游標位置太複雜,暫時把游標放右下固定
      cursor.setPosition(0, cardHeight / 2 - 70);

      const typer = scene.time.addEvent({
        delay: TYPEWRITER_MS_PER_CHAR,
        repeat: body.length - 1,
        callback: () => {
          typedLen++;
          bodyText.setText(body.slice(0, typedLen));

          // 完成
          if (typedLen >= body.length) {
            cursor.setVisible(false);
            scene.time.delayedCall(300, () => {
              showStamp();
            });
          }
        },
      });
      void typer;
      void updateCursor; // 暫時不用,Phase 3.8 再做精準游標
    }

    /* ============================================================
       Stamp 出現 — fade in + spring scale
       ============================================================ */
    function showStamp() {
      sfxStamp();
      scene.tweens.add({
        targets: stampContainer,
        scale: 1,
        duration: 400,
        ease: 'Back.Out',
      });
      scene.time.delayedCall(200, enableButton);
    }

    /* ============================================================
       Button enable
       ============================================================ */
    function enableButton() {
      buttonBg.setAlpha(1);
      buttonBg.setFillStyle(0x222222);
      buttonText.setText('收下');
      buttonText.setColor('#fbfbfb');

      buttonBg.setInteractive({ useHandCursor: true });
      buttonBg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onCollect);
      buttonText.setInteractive();
      buttonText.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onCollect);
    }

    /* ============================================================
       Collect — 戳章飛出 + card 退場 + resolve
       ============================================================ */
    function onCollect() {
      sfxTap();
      buttonBg.disableInteractive();
      buttonText.disableInteractive();

      if (reducedMotion) {
        cleanup();
        return;
      }

      // 戳章從 card 飛出到螢幕右下角,加 rotation + scale up + fade
      const targetX = width / 2 - 20;
      const targetY = height / 2 + 80;

      scene.tweens.add({
        targets: stampContainer,
        x: targetX,
        y: targetY,
        scale: 1.4,
        rotation: -1.5,
        alpha: 0,
        duration: 600,
        ease: 'Cubic.Out',
      });

      // Card 滑上消失
      scene.tweens.add({
        targets: card,
        y: -cardHeight / 2 - 60,
        alpha: 0,
        duration: 450,
        delay: 200,
        ease: 'Cubic.In',
      });

      // Backdrop 淡出
      scene.tweens.add({
        targets: backdrop,
        alpha: 0,
        duration: 450,
        delay: 250,
        onComplete: cleanup,
      });
    }

    function cleanup() {
      card.destroy();
      backdrop.destroy();
      resolve();
    }
  });
}

/* ============================================================
   Helpers
   ============================================================ */
function formatMonth(yyyymm: string): string {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyymm;
  return `${m[1]} 年 ${parseInt(m[2], 10)} 月`;
}

function formatStampMonth(yyyymm: string): string {
  const m = yyyymm.match(/^\d{4}-(\d{2})$/);
  if (!m) return yyyymm;
  return `${parseInt(m[1], 10)} 月`;
}
