/**
 * Procedural SFX with Web Audio API(Phase 3.6)。
 *
 * 為什麼 procedural 而非載 wav/ogg:
 * - 今晚沒外部音效素材
 * - Web Audio API 生成 sine / noise / 包絡 sub-100 行可寫 5 種 cozy SFX
 * - 0 KB bundle 增加,0 載入時間
 * - Phase 4+ 真音效素材替換時,只動 sfx.ts 內部 implementation,呼叫端不變
 *
 * iOS Safari 嚴格音訊 policy:
 * - AudioContext 必須在 user gesture(touch / click / keydown)後才 resume
 * - 否則所有 sound 靜默(沒 error,但聽不到)
 * - unlock() 把 AudioContext 從 suspended 切到 running,通常第一次點任何
 *   sprite 時呼叫
 */

/* ============================================================
   AudioContext 單例 + iOS unlock 狀態
   ============================================================ */

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;

  audioCtx = new Ctor();
  return audioCtx;
}

/**
 * iOS audio unlock — 第一次 user gesture 呼叫一次即可。
 * 之後所有 SFX 都能正常播。
 *
 * 用法:Phaser scene 第一次 pointerdown 時呼叫 audio.unlock()
 */
export function unlock(): void {
  if (unlocked) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // iOS Safari 在 user gesture handler 內 resume 才會成功 — 失敗就靜默
    });
  }
  unlocked = true;
}

/* ============================================================
   SFX 集 — 每個一個 function,內部組 oscillator + 包絡 + filter
   ============================================================ */

/** 短「boop」軟戳音(tap mascot)*/
export function sfxTap(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** 更高的「piaaa」短音(tap pikmin)*/
export function sfxPikminTap(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(550, now + 0.15);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

/** 蛋震動 — 短促 low rumble */
export function sfxEggShake(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(120, now + 0.08);
  osc.frequency.linearRampToValueAtTime(80, now + 0.16);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

/** 蛋裂 — 短促 noise burst + lowpass(類似「crack」)*/
export function sfxEggCrack(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;

  // White noise 短爆
  const bufferSize = ctx.sampleRate * 0.18;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3000, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.2);
}

/** Pikmin 孵化 spring「piaaa」上升音 */
export function sfxPikminBorn(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

/** 溫柔三音 chime(WelcomeCard 或儀式 climax)*/
export function sfxChime(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5 / E5 / G5 三度音
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.12);

    gain.gain.setValueAtTime(0, now + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.1, now + i * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.55);
  });
}

/** 戳章「thunk」— 低頻 + 短促 */
export function sfxStamp(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}
