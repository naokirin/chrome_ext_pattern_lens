import { describe, expect, it } from 'vitest';
import { convertNormalizedMatchToOriginal, normalizeText } from '~/lib/search/normalization';

describe('normalization', () => {
  describe('normalizeText', () => {
    it('空文字列を正規化する', () => {
      const result = normalizeText('');
      expect(result.normalizedText).toBe('');
      expect(result.mapping.ranges).toEqual([]);
    });

    it('基本的な全角→半角変換（アルファベット）', () => {
      const result = normalizeText('ＡＢＣ');
      expect(result.normalizedText).toBe('abc');
      expect(result.mapping.ranges.length).toBe(3);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 });
      expect(result.mapping.ranges[1]).toEqual({ start: 1, end: 2 });
      expect(result.mapping.ranges[2]).toEqual({ start: 2, end: 3 });
    });

    it('全角小文字アルファベットの正規化（ａ-ｚ → a-z）', () => {
      const result = normalizeText('ａｂｃ');
      expect(result.normalizedText).toBe('abc');
      expect(result.mapping.ranges.length).toBe(3);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 });
      expect(result.mapping.ranges[1]).toEqual({ start: 1, end: 2 });
      expect(result.mapping.ranges[2]).toEqual({ start: 2, end: 3 });
    });

    it('全角小文字アルファベットの全範囲テスト', () => {
      const result = normalizeText('ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ');
      expect(result.normalizedText).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(result.mapping.ranges.length).toBe(26);
    });

    it('全角アルファベットの混在（大文字・小文字）', () => {
      const result = normalizeText('ＡｂＣ');
      expect(result.normalizedText).toBe('abc');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('基本的な全角→半角変換（数字）', () => {
      const result = normalizeText('１２３');
      expect(result.normalizedText).toBe('123');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('大文字小文字の正規化', () => {
      const result = normalizeText('ABC');
      expect(result.normalizedText).toBe('abc');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('濁点結合（か゛ → が）', () => {
      const result = normalizeText('か゛');
      expect(result.normalizedText).toBe('が');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('濁点結合（カ゛ → ガ）', () => {
      const result = normalizeText('カ゛');
      expect(result.normalizedText).toBe('ガ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('濁点結合（ｶﾞ → ガ）', () => {
      const result = normalizeText('ｶﾞ');
      expect(result.normalizedText).toBe('ガ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('半濁点結合（は゜ → ぱ）', () => {
      const result = normalizeText('は゜');
      expect(result.normalizedText).toBe('ぱ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('半濁点がマッピングに存在しない文字の後に来る場合（結合されない）', () => {
      // 半濁点がマッピングに存在しない文字（例: か）の後に来る場合
      const result = normalizeText('か゜');
      // かは半濁点のマッピングに存在しないため、結合されずに別々に処理される
      expect(result.normalizedText).toBe('か゜');
      expect(result.mapping.ranges.length).toBe(2);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 }); // か
      expect(result.mapping.ranges[1]).toEqual({ start: 1, end: 2 }); // ゜
    });

    it('濁点がマッピングに存在しない文字の後に来る場合（結合されない）', () => {
      // 濁点がマッピングに存在しない文字（例: あ）の後に来る場合
      const result = normalizeText('あ゛');
      // あは濁点のマッピングに存在しないため、結合されずに別々に処理される
      expect(result.normalizedText).toBe('あ゛');
      expect(result.mapping.ranges.length).toBe(2);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 }); // あ
      expect(result.mapping.ranges[1]).toEqual({ start: 1, end: 2 }); // ゛
    });

    it('単独の濁点（結合できない場合）', () => {
      const result = normalizeText('゛');
      expect(result.normalizedText).toBe('゛');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 });
    });

    it('単独の半濁点（結合できない場合）', () => {
      const result = normalizeText('゜');
      expect(result.normalizedText).toBe('゜');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 });
    });

    it('古い仮名の濁点結合（う゛ → ゔ）', () => {
      const result = normalizeText('う゛');
      expect(result.normalizedText).toBe('ゔ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('古いカタカナの濁点結合（ウ゛ → ヴ）', () => {
      const result = normalizeText('ウ゛');
      expect(result.normalizedText).toBe('ヴ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('古いカタカナの濁点結合（ヰ゛ → ヸ）', () => {
      const result = normalizeText('ヰ゛');
      expect(result.normalizedText).toBe('ヸ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('小書き文字の濁点結合（ぅ゛ → ぅ゙）', () => {
      const result = normalizeText('ぅ゛');
      expect(result.normalizedText).toBe('ぅ゙');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    describe('全角カタカナの濁点結合', () => {
      it('キ゛ → ギ', () => {
        const result = normalizeText('キ゛');
        expect(result.normalizedText).toBe('ギ');
        expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
      });

      it('ク゛ → グ', () => {
        const result = normalizeText('ク゛');
        expect(result.normalizedText).toBe('グ');
      });

      it('ケ゛ → ゲ', () => {
        const result = normalizeText('ケ゛');
        expect(result.normalizedText).toBe('ゲ');
      });

      it('コ゛ → ゴ', () => {
        const result = normalizeText('コ゛');
        expect(result.normalizedText).toBe('ゴ');
      });

      it('サ゛ → ザ', () => {
        const result = normalizeText('サ゛');
        expect(result.normalizedText).toBe('ザ');
      });

      it('シ゛ → ジ', () => {
        const result = normalizeText('シ゛');
        expect(result.normalizedText).toBe('ジ');
      });

      it('ス゛ → ズ', () => {
        const result = normalizeText('ス゛');
        expect(result.normalizedText).toBe('ズ');
      });

      it('セ゛ → ゼ', () => {
        const result = normalizeText('セ゛');
        expect(result.normalizedText).toBe('ゼ');
      });

      it('ソ゛ → ゾ', () => {
        const result = normalizeText('ソ゛');
        expect(result.normalizedText).toBe('ゾ');
      });

      it('タ゛ → ダ', () => {
        const result = normalizeText('タ゛');
        expect(result.normalizedText).toBe('ダ');
      });

      it('チ゛ → ヂ', () => {
        const result = normalizeText('チ゛');
        expect(result.normalizedText).toBe('ヂ');
      });

      it('ツ゛ → ヅ', () => {
        const result = normalizeText('ツ゛');
        expect(result.normalizedText).toBe('ヅ');
      });

      it('テ゛ → デ', () => {
        const result = normalizeText('テ゛');
        expect(result.normalizedText).toBe('デ');
      });

      it('ト゛ → ド', () => {
        const result = normalizeText('ト゛');
        expect(result.normalizedText).toBe('ド');
      });

      it('ハ゛ → バ', () => {
        const result = normalizeText('ハ゛');
        expect(result.normalizedText).toBe('バ');
      });

      it('ヒ゛ → ビ', () => {
        const result = normalizeText('ヒ゛');
        expect(result.normalizedText).toBe('ビ');
      });

      it('フ゛ → ブ', () => {
        const result = normalizeText('フ゛');
        expect(result.normalizedText).toBe('ブ');
      });

      it('ヘ゛ → ベ', () => {
        const result = normalizeText('ヘ゛');
        expect(result.normalizedText).toBe('ベ');
      });

      it('ホ゛ → ボ', () => {
        const result = normalizeText('ホ゛');
        expect(result.normalizedText).toBe('ボ');
      });

      it('ヱ゛ → ヹ', () => {
        const result = normalizeText('ヱ゛');
        expect(result.normalizedText).toBe('ヹ');
      });
    });

    describe('半角カタカナの濁点結合', () => {
      it('ｷﾞ → ギ', () => {
        const result = normalizeText('ｷﾞ');
        expect(result.normalizedText).toBe('ギ');
        expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
      });

      it('ｸﾞ → グ', () => {
        const result = normalizeText('ｸﾞ');
        expect(result.normalizedText).toBe('グ');
      });

      it('ｹﾞ → ゲ', () => {
        const result = normalizeText('ｹﾞ');
        expect(result.normalizedText).toBe('ゲ');
      });

      it('ｺﾞ → ゴ', () => {
        const result = normalizeText('ｺﾞ');
        expect(result.normalizedText).toBe('ゴ');
      });

      it('ｻﾞ → ザ', () => {
        const result = normalizeText('ｻﾞ');
        expect(result.normalizedText).toBe('ザ');
      });

      it('ｼﾞ → ジ', () => {
        const result = normalizeText('ｼﾞ');
        expect(result.normalizedText).toBe('ジ');
      });

      it('ｽﾞ → ズ', () => {
        const result = normalizeText('ｽﾞ');
        expect(result.normalizedText).toBe('ズ');
      });

      it('ｾﾞ → ゼ', () => {
        const result = normalizeText('ｾﾞ');
        expect(result.normalizedText).toBe('ゼ');
      });

      it('ｿﾞ → ゾ', () => {
        const result = normalizeText('ｿﾞ');
        expect(result.normalizedText).toBe('ゾ');
      });

      it('ﾀﾞ → ダ', () => {
        const result = normalizeText('ﾀﾞ');
        expect(result.normalizedText).toBe('ダ');
      });

      it('ﾁﾞ → ヂ', () => {
        const result = normalizeText('ﾁﾞ');
        expect(result.normalizedText).toBe('ヂ');
      });

      it('ﾂﾞ → ヅ', () => {
        const result = normalizeText('ﾂﾞ');
        expect(result.normalizedText).toBe('ヅ');
      });

      it('ﾃﾞ → デ', () => {
        const result = normalizeText('ﾃﾞ');
        expect(result.normalizedText).toBe('デ');
      });

      it('ﾄﾞ → ド', () => {
        const result = normalizeText('ﾄﾞ');
        expect(result.normalizedText).toBe('ド');
      });

      it('ﾊﾞ → バ', () => {
        const result = normalizeText('ﾊﾞ');
        expect(result.normalizedText).toBe('バ');
      });

      it('ﾋﾞ → ビ', () => {
        const result = normalizeText('ﾋﾞ');
        expect(result.normalizedText).toBe('ビ');
      });

      it('ﾌﾞ → ブ', () => {
        const result = normalizeText('ﾌﾞ');
        expect(result.normalizedText).toBe('ブ');
      });

      it('ﾍﾞ → ベ', () => {
        const result = normalizeText('ﾍﾞ');
        expect(result.normalizedText).toBe('ベ');
      });

      it('ﾎﾞ → ボ', () => {
        const result = normalizeText('ﾎﾞ');
        expect(result.normalizedText).toBe('ボ');
      });

      it('ｳﾞ → ヴ', () => {
        const result = normalizeText('ｳﾞ');
        expect(result.normalizedText).toBe('ヴ');
      });
    });

    describe('半濁点結合', () => {
      it('ハ゜ → パ', () => {
        const result = normalizeText('ハ゜');
        expect(result.normalizedText).toBe('パ');
        expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
      });

      it('ヒ゜ → ピ', () => {
        const result = normalizeText('ヒ゜');
        expect(result.normalizedText).toBe('ピ');
      });

      it('フ゜ → プ', () => {
        const result = normalizeText('フ゜');
        expect(result.normalizedText).toBe('プ');
      });

      it('ヘ゜ → ペ', () => {
        const result = normalizeText('ヘ゜');
        expect(result.normalizedText).toBe('ペ');
      });

      it('ホ゜ → ポ', () => {
        const result = normalizeText('ホ゜');
        expect(result.normalizedText).toBe('ポ');
      });

      it('ﾊﾟ → パ', () => {
        const result = normalizeText('ﾊﾟ');
        expect(result.normalizedText).toBe('パ');
      });

      it('ﾋﾟ → ピ', () => {
        const result = normalizeText('ﾋﾟ');
        expect(result.normalizedText).toBe('ピ');
      });

      it('ﾌﾟ → プ', () => {
        const result = normalizeText('ﾌﾟ');
        expect(result.normalizedText).toBe('プ');
      });

      it('ﾍﾟ → ペ', () => {
        const result = normalizeText('ﾍﾟ');
        expect(result.normalizedText).toBe('ペ');
      });

      it('ﾎﾟ → ポ', () => {
        const result = normalizeText('ﾎﾟ');
        expect(result.normalizedText).toBe('ポ');
      });
    });

    describe('小書き文字の濁点結合', () => {
      it('ぁ゛ → ぁ゙', () => {
        const result = normalizeText('ぁ゛');
        expect(result.normalizedText).toBe('ぁ゙');
        expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
      });

      it('ぃ゛ → ぃ゙', () => {
        const result = normalizeText('ぃ゛');
        expect(result.normalizedText).toBe('ぃ゙');
      });

      it('ぇ゛ → ぇ゙', () => {
        const result = normalizeText('ぇ゛');
        expect(result.normalizedText).toBe('ぇ゙');
      });

      it('ぉ゛ → ぉ゙', () => {
        const result = normalizeText('ぉ゛');
        expect(result.normalizedText).toBe('ぉ゙');
      });

      it('ゃ゛ → ゃ゙', () => {
        const result = normalizeText('ゃ゛');
        expect(result.normalizedText).toBe('ゃ゙');
      });

      it('ゅ゛ → ゅ゙', () => {
        const result = normalizeText('ゅ゛');
        expect(result.normalizedText).toBe('ゅ゙');
      });

      it('ょ゛ → ょ゙', () => {
        const result = normalizeText('ょ゛');
        expect(result.normalizedText).toBe('ょ゙');
      });

      it('ゎ゛ → ゎ゙', () => {
        const result = normalizeText('ゎ゛');
        expect(result.normalizedText).toBe('ゎ゙');
      });

      it('ァ゛ → ァ゙', () => {
        const result = normalizeText('ァ゛');
        expect(result.normalizedText).toBe('ァ゙');
      });

      it('ィ゛ → ィ゙', () => {
        const result = normalizeText('ィ゛');
        expect(result.normalizedText).toBe('ィ゙');
      });

      it('ゥ゛ → ゥ゙', () => {
        const result = normalizeText('ゥ゛');
        expect(result.normalizedText).toBe('ゥ゙');
      });

      it('ェ゛ → ェ゙', () => {
        const result = normalizeText('ェ゛');
        expect(result.normalizedText).toBe('ェ゙');
      });

      it('ォ゛ → ォ゙', () => {
        const result = normalizeText('ォ゛');
        expect(result.normalizedText).toBe('ォ゙');
      });

      it('ャ゛ → ャ゙', () => {
        const result = normalizeText('ャ゛');
        expect(result.normalizedText).toBe('ャ゙');
      });

      it('ュ゛ → ュ゙', () => {
        const result = normalizeText('ュ゛');
        expect(result.normalizedText).toBe('ュ゙');
      });

      it('ョ゛ → ョ゙', () => {
        const result = normalizeText('ョ゛');
        expect(result.normalizedText).toBe('ョ゙');
      });

      it('ヮ゛ → ヮ゙', () => {
        const result = normalizeText('ヮ゛');
        expect(result.normalizedText).toBe('ヮ゙');
      });
    });

    describe('古い仮名の濁点結合', () => {
      it('ゐ゛ → ゐ゙', () => {
        const result = normalizeText('ゐ゛');
        expect(result.normalizedText).toBe('ゐ゙');
        expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
      });

      it('ゑ゛ → ゑ゙', () => {
        const result = normalizeText('ゑ゛');
        expect(result.normalizedText).toBe('ゑ゙');
      });
    });

    it('複数文字の正規化（か゛は → がは）', () => {
      const result = normalizeText('か゛は');
      expect(result.normalizedText).toBe('がは');
      expect(result.mapping.ranges.length).toBe(2);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 }); // が
      expect(result.mapping.ranges[1]).toEqual({ start: 2, end: 3 }); // は
    });

    it('記号の正規化（ー → -）', () => {
      const result = normalizeText('ー');
      expect(result.normalizedText).toBe('-');
      expect(result.mapping.ranges.length).toBe(1);
    });

    it('記号の正規化（／ → /）', () => {
      const result = normalizeText('／');
      expect(result.normalizedText).toBe('/');
      expect(result.mapping.ranges.length).toBe(1);
    });

    describe('記号の正規化（ハイフン・ダッシュ系）', () => {
      it('全角ハイフン（－ → -）', () => {
        const result = normalizeText('－');
        expect(result.normalizedText).toBe('-');
      });

      it('Em dash（— → -）', () => {
        const result = normalizeText('—');
        expect(result.normalizedText).toBe('-');
      });

      it('En dash（– → -）', () => {
        const result = normalizeText('–');
        expect(result.normalizedText).toBe('-');
      });

      it('Horizontal bar（― → -）', () => {
        const result = normalizeText('―');
        expect(result.normalizedText).toBe('-');
      });
    });

    describe('記号の正規化（句読点）', () => {
      it('全角コロン（： → :）', () => {
        const result = normalizeText('：');
        expect(result.normalizedText).toBe(':');
      });

      it('全角セミコロン（； → ;）', () => {
        const result = normalizeText('；');
        expect(result.normalizedText).toBe(';');
      });

      it('全角カンマ（， → ,）', () => {
        const result = normalizeText('，');
        expect(result.normalizedText).toBe(',');
      });

      it('全角句点（。 → .）', () => {
        const result = normalizeText('。');
        expect(result.normalizedText).toBe('.');
      });

      it('全角ピリオド（． → .）', () => {
        const result = normalizeText('．');
        expect(result.normalizedText).toBe('.');
      });

      it('読点（、 → ,）', () => {
        const result = normalizeText('、');
        expect(result.normalizedText).toBe(',');
      });

      it('全角スペース（　 →  ）', () => {
        const result = normalizeText('　');
        expect(result.normalizedText).toBe(' ');
      });
    });

    describe('記号の正規化（括弧）', () => {
      it('全角左括弧（（ → (）', () => {
        const result = normalizeText('（');
        expect(result.normalizedText).toBe('(');
      });

      it('全角右括弧（） → )）', () => {
        const result = normalizeText('）');
        expect(result.normalizedText).toBe(')');
      });

      it('全角左角括弧（［ → [）', () => {
        const result = normalizeText('［');
        expect(result.normalizedText).toBe('[');
      });

      it('全角右角括弧（］ → ]）', () => {
        const result = normalizeText('］');
        expect(result.normalizedText).toBe(']');
      });

      it('全角左波括弧（｛ → {）', () => {
        const result = normalizeText('｛');
        expect(result.normalizedText).toBe('{');
      });

      it('全角右波括弧（｝ → }）', () => {
        const result = normalizeText('｝');
        expect(result.normalizedText).toBe('}');
      });

      it('全角小なり（＜ → <）', () => {
        const result = normalizeText('＜');
        expect(result.normalizedText).toBe('<');
      });

      it('全角大なり（＞ → >）', () => {
        const result = normalizeText('＞');
        expect(result.normalizedText).toBe('>');
      });
    });

    describe('記号の正規化（引用符）', () => {
      it('左鍵括弧（「 → "）', () => {
        const result = normalizeText('「');
        expect(result.normalizedText).toBe('"');
      });

      it('右鍵括弧（」 → "）', () => {
        const result = normalizeText('」');
        expect(result.normalizedText).toBe('"');
      });

      it('左二重鍵括弧（『 → "）', () => {
        const result = normalizeText('『');
        expect(result.normalizedText).toBe('"');
      });

      it('右二重鍵括弧（』 → "）', () => {
        const result = normalizeText('』');
        expect(result.normalizedText).toBe('"');
      });

      it('全角引用符（\uFF02 → "）', () => {
        const result = normalizeText('\uFF02');
        expect(result.normalizedText).toBe('"');
      });

      it("全角アポストロフィ（\uFF07 → '）", () => {
        const result = normalizeText('\uFF07');
        expect(result.normalizedText).toBe("'");
      });

      it("左シングル引用符（\u2018 → '）", () => {
        const result = normalizeText('\u2018');
        expect(result.normalizedText).toBe("'");
      });

      it("右シングル引用符（\u2019 → '）", () => {
        const result = normalizeText('\u2019');
        expect(result.normalizedText).toBe("'");
      });

      it('左ダブル引用符（\u201C → "）', () => {
        const result = normalizeText('\u201C');
        expect(result.normalizedText).toBe('"');
      });

      it('右ダブル引用符（\u201D → "）', () => {
        const result = normalizeText('\u201D');
        expect(result.normalizedText).toBe('"');
      });
    });

    describe('記号の正規化（数学記号・その他）', () => {
      it('全角プラス（＋ → +）', () => {
        const result = normalizeText('＋');
        expect(result.normalizedText).toBe('+');
      });

      it('全角等号（＝ → =）', () => {
        const result = normalizeText('＝');
        expect(result.normalizedText).toBe('=');
      });

      it('全角アスタリスク（＊ → *）', () => {
        const result = normalizeText('＊');
        expect(result.normalizedText).toBe('*');
      });

      it('全角シャープ（＃ → #）', () => {
        const result = normalizeText('＃');
        expect(result.normalizedText).toBe('#');
      });

      it('全角ドル（＄ → $）', () => {
        const result = normalizeText('＄');
        expect(result.normalizedText).toBe('$');
      });

      it('全角パーセント（％ → %）', () => {
        const result = normalizeText('％');
        expect(result.normalizedText).toBe('%');
      });

      it('全角アンパサンド（＆ → &）', () => {
        const result = normalizeText('＆');
        expect(result.normalizedText).toBe('&');
      });

      it('全角アットマーク（＠ → @）', () => {
        const result = normalizeText('＠');
        expect(result.normalizedText).toBe('@');
      });

      it('全角サーカムフレックス（＾ → ^）', () => {
        const result = normalizeText('＾');
        expect(result.normalizedText).toBe('^');
      });

      it('全角縦線（｜ → |）', () => {
        const result = normalizeText('｜');
        expect(result.normalizedText).toBe('|');
      });

      it('全角チルダ（～ → ~）', () => {
        const result = normalizeText('～');
        expect(result.normalizedText).toBe('~');
      });

      it('全角アンダースコア（＿ → _）', () => {
        const result = normalizeText('＿');
        expect(result.normalizedText).toBe('_');
      });

      it('全角感嘆符（！ → !）', () => {
        const result = normalizeText('！');
        expect(result.normalizedText).toBe('!');
      });

      it('全角疑問符（？ → ?）', () => {
        const result = normalizeText('？');
        expect(result.normalizedText).toBe('?');
      });

      it('全角バッククォート（｀ → `）', () => {
        const result = normalizeText('｀');
        expect(result.normalizedText).toBe('`');
      });

      it('全角バックスラッシュ（＼ → \\）', () => {
        const result = normalizeText('＼');
        expect(result.normalizedText).toBe('\\');
      });
    });

    it('ブロック境界マーカーはそのまま保持', () => {
      const marker = '\uE000';
      const result = normalizeText(`か${marker}は`);
      expect(result.normalizedText).toBe(`か${marker}は`);
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('複数のブロック境界マーカーが連続する場合', () => {
      const marker = '\uE000';
      const result = normalizeText(`${marker}${marker}${marker}`);
      expect(result.normalizedText).toBe(`${marker}${marker}${marker}`);
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('ブロック境界マーカーと通常文字の混在', () => {
      const marker = '\uE000';
      const result = normalizeText(`か${marker}は${marker}テスト`);
      expect(result.normalizedText).toBe(`か${marker}は${marker}てすと`);
      // か(1) + marker(1) + は(1) + marker(1) + テ(1) + ス(1) + ト(1) = 7文字
      expect(result.mapping.ranges.length).toBe(7);
    });

    it('ブロック境界マーカーを含む文字列のマッピング範囲', () => {
      const marker = '\uE000';
      const result = normalizeText(`か${marker}は`);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 }); // か
      expect(result.mapping.ranges[1]).toEqual({ start: 1, end: 2 }); // marker
      expect(result.mapping.ranges[2]).toEqual({ start: 2, end: 3 }); // は
    });

    it('複雑な正規化（全角・半角・濁点混在）', () => {
      const result = normalizeText('ＡＢＣか゛１２３');
      expect(result.normalizedText).toBe('abcが123');
      expect(result.mapping.ranges.length).toBe(7);
    });

    it('複雑な混在パターン（全角・半角・濁点・記号）', () => {
      const result = normalizeText('ＡＢＣか゛１２３－テスト／');
      expect(result.normalizedText).toBe('abcが123-てすと/');
      // Ａ(1) + Ｂ(1) + Ｃ(1) + か゛(2→1) + １(1) + ２(1) + ３(1) + －(1) + テ(1) + ス(1) + ト(1) + ／(1) = 12文字
      expect(result.mapping.ranges.length).toBe(12);
    });

    it('日付フォーマットの正規化（全角記号）', () => {
      const result = normalizeText('2024／01／01');
      expect(result.normalizedText).toBe('2024/01/01');
    });

    it('日付フォーマットの正規化（全角ハイフン）', () => {
      const result = normalizeText('2024－01－01');
      expect(result.normalizedText).toBe('2024-01-01');
    });

    it('日付フォーマットの正規化（混在）', () => {
      const result = normalizeText('2024年1月1日');
      expect(result.normalizedText).toBe('2024年1月1日'); // 記号のみ正規化
    });

    it('複数の濁点結合を含むマッピング', () => {
      const result = normalizeText('か゛は゛');
      expect(result.normalizedText).toBe('がば');
      expect(result.mapping.ranges.length).toBe(2);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 }); // が
      expect(result.mapping.ranges[1]).toEqual({ start: 2, end: 4 }); // ば
    });

    it('全角→半角変換と濁点結合が混在するマッピング', () => {
      const result = normalizeText('Ａか゛Ｂ');
      expect(result.normalizedText).toBe('aがb');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('ブロック境界マーカーを含むマッピング', () => {
      const marker = '\uE000';
      const result = normalizeText(`か゛${marker}は゛`);
      expect(result.normalizedText).toBe(`が${marker}ば`);
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('カタカナをひらがなに変換（全角カタカナ）', () => {
      const result = normalizeText('テスト');
      expect(result.normalizedText).toBe('てすと');
      expect(result.mapping.ranges.length).toBe(3);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 });
      expect(result.mapping.ranges[1]).toEqual({ start: 1, end: 2 });
      expect(result.mapping.ranges[2]).toEqual({ start: 2, end: 3 });
    });

    it('カタカナをひらがなに変換（半角カタカナ）', () => {
      const result = normalizeText('ﾃｽﾄ');
      expect(result.normalizedText).toBe('てすと');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('ひらがなはそのまま保持', () => {
      const result = normalizeText('てすと');
      expect(result.normalizedText).toBe('てすと');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('カタカナとひらがなの混在を正規化', () => {
      const result = normalizeText('テストとテスト');
      expect(result.normalizedText).toBe('てすととてすと');
      expect(result.mapping.ranges.length).toBe(7);
    });
  });

  describe('convertNormalizedMatchToOriginal', () => {
    it('正規化後の位置を元の位置に変換', () => {
      // "か゛" → "が" (2文字 → 1文字)
      const mapping = {
        ranges: [{ start: 0, end: 2 }], // が
      };
      const normalizedMatch = { start: 0, end: 1 };
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 0, end: 2 });
    });

    it('複数文字の正規化後の位置を元の位置に変換', () => {
      // "か゛は" → "がは" (3文字 → 2文字)
      const mapping = {
        ranges: [
          { start: 0, end: 2 }, // が
          { start: 2, end: 3 }, // は
        ],
      };
      const normalizedMatch = { start: 0, end: 2 }; // "がは"
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 0, end: 3 });
    });

    it('範囲外の位置の場合はnullを返す', () => {
      const mapping = {
        ranges: [{ start: 0, end: 1 }],
      };
      const normalizedMatch = { start: 10, end: 11 };
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });

    it('空のマッピングの場合はnullを返す', () => {
      const mapping = {
        ranges: [],
      };
      const normalizedMatch = { start: 0, end: 1 };
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });

    it('startRangeがundefinedの場合はnullを返す', () => {
      const mapping = {
        ranges: [{ start: 0, end: 1 }],
      };
      const normalizedMatch = { start: 10, end: 11 }; // 範囲外
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });

    it('endRangeがundefinedの場合はnullを返す', () => {
      const mapping = {
        ranges: [{ start: 0, end: 1 }],
      };
      const normalizedMatch = { start: 0, end: 10 }; // endが範囲外
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });

    it('start < 0の場合はnullを返す', () => {
      const mapping = {
        ranges: [{ start: 0, end: 1 }],
      };
      const normalizedMatch = { start: -1, end: 1 };
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });

    it('start > endの場合はnullを返す', () => {
      const mapping = {
        ranges: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
        ],
      };
      const normalizedMatch = { start: 2, end: 1 }; // 不正な範囲
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });

    it('start = endの場合（空の範囲）', () => {
      const mapping = {
        ranges: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
        ],
      };
      const normalizedMatch = { start: 1, end: 1 }; // 空の範囲
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      // start=1, end=1の場合、startRange=ranges[1], endRange=ranges[0]なので、{ start: 1, end: 1 }が返される
      expect(result).toEqual({ start: 1, end: 1 });
    });

    it('境界値: start = 0, end = ranges.length', () => {
      const mapping = {
        ranges: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 3 },
        ],
      };
      const normalizedMatch = { start: 0, end: 3 }; // 全体
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 0, end: 3 });
    });

    it('境界値: start = ranges.length - 1, end = ranges.length', () => {
      const mapping = {
        ranges: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 3 },
        ],
      };
      const normalizedMatch = { start: 2, end: 3 }; // 最後の1文字
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 2, end: 3 });
    });

    it('複数の濁点結合を含むマッピングでの変換', () => {
      // "か゛は゛" → "がば" (4文字 → 2文字)
      const mapping = {
        ranges: [
          { start: 0, end: 2 }, // が
          { start: 2, end: 4 }, // ば
        ],
      };
      const normalizedMatch = { start: 0, end: 2 }; // "がば"
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 0, end: 4 });
    });

    it('全角→半角変換と濁点結合が混在するマッピングでの変換', () => {
      // "Ａか゛Ｂ" → "aがb" (4文字 → 3文字)
      const mapping = {
        ranges: [
          { start: 0, end: 1 }, // a
          { start: 1, end: 3 }, // が
          { start: 3, end: 4 }, // b
        ],
      };
      const normalizedMatch = { start: 0, end: 3 }; // "aがb"
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 0, end: 4 });
    });

    it('ブロック境界マーカーを含むマッピングでの変換', () => {
      const marker = '\uE000';
      // `か゛${marker}は゛` → `が${marker}ば`
      const mapping = {
        ranges: [
          { start: 0, end: 2 }, // が
          { start: 2, end: 3 }, // marker
          { start: 3, end: 5 }, // ば
        ],
      };
      const normalizedMatch = { start: 0, end: 3 }; // "が" + marker
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      // startRange=ranges[0], endRange=ranges[2]なので、{ start: 0, end: 5 }が返される
      expect(result).toEqual({ start: 0, end: 5 });
    });
  });
});
