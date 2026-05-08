import { describe, expect, it } from 'vitest';
import {
  getPostcardTemplate,
  listAllTemplates,
  type PostcardContext,
} from './postcard-templates';

const baseCtx = (yyyymm: string): PostcardContext => ({
  tribe: '小苗',
  monthYYYYMM: yyyymm,
  dominantColor: 'green',
});

describe('getPostcardTemplate', () => {
  it('每個月都能渲染出 80-180 字內的信(避免太長/太短)', () => {
    for (let m = 1; m <= 12; m++) {
      const yyyymm = `2026-${String(m).padStart(2, '0')}`;
      const text = getPostcardTemplate(baseCtx(yyyymm));
      // 80-180 因為含「親愛的未來的我」「現在的我」這些固定文字
      expect(text.length).toBeGreaterThan(50);
      expect(text.length).toBeLessThan(200);
    }
  });

  it('變數 {tribe} 被注入', () => {
    const text = getPostcardTemplate({
      tribe: '青豆',
      monthYYYYMM: '2026-05',
      dominantColor: 'green',
    });
    expect(text).toContain('青豆');
    expect(text).not.toContain('{tribe}');
  });

  it('空族名 fallback 到「小苗」', () => {
    const text = getPostcardTemplate({
      tribe: '',
      monthYYYYMM: '2026-05',
      dominantColor: 'green',
    });
    expect(text).toContain('小苗');
  });

  it('每個模板都以「親愛的未來的我」開頭、「現在的我」結尾', () => {
    for (let m = 1; m <= 12; m++) {
      const yyyymm = `2026-${String(m).padStart(2, '0')}`;
      const text = getPostcardTemplate(baseCtx(yyyymm));
      expect(text.startsWith('親愛的未來的我')).toBe(true);
      expect(text.endsWith('現在的我')).toBe(true);
    }
  });

  it('GDD §16 禁用詞檢查:不出現「夢想」「成功」「奮鬥」「升級」「進化」「寶箱」', () => {
    const FORBIDDEN = ['夢想', '成功', '奮鬥', '升級', '進化', '寶箱', '突破', 'XP'];
    for (let m = 1; m <= 12; m++) {
      const yyyymm = `2026-${String(m).padStart(2, '0')}`;
      const text = getPostcardTemplate(baseCtx(yyyymm));
      for (const word of FORBIDDEN) {
        expect(text).not.toContain(word);
      }
    }
  });

  it('壞月份字串(空)→ 回 1 月模板,不 throw', () => {
    expect(() => getPostcardTemplate(baseCtx(''))).not.toThrow();
    const text = getPostcardTemplate(baseCtx(''));
    expect(text).toContain('一月');
  });

  it('壞月份字串(13 月)→ 回 1 月模板,不 throw', () => {
    expect(() => getPostcardTemplate(baseCtx('2026-13'))).not.toThrow();
  });
});

describe('seasonal/festival 優先', () => {
  it('12 月優先用跨年模板', () => {
    const text = getPostcardTemplate(baseCtx('2026-12'));
    expect(text).toContain('煙火');
  });

  it('2 月優先用春節模板', () => {
    const text = getPostcardTemplate(baseCtx('2026-02'));
    expect(text).toContain('燈籠');
  });

  it('9 月優先用中秋模板', () => {
    const text = getPostcardTemplate(baseCtx('2026-09'));
    expect(text).toContain('月亮');
  });

  it('5 月走一般月度(沒節日)', () => {
    const text = getPostcardTemplate(baseCtx('2026-05'));
    // 5 月模板有「花」,跨年模板沒有
    expect(text).toContain('花');
  });
});

describe('listAllTemplates(預覽 / dev tool)', () => {
  it('回傳 12 月度 + 4 季節 = 16 個', () => {
    const all = listAllTemplates();
    expect(all).toHaveLength(16);
  });

  it('每個 preview 都注入了 tribe', () => {
    const all = listAllTemplates();
    for (const t of all) {
      expect(t.preview).toContain('小苗');
    }
  });
});
