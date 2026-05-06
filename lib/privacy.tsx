'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/**
 * 隱私模式:遮蔽所有金額(總資產 / 市值 / 成本 / 月扣 / 損益 TWD)。
 * 預設開啟(避免登入秒洩漏);關閉狀態 persist 在 localStorage。
 */

const STORAGE_KEY = 'henryBookmark.privacy';

type Ctx = {
  privacy: boolean;
  toggle: () => void;
};

const PrivacyContext = createContext<Ctx>({
  privacy: true,
  toggle: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacy, setPrivacy] = useState(true);

  // hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === 'false') setPrivacy(false);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const toggle = () => {
    setPrivacy((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <PrivacyContext.Provider value={{ privacy, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}

/** 把已格式化的金額字串改成遮蔽形式;若不在隱私模式則原樣返回。 */
export function maskMoney(formatted: string, hidden: boolean): string {
  return hidden ? '••••' : formatted;
}
