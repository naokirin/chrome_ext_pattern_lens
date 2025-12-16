import { BLOCK_BOUNDARY_MARKER } from '~/lib/constants';
import type { NormalizationMapping, NormalizationResult } from '~/lib/types';

/**
 * Normalize text for fuzzy search
 * Handles:
 * - Full-width to half-width conversion (alphabet, numbers, katakana)
 * - Symbol normalization (hyphens, long vowels, etc.)
 * - Combining diacritical marks (e.g., "か゛" → "が")
 * - Date format normalization
 */
export function normalizeText(originalText: string): NormalizationResult {
  const normalizedText: string[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  let originalIndex = 0;

  while (originalIndex < originalText.length) {
    const char = originalText[originalIndex];

    // Skip block boundary markers (keep as-is)
    if (char === BLOCK_BOUNDARY_MARKER) {
      normalizedText.push(char);
      ranges.push({ start: originalIndex, end: originalIndex + 1 });
      originalIndex++;
      continue;
    }

    // Check for combining diacritical marks (濁点・半濁点)
    const nextChar =
      originalIndex + 1 < originalText.length ? originalText[originalIndex + 1] : null;
    const combined = combineWithDiacriticalMark(char, nextChar);

    if (combined) {
      // Combined character (e.g., "か゛" → "が")
      normalizedText.push(combined);
      ranges.push({ start: originalIndex, end: originalIndex + 2 });
      originalIndex += 2;
    } else {
      // Single character normalization
      const normalized = normalizeSingleChar(char);
      normalizedText.push(normalized);
      ranges.push({ start: originalIndex, end: originalIndex + 1 });
      originalIndex++;
    }
  }

  return {
    normalizedText: normalizedText.join(''),
    mapping: { ranges },
  };
}

/**
 * Combine base character with following diacritical mark
 * Returns combined character if applicable, null otherwise
 */
function combineWithDiacriticalMark(baseChar: string, nextChar: string | null): string | null {
  if (!nextChar) {
    return null;
  }

  // 濁点 (U+3099, U+309B, U+FF9E) or 半濁点 (U+309A, U+309C, U+FF9F)
  // U+FF9E: 半角濁点, U+FF9F: 半角半濁点
  const isDakuten = nextChar === '\u3099' || nextChar === '\u309B' || nextChar === '\uFF9E';
  const isHandakuten = nextChar === '\u309A' || nextChar === '\u309C' || nextChar === '\uFF9F';

  if (!isDakuten && !isHandakuten) {
    return null;
  }

  // Map base characters to their combined forms
  const dakutenMap: Record<string, string> = {
    // 基本のひらがな
    か: 'が',
    き: 'ぎ',
    く: 'ぐ',
    け: 'げ',
    こ: 'ご',
    さ: 'ざ',
    し: 'じ',
    す: 'ず',
    せ: 'ぜ',
    そ: 'ぞ',
    た: 'だ',
    ち: 'ぢ',
    つ: 'づ',
    て: 'で',
    と: 'ど',
    は: 'ば',
    ひ: 'び',
    ふ: 'ぶ',
    へ: 'べ',
    ほ: 'ぼ',
    // 古い仮名（歴史的仮名遣い）
    ゐ: 'ゐ゙', // ゐ + 濁点 → ゐ゙（結合文字として扱う）
    ゑ: 'ゑ゙', // ゑ + 濁点 → ゑ゙（結合文字として扱う）
    う: 'ゔ', // う + 濁点 → ゔ（U+3094、既に結合された文字）
    // 小書き文字（濁点が付く可能性があるもの）
    ぁ: 'ぁ゙', // 小書きあ + 濁点（結合文字として扱う）
    ぃ: 'ぃ゙', // 小書きい + 濁点（結合文字として扱う）
    ぅ: 'ぅ゙', // 小書きう + 濁点（結合文字として扱う）
    ぇ: 'ぇ゙', // 小書きえ + 濁点（結合文字として扱う）
    ぉ: 'ぉ゙', // 小書きお + 濁点（結合文字として扱う）
    ゃ: 'ゃ゙', // 小書きや + 濁点（結合文字として扱う）
    ゅ: 'ゅ゙', // 小書きゆ + 濁点（結合文字として扱う）
    ょ: 'ょ゙', // 小書きよ + 濁点（結合文字として扱う）
    ゎ: 'ゎ゙', // 小書きわ + 濁点（結合文字として扱う）
    // 基本のカタカナ
    カ: 'ガ',
    キ: 'ギ',
    ク: 'グ',
    ケ: 'ゲ',
    コ: 'ゴ',
    サ: 'ザ',
    シ: 'ジ',
    ス: 'ズ',
    セ: 'ゼ',
    ソ: 'ゾ',
    タ: 'ダ',
    チ: 'ヂ',
    ツ: 'ヅ',
    テ: 'デ',
    ト: 'ド',
    ハ: 'バ',
    ヒ: 'ビ',
    フ: 'ブ',
    ヘ: 'ベ',
    ホ: 'ボ',
    // 古いカタカナ（歴史的仮名遣い）
    ヰ: 'ヸ', // ヰ + 濁点 → ヸ（U+30F8、既に結合された文字）
    ヱ: 'ヹ', // ヱ + 濁点 → ヹ（U+30F9、既に結合された文字）
    ウ: 'ヴ', // ウ + 濁点 → ヴ（U+30F4、既に結合された文字）
    // 小書きカタカナ（濁点が付く可能性があるもの）
    ァ: 'ァ゙', // 小書きア + 濁点
    ィ: 'ィ゙', // 小書きイ + 濁点
    ゥ: 'ゥ゙', // 小書きウ + 濁点
    ェ: 'ェ゙', // 小書きエ + 濁点
    ォ: 'ォ゙', // 小書きオ + 濁点
    ャ: 'ャ゙', // 小書きヤ + 濁点
    ュ: 'ュ゙', // 小書きユ + 濁点
    ョ: 'ョ゙', // 小書きヨ + 濁点
    ヮ: 'ヮ゙', // 小書きワ + 濁点
    // 半角カタカナ
    ｶ: 'ガ',
    ｷ: 'ギ',
    ｸ: 'グ',
    ｹ: 'ゲ',
    ｺ: 'ゴ',
    ｻ: 'ザ',
    ｼ: 'ジ',
    ｽ: 'ズ',
    ｾ: 'ゼ',
    ｿ: 'ゾ',
    ﾀ: 'ダ',
    ﾁ: 'ヂ',
    ﾂ: 'ヅ',
    ﾃ: 'デ',
    ﾄ: 'ド',
    ﾊ: 'バ',
    ﾋ: 'ビ',
    ﾌ: 'ブ',
    ﾍ: 'ベ',
    ﾎ: 'ボ',
    ｳ: 'ヴ', // 半角ウ + 濁点 → ヴ
  };

  const handakutenMap: Record<string, string> = {
    は: 'ぱ',
    ひ: 'ぴ',
    ふ: 'ぷ',
    へ: 'ぺ',
    ほ: 'ぽ',
    ハ: 'パ',
    ヒ: 'ピ',
    フ: 'プ',
    ヘ: 'ペ',
    ホ: 'ポ',
    ﾊ: 'パ',
    ﾋ: 'ピ',
    ﾌ: 'プ',
    ﾍ: 'ペ',
    ﾎ: 'ポ',
  };

  if (isDakuten && dakutenMap[baseChar]) {
    return dakutenMap[baseChar];
  }

  if (isHandakuten && handakutenMap[baseChar]) {
    return handakutenMap[baseChar];
  }

  return null;
}

/**
 * Normalize single character
 */
function normalizeSingleChar(char: string): string {
  // Full-width to half-width alphabet
  if (char >= '\uFF21' && char <= '\uFF3A') {
    // Full-width A-Z → a-z
    return String.fromCharCode(char.charCodeAt(0) - 0xff21 + 0x61);
  }
  if (char >= '\uFF41' && char <= '\uFF5A') {
    // Full-width a-z → a-z
    return String.fromCharCode(char.charCodeAt(0) - 0xff41 + 0x61);
  }

  // Full-width to half-width numbers
  if (char >= '\uFF10' && char <= '\uFF19') {
    // Full-width 0-9 → 0-9
    return String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30);
  }

  // Full-width to half-width katakana
  if (char >= '\u30A1' && char <= '\u30F6') {
    // Full-width katakana → half-width katakana
    const halfWidthKatakanaMap: Record<string, string> = {
      ァ: 'ｧ',
      ア: 'ｱ',
      ィ: 'ｨ',
      イ: 'ｲ',
      ゥ: 'ｩ',
      ウ: 'ｳ',
      ェ: 'ｪ',
      エ: 'ｴ',
      ォ: 'ｫ',
      オ: 'ｵ',
      カ: 'ｶ',
      ガ: 'ｶ',
      キ: 'ｷ',
      ギ: 'ｷ',
      ク: 'ｸ',
      グ: 'ｸ',
      ケ: 'ｹ',
      ゲ: 'ｹ',
      コ: 'ｺ',
      ゴ: 'ｺ',
      サ: 'ｻ',
      ザ: 'ｻ',
      シ: 'ｼ',
      ジ: 'ｼ',
      ス: 'ｽ',
      ズ: 'ｽ',
      セ: 'ｾ',
      ゼ: 'ｾ',
      ソ: 'ｿ',
      ゾ: 'ｿ',
      タ: 'ﾀ',
      ダ: 'ﾀ',
      チ: 'ﾁ',
      ヂ: 'ﾁ',
      ツ: 'ﾂ',
      ヅ: 'ﾂ',
      テ: 'ﾃ',
      デ: 'ﾃ',
      ト: 'ﾄ',
      ド: 'ﾄ',
      ナ: 'ﾅ',
      ニ: 'ﾆ',
      ヌ: 'ﾇ',
      ネ: 'ﾈ',
      ノ: 'ﾉ',
      ハ: 'ﾊ',
      バ: 'ﾊ',
      パ: 'ﾊ',
      ヒ: 'ﾋ',
      ビ: 'ﾋ',
      ピ: 'ﾋ',
      フ: 'ﾌ',
      ブ: 'ﾌ',
      プ: 'ﾌ',
      ヘ: 'ﾍ',
      ベ: 'ﾍ',
      ペ: 'ﾍ',
      ホ: 'ﾎ',
      ボ: 'ﾎ',
      ポ: 'ﾎ',
      マ: 'ﾏ',
      ミ: 'ﾐ',
      ム: 'ﾑ',
      メ: 'ﾒ',
      モ: 'ﾓ',
      ヤ: 'ﾔ',
      ユ: 'ﾕ',
      ヨ: 'ﾖ',
      ラ: 'ﾗ',
      リ: 'ﾘ',
      ル: 'ﾙ',
      レ: 'ﾚ',
      ロ: 'ﾛ',
      ワ: 'ﾜ',
      ヲ: 'ｦ',
      ン: 'ﾝ',
      ヴ: 'ｳ', // ヴ → 半角ウ（濁点は除去）
      ヸ: 'ｳ', // ヸ → 半角ウ（濁点は除去、元の文字がヰなので）
      ヹ: 'ｳ', // ヹ → 半角ウ（濁点は除去、元の文字がヱなので）
      ゔ: 'ｳ', // ゔ → 半角ウ（濁点は除去）
      ッ: 'ｯ',
      ャ: 'ｬ',
      ュ: 'ｭ',
      ョ: 'ｮ',
      ー: 'ｰ',
    };
    return halfWidthKatakanaMap[char] || char;
  }

  // Symbol normalization
  const symbolMap: Record<string, string> = {
    ー: '-', // Long vowel mark → hyphen
    '－': '-', // Full-width hyphen → hyphen
    '／': '/', // Full-width slash → slash
    '：': ':', // Full-width colon → colon
    '；': ';', // Full-width semicolon → semicolon
    '，': ',', // Full-width comma → comma
    '。': '.', // Full-width period → period
    '　': ' ', // Full-width space → space
  };

  if (symbolMap[char]) {
    return symbolMap[char];
  }

  // Case-insensitive: convert to lowercase
  if (char >= 'A' && char <= 'Z') {
    return char.toLowerCase();
  }

  // Keep as-is if no normalization needed
  return char;
}

/**
 * Convert normalized match position to original virtual text position
 */
export function convertNormalizedMatchToOriginal(
  normalizedMatch: { start: number; end: number },
  mapping: NormalizationMapping
): { start: number; end: number } | null {
  if (normalizedMatch.start < 0 || normalizedMatch.end > mapping.ranges.length) {
    return null;
  }

  const startRange = mapping.ranges[normalizedMatch.start];
  const endRange = mapping.ranges[normalizedMatch.end - 1];

  if (!startRange || !endRange) {
    return null;
  }

  return {
    start: startRange.start,
    end: endRange.end,
  };
}
