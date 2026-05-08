/**
 * 遊戲層型別集中地。所有 game state 流經這裡。
 *
 * 設計原則(GDD §32.7 拍板):
 * - 1 個 mega-object key(island:${email})存所有 state
 * - 高頻成長(postcards、micro)分開另存
 * - 朋友看的縮減版用 VisitorView,server 端 sanitizeForVisitor() 強制 strip
 */

/* ============================================================
   Mascot — 玩家虛擬化身
   ============================================================ */
export type MascotGender = 'boy' | 'girl' | 'elder' | 'none';
export type MascotHairColor = 'black' | 'brown' | 'blonde' | 'white';
export type MascotSkinTone = 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4';
export type MascotLifestyle = 'beach' | 'urban' | 'mountain' | 'traveler' | 'custom';

export type Mascot = {
  gender: MascotGender;
  hairColor: MascotHairColor;
  skinTone: MascotSkinTone;
  age: number;            // 從 onboarding 起累計,跨年 +1
  lifestyle: MascotLifestyle;
  customLifestyle?: string;
};

/* ============================================================
   Pikmin — 五色小精靈,對應投資組合
   ============================================================ */
export type PikminColor = 'green' | 'violet' | 'orange' | 'cyan' | 'grey';
export type PikminStage = 'egg' | 'sprout' | 'small' | 'medium' | 'mature' | 'great' | 'elder' | 'eternal';

export type Pikmin = {
  id: string;
  color: PikminColor;
  stage: PikminStage;
  birthAt: string;         // ISO date
  variant?: string;        // 變異 / 季節限定 ID
  name?: string;           // 玩家命名(可選)
};

/* ============================================================
   Goals — 短中長期目標
   ============================================================ */
export type GoalTerm = 'short' | 'mid' | 'long';

export type Goal = {
  id: string;
  term: GoalTerm;
  label: string;           // 環島旅行 / 買房第一桶金 / FIRE
  targetTwd: number;
  weight?: number;         // 多目標時 0-1,加總 = 1
  achievedAt?: string;     // ISO date,達成時記錄
  buildingType?: string;   // 對應島上建築(房 / 車 / 學校 / 旅行紀念碑)
};

/* ============================================================
   四條進度軸(GDD §10)
   ============================================================ */
export type TimeTrack = {
  daysOpened: number;
  currentStreak: number;
  longestStreak: number;
  lastOpenedAt: string;    // ISO date(用於 streak 邊界判定)
  lastMonthYYYYMM: string; // 上次月扣月份(用於 monthly trigger 偵測)
};

export type MoneyTrack = {
  totalAccumulatedTwd: number;
  unlockedStoryChapters: string[];
};

export type MoodTrack = {
  currentMood: number;     // 0-100
  microDecisionFrequency: number; // 過去 30 天次數
  lastUpdatedAt: string;
};

export type ActionTrack = {
  totalActions: number;
  unlockedDecorations: string[];
};

export type Tracks = {
  time: TimeTrack;
  money: MoneyTrack;
  mood: MoodTrack;
  action: ActionTrack;
};

/* ============================================================
   Items — 戳章 / 解鎖物件
   ============================================================ */
export type UnlockedItem = {
  id: string;
  category: 'stamp' | 'building' | 'decoration' | 'path' | 'tree';
  unlockedAt: string;      // ISO date
};

/* ============================================================
   Profile — 玩家設定
   ============================================================ */
export type IslandProfile = {
  mascot: Mascot;
  pikminTribeName: string; // 小苗 / 青豆 / 葉子 / 糰子 / 小漁兒(預設)或自訂
  inflation: number;       // 預設 0.02
  privacySettings: {
    allowFriendVisit: boolean;
  };
  onboardedAt: string | null; // null = 還沒走完 onboarding
};

/* ============================================================
   Collections
   ============================================================ */
export type Collections = {
  pikmin: Pikmin[];
  items: UnlockedItem[];
};

/* ============================================================
   IslandState — 主 mega-object
   ============================================================ */
export type IslandState = {
  schemaVersion: 1;
  profile: IslandProfile;
  tracks: Tracks;
  goals: Goal[];
  collections: Collections;
};

/* ============================================================
   VisitorView — 朋友訪客可看的縮減版
   GDD §30 + §32.12 拍板:strip 金額 / 配置 / 心情 / 行動
   ============================================================ */
export type VisitorView = {
  schemaVersion: 1;
  profile: {
    mascot: Mascot;
    pikminTribeName: string;
  };
  tracks: {
    time: { currentStreak: number };  // 只給 streak,時間是 cheat-proof
  };
  collections: Collections;            // 視覺資產可看(小精靈、戳章、建築)
  // 不給 money / mood / action / goals / postcards / micro / friends
};

/* ============================================================
   Postcard — 月扣信(分開存,成長量大)
   ============================================================ */
export type Postcard = {
  id: string;
  monthYYYYMM: string;     // "2026-05"
  body: string;
  createdAt: string;       // ISO date
  source: 'claude' | 'template';  // 區分 API 生成 vs fallback 模板
  readAt: string | null;   // 玩家收下時記錄
};

/* ============================================================
   MicroDecision — 微決策(月分片儲存)
   ============================================================ */
export type MicroDecision = {
  id: string;
  ts: string;              // ISO datetime
  twd: number;             // 省下金額
  label: string;           // "沒喝咖啡"
};

/* ============================================================
   Friendship / Visit
   ============================================================ */
export type Friendship = {
  email: string;
  status: 'pending' | 'accepted' | 'blocked';
  addedAt: string;
};

export type WorldVisit = {
  friendEmail: string;
  visitedAt: string;
};

/* ============================================================
   Helper:預設 IslandState(新使用者第一次打開時 server 用)
   ============================================================ */
export function defaultIslandState(): IslandState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    profile: {
      mascot: {
        gender: 'none',
        hairColor: 'black',
        skinTone: 'tone-2',
        age: 25,
        lifestyle: 'beach',
      },
      pikminTribeName: '小苗',
      inflation: 0.02,
      privacySettings: {
        allowFriendVisit: false,
      },
      onboardedAt: null,
    },
    tracks: {
      time: {
        daysOpened: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastOpenedAt: now,
        lastMonthYYYYMM: '',
      },
      money: {
        totalAccumulatedTwd: 0,
        unlockedStoryChapters: [],
      },
      mood: {
        currentMood: 50,
        microDecisionFrequency: 0,
        lastUpdatedAt: now,
      },
      action: {
        totalActions: 0,
        unlockedDecorations: [],
      },
    },
    goals: [],
    collections: {
      pikmin: [],
      items: [],
    },
  };
}

/* ============================================================
   Sanitize for friend visit(GDD §32.12)
   server 端必經,不可直接回 IslandState 給朋友
   ============================================================ */
export function sanitizeForVisitor(s: IslandState): VisitorView {
  return {
    schemaVersion: 1,
    profile: {
      mascot: s.profile.mascot,
      pikminTribeName: s.profile.pikminTribeName,
    },
    tracks: {
      time: { currentStreak: s.tracks.time.currentStreak },
    },
    collections: s.collections,
  };
}

/* ============================================================
   Phase 2 — Monthly Trigger
   ============================================================ */

/** Server 偵測到月份切換時回給 client 的結果 */
export type MonthlyTriggerResult = {
  /** 觸發的月份(可能多個 — 玩家失聯 N 個月後回來補單) */
  monthsTriggered: string[];   // ["2026-04", "2026-05"]
  /** 新 streak 跟是否中斷 */
  streakResult: {
    streak: number;
    broke: boolean;            // true 觸發特別明信片(GDD §23.5 streak 中斷處理)
  };
  /** 是否孵化新小精靈(只在第一次月份切換 + 沒孵化過時 trigger) */
  newPikmin: Pikmin | null;
  /** Phase 3:本次 trigger 新增的 postcard ID list(client 用來顯示信箱紅點 + 自動跳 ritual) */
  newPostcardIds: string[];
};

/** Pikmin spawn 上下文 — 從 V1 holdings 推算出顏色 */
export type PikminSpawnContext = {
  /** 各資產類別 cost basis(TWD)*/
  byType: Partial<Record<
    'tw_stock' | 'us_stock' | 'crypto' | 'cash_twd' | 'cash_usd' | 'trust',
    number
  >>;
};

/* ============================================================
   Deep merge — 1 層 deep,Phase 1 夠用,Phase 2 視需要再深
   分開 export 以便單獨 test(route.ts 太多 mocking 不適合 unit test)
   ============================================================ */
export function mergeIslandState(
  current: IslandState,
  patch: Partial<IslandState>,
): IslandState {
  return {
    ...current,
    ...patch,
    profile: { ...current.profile, ...(patch.profile ?? {}) },
    tracks: {
      ...current.tracks,
      ...(patch.tracks ?? {}),
      time: { ...current.tracks.time, ...(patch.tracks?.time ?? {}) },
      money: { ...current.tracks.money, ...(patch.tracks?.money ?? {}) },
      mood: { ...current.tracks.mood, ...(patch.tracks?.mood ?? {}) },
      action: { ...current.tracks.action, ...(patch.tracks?.action ?? {}) },
    },
    collections: {
      ...current.collections,
      ...(patch.collections ?? {}),
    },
    schemaVersion: 1,
  };
}
