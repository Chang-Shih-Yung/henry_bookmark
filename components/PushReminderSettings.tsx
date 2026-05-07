'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field-label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  fetchReminderConfig,
  forceResubscribe,
  getCurrentSubscription,
  isPushSupported,
  patchReminderConfig,
  sendTestPush,
  subscribePush,
  syncSubscriptionToServer,
  unsubscribePush,
} from '@/lib/notifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function hourToHour12(h: number): number {
  if (h === 0) return 12;
  if (h <= 12) return h;
  return h - 12;
}

function hour12ToHour(h12: number, isPM: boolean): number {
  if (h12 === 12) return isPM ? 12 : 0;
  return isPM ? h12 + 12 : h12;
}

function formatHour(h: number): string {
  const isPM = h >= 12;
  const h12 = hourToHour12(h);
  return `${isPM ? '下午' : '上午'} ${h12}:00`;
}

/** iOS PWA / Android TWA 都會有 standalone display-mode;桌面瀏覽器沒有。 */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari 專用:加入主畫面後 navigator.standalone === true
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/** 偵測 iOS(iPhone / iPad / iPod)— 用來判斷是否需要強制 standalone PWA */
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  // iPad on iOS 13+ 會冒充 macOS,但 maxTouchPoints > 1
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  );
}

export function PushReminderSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [iosNotPwa, setIosNotPwa] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(6);
  const [hour, setHour] = useState(12);
  const [title, setTitle] = useState('月扣記錄日');
  const [body, setBody] = useState(
    '台股(0050+台積電)、美股(VTI+GOOGL)的定期定額扣完了,打開 app 抄累計總額。',
  );
  const [dirty, setDirty] = useState(false);

  // 初始化:檢查是否已訂閱 + 載入 config
  useEffect(() => {
    (async () => {
      const inStandalone = isStandalone();
      setStandalone(inStandalone);
      // iOS 必須是 standalone PWA 才能 push;Safari 書籤不行
      setIosNotPwa(isIOS() && !inStandalone);

      const ok = isPushSupported();
      setSupported(ok);
      if (!ok) {
        setLoading(false);
        return;
      }
      const sub = await getCurrentSubscription();
      setEnabled(!!sub);
      // 同步:browser 認得這個 sub,server 不一定有 — 強制 re-POST 一次確保 redis 收到
      // (常見:舊 build 曾訂閱但 POST 失敗、Redis 被清、Vercel 環境換,結果 test 永遠 sentCount=0)
      if (sub) {
        const sync = await syncSubscriptionToServer();
        if (!sync.ok) {
          console.warn('[push] sync failed', sync.reason);
        }
      }
      const cfg = await fetchReminderConfig();
      if (cfg) {
        setDay(cfg.day);
        setHour(cfg.hour);
        setTitle(cfg.title);
        setBody(cfg.body);
      }
      setLoading(false);
    })();
  }, []);

  const onToggle = async (checked: boolean) => {
    setBusy(true);
    try {
      if (!checked) {
        const res = await unsubscribePush();
        if (res.ok) {
          setEnabled(false);
          toast.success('已停用月扣提醒');
        } else {
          toast.error('停用失敗');
        }
      } else {
        const res = await subscribePush({ day, hour, title, body });
        if (res.ok) {
          setEnabled(true);
          toast.success('已啟用月扣提醒', {
            description: `每月 ${day} 號 ${formatHour(hour)} 會跳通知`,
          });
        } else {
          toast.error('啟用失敗', { description: res.reason });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const onSaveConfig = async () => {
    setBusy(true);
    try {
      const res = await patchReminderConfig({ day, hour, title, body });
      if (res.ok) {
        toast.success('提醒設定已儲存');
        setDirty(false);
      } else {
        toast.error('儲存失敗');
      }
    } finally {
      setBusy(false);
    }
  };

  const onResubscribe = async () => {
    setBusy(true);
    try {
      const res = await forceResubscribe({ day, hour, title, body });
      if (res.ok) {
        setEnabled(true);
        toast.success('重新訂閱成功', {
          description: '舊訂閱已清掉,server 收到新 subscription',
        });
      } else {
        toast.error('重新訂閱失敗', { description: res.reason });
      }
    } finally {
      setBusy(false);
    }
  };

  const onTestPush = async () => {
    setBusy(true);
    try {
      const res = await sendTestPush();
      if (res.ok) {
        toast.success('測試通知已發送', {
          description: `已推送到 ${res.sentCount} 台裝置,看看你 iPhone 鎖定畫面有沒有跳通知`,
        });
      } else {
        toast.error('測試發送失敗', {
          description: res.reason,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (supported === false) {
    return (
      <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm p-4 text-xs text-muted-foreground">
        此裝置 / 瀏覽器不支援推送通知。
        iPhone 用戶:把網站「加入主畫面」(Safari → 分享 → 加入主畫面),從主畫面打開後重試。
        macOS Safari 16.4+ / Chrome / Firefox 桌面瀏覽器都支援。
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm p-4 text-xs text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        載入提醒設定中…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            {enabled ? (
              <Bell className="h-4 w-4 text-accent-brand" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            月扣提醒
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            每月固定日期、台灣時間,自動推送通知到這台裝置。
          </p>
        </div>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={iosNotPwa}
            aria-label={enabled ? '停用提醒' : '啟用提醒'}
            className="shrink-0"
          />
        )}
      </div>

      {/* iOS 必須 standalone PWA — 用書籤打開不行,強制提示 */}
      {iosNotPwa && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-[11px] text-warning leading-relaxed">
          <div className="font-medium mb-1">⚠ iOS 必須加入主畫面才能收通知</div>
          <div className="text-muted-foreground">
            你目前是用 Safari 開的(或書籤捷徑直接開到 Safari)。iOS 17.4+ 規定 Web Push 只能透過「加入主畫面」的 PWA 收。
            <br />
            <strong className="text-foreground">操作:</strong>
            Safari 底部分享 ⬆ → <strong>加入主畫面</strong>(不是「加入書籤」)→
            從主畫面那個 icon 開啟(不會有上下 Safari bar) → 回來這頁打開開關。
          </div>
        </div>
      )}

      {/* 已是 PWA — 顯示診斷資訊讓 user 看得見當前狀態 */}
      {standalone && (
        <div className="rounded-md border border-white/10 bg-background/30 p-3 text-[10px] font-mono text-muted-foreground leading-relaxed">
          <div>● PWA 模式: <span className="text-up">是</span></div>
          <div>
            ● 通知權限:{' '}
            <span
              className={
                typeof Notification !== 'undefined' &&
                Notification.permission === 'granted'
                  ? 'text-up'
                  : 'text-warning'
              }
            >
              {typeof Notification !== 'undefined'
                ? Notification.permission
                : '不支援'}
            </span>
          </div>
          <div>
            ● 訂閱狀態:{' '}
            <span className={enabled ? 'text-up' : 'text-muted-foreground'}>
              {enabled ? '已訂閱' : '未訂閱'}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-white/8">
        {/* 「每月幾號」欄位窄(1fr),「幾點」欄位寬(2fr)— hint「台灣時間」放下方避免擠在 label */}
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <div>
            <FieldLabel htmlFor="reminder-day">每月幾號</FieldLabel>
            <Input
              id="reminder-day"
              type="number"
              inputMode="numeric"
              min={1}
              max={28}
              value={day}
              onChange={(e) => {
                setDay(Number(e.target.value));
                setDirty(true);
              }}
            />
          </div>
          <div>
            <FieldLabel>幾點</FieldLabel>
            <div className="flex gap-1.5">
              <ToggleGroup
                value={[hour < 12 ? 'am' : 'pm']}
                onValueChange={(v) => {
                  if (v.length === 0) return;
                  const isPM = v[0] === 'pm';
                  const h12 = hourToHour12(hour);
                  setHour(hour12ToHour(h12, isPM));
                  setDirty(true);
                }}
                className="shrink-0"
              >
                <ToggleGroupItem value="am">上午</ToggleGroupItem>
                <ToggleGroupItem value="pm">下午</ToggleGroupItem>
              </ToggleGroup>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                value={hourToHour12(hour)}
                onChange={(e) => {
                  const h12 = Math.min(12, Math.max(1, Number(e.target.value) || 1));
                  setHour(hour12ToHour(h12, hour >= 12));
                  setDirty(true);
                }}
                className="w-16 shrink-0"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatHour(hour)} · 台灣時間
            </p>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="reminder-title">通知標題</FieldLabel>
          <Input
            id="reminder-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            maxLength={60}
          />
        </div>

        <div>
          <FieldLabel htmlFor="reminder-body" hint={`${body.length} / 200`}>
            通知內容
          </FieldLabel>
          <textarea
            id="reminder-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDirty(true);
            }}
            maxLength={200}
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base resize-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none transition-colors md:text-sm"
          />
        </div>

        {dirty && (
          <Button
            type="button"
            size="default"
            onClick={onSaveConfig}
            disabled={busy}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              '儲存設定'
            )}
          </Button>
        )}

        {enabled && !dirty && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onTestPush}
              disabled={busy}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '發送測試通知'
              )}
            </Button>
            {standalone && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onResubscribe}
                disabled={busy}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  '測試失敗?點這裡重新訂閱(清掉舊 cache)'
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
