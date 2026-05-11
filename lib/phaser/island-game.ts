/**
 * Phaser game factory — 由 PhaserIslandHost 在 client 動態 import + 呼叫。
 *
 * 為什麼分檔:這個 module 直接 import phaser,bundle 很大,server 端不該載入。
 * PhaserIslandHost 用 dynamic import 避免 SSR(Phaser 依賴 window,SSR 會炸)。
 */

import Phaser from 'phaser';
import { IslandScene } from './island-scene';

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 480;

export function createIslandGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    transparent: true, // 讓 React 的島嶼漸層背景透過 canvas 看到
    scene: [IslandScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // iOS Safari 切 tab / backgrounded 自動 pause(省電 + 避免動畫累積)
    autoFocus: true,
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    // 關掉 Phaser banner(console 雜訊)
    banner: false,
    // 預設 transparent + DOM-friendly 設定
    backgroundColor: 'rgba(0,0,0,0)',
    input: {
      activePointers: 2, // 支援 multi-touch(Phase 5+ 可能用)
    },
  });

  return game;
}
