'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchReminderConfig,
  getCurrentSubscription,
  isPushSupported,
  patchReminderConfig,
  subscribePush,
  unsubscribePush,
} from '@/lib/notifications';
import { toast } from 'sonner';

export function PushReminderSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
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
      const ok = isPushSupported();
      setSupported(ok);
      if (!ok) {
        setLoading(false);
        return;
      }
      const sub = await getCurrentSubscription();
      setEnabled(!!sub);
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

  const onToggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
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
            description: `每月 ${day} 號 ${String(hour).padStart(2, '0')}:00 會跳通知`,
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
            iPhone 必須先把網站「加入主畫面」才會收到。
          </p>
        </div>
        <Button
          type="button"
          variant={enabled ? 'outline' : 'default'}
          size="sm"
          onClick={onToggle}
          disabled={busy}
          className="shrink-0"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : enabled ? (
            '停用'
          ) : (
            '啟用'
          )}
        </Button>
      </div>

      <div className="space-y-3 pt-2 border-t border-white/8">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label
              htmlFor="reminder-day"
              className="text-[11px] text-muted-foreground"
            >
              每月幾號
            </Label>
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
              className="h-9 mt-1 text-base"
            />
          </div>
          <div>
            <Label
              htmlFor="reminder-hour"
              className="text-[11px] text-muted-foreground"
            >
              幾點(台灣時間)
            </Label>
            <Input
              id="reminder-hour"
              type="number"
              inputMode="numeric"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => {
                setHour(Number(e.target.value));
                setDirty(true);
              }}
              className="h-9 mt-1 text-base"
            />
          </div>
        </div>

        <div>
          <Label
            htmlFor="reminder-title"
            className="text-[11px] text-muted-foreground"
          >
            通知標題
          </Label>
          <Input
            id="reminder-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            className="h-9 mt-1 text-base"
            maxLength={60}
          />
        </div>

        <div>
          <Label
            htmlFor="reminder-body"
            className="text-[11px] text-muted-foreground"
          >
            通知內容
          </Label>
          <textarea
            id="reminder-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDirty(true);
            }}
            maxLength={200}
            rows={3}
            className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {body.length} / 200 字
          </p>
        </div>

        {dirty && (
          <Button
            type="button"
            size="sm"
            onClick={onSaveConfig}
            disabled={busy}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              '儲存設定'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
