import { BLOCK_BOUNDARY_MARKER } from '~/lib/constants';
import type { NormalizationMapping, NormalizationResult } from '~/lib/types';

/**
 * Process block boundary marker (keep as-is)
 */
function processBlockBoundaryMarker(
  originalIndex: number,
  normalizedText: string[],
  ranges: Array<{ start: number; end: number }>
): number {
  normalizedText.push(BLOCK_BOUNDARY_MARKER);
  ranges.push({ start: originalIndex, end: originalIndex + 1 });
  return originalIndex + 1;
}

/**
 * Process combined character (e.g., "か゛" → "が")
 */
function processCombinedCharacter(
  combined: string,
  originalIndex: number,
  normalizedText: string[],
  ranges: Array<{ start: number; end: number }>
): number {
  normalizedText.push(combined);
  ranges.push({ start: originalIndex, end: originalIndex + 2 });
  return originalIndex + 2;
}

/**
 * Process single character
 */
function processSingleCharacter(
  char: string,
  originalIndex: number,
  normalizedText: string[],
  ranges: Array<{ start: number; end: number }>
): number {
  const normalized = normalizeSingleChar(char);
  normalizedText.push(normalized);
  ranges.push({ start: originalIndex, end: originalIndex + 1 });
  return originalIndex + 1;
}

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
      originalIndex = processBlockBoundaryMarker(originalIndex, normalizedText, ranges);
      continue;
    }

    // Check for combining diacritical marks (濁点・半濁点)
    const nextChar =
      originalIndex + 1 < originalText.length ? originalText[originalIndex + 1] : null;
    const combined = combineWithDiacriticalMark(char, nextChar);

    if (combined) {
      originalIndex = processCombinedCharacter(combined, originalIndex, normalizedText, ranges);
    } else {
      originalIndex = processSingleCharacter(char, originalIndex, normalizedText, ranges);
    }
  }

  return {
    normalizedText: normalizedText.join(''),
    mapping: { ranges },
  };
}

/**
 * Check if character is a diacritical mark (濁点 or 半濁点)
 */
function isDiacriticalMark(char: string): { isDakuten: boolean; isHandakuten: boolean } {
  // 濁点 (U+3099, U+309B, U+FF9E) or 半濁点 (U+309A, U+309C, U+FF9F)
  // U+FF9E: 半角濁点, U+FF9F: 半角半濁点
  const isDakuten = char === '\u3099' || char === '\u309B' || char === '\uFF9E';
  const isHandakuten = char === '\u309A' || char === '\u309C' || char === '\uFF9F';
  return { isDakuten, isHandakuten };
}

/**
 * Get dakuten (濁点) mapping
 */
function getDakutenMap(): Record<string, string> {
  return {
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
}

/**
 * Get handakuten (半濁点) mapping
 */
function getHandakutenMap(): Record<string, string> {
  return {
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
}

/**
 * Combine base character with following diacritical mark
 * Returns combined character if applicable, null otherwise
 */
function combineWithDiacriticalMark(baseChar: string, nextChar: string | null): string | null {
  if (!nextChar) {
    return null;
  }

  const { isDakuten, isHandakuten } = isDiacriticalMark(nextChar);
  if (!isDakuten && !isHandakuten) {
    return null;
  }

  // Try dakuten mapping
  if (isDakuten) {
    const dakutenMap = getDakutenMap();
    if (dakutenMap[baseChar]) {
      return dakutenMap[baseChar];
    }
  }

  // Try handakuten mapping
  if (isHandakuten) {
    const handakutenMap = getHandakutenMap();
    if (handakutenMap[baseChar]) {
      return handakutenMap[baseChar];
    }
  }

  return null;
}

/**
 * Normalize full-width alphabet to half-width lowercase
 */
function normalizeFullWidthAlphabet(char: string): string | null {
  // Full-width A-Z → a-z
  if (char >= '\uFF21' && char <= '\uFF3A') {
    return String.fromCharCode(char.charCodeAt(0) - 0xff21 + 0x61);
  }
  // Full-width a-z → a-z
  if (char >= '\uFF41' && char <= '\uFF5A') {
    return String.fromCharCode(char.charCodeAt(0) - 0xff41 + 0x61);
  }
  return null;
}

/**
 * Normalize full-width numbers to half-width
 */
function normalizeFullWidthNumbers(char: string): string | null {
  if (char >= '\uFF10' && char <= '\uFF19') {
    return String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30);
  }
  return null;
}

/**
 * Normalize katakana to hiragana
 * Converts full-width katakana (U+30A1-U+30F6) to hiragana (U+3041-U+3096)
 * Also converts half-width katakana (U+FF66-U+FF9F) to hiragana
 */
function normalizeKatakanaToHiragana(char: string): string | null {
  // Full-width katakana range: U+30A1 to U+30F6
  // Hiragana range: U+3041 to U+3096
  // Difference: 0x60 (96)
  if (char >= '\u30A1' && char <= '\u30F6') {
    const codePoint = char.charCodeAt(0);
    const hiraganaCodePoint = codePoint - 0x60;
    return String.fromCharCode(hiraganaCodePoint);
  }

  // Half-width katakana range: U+FF66 to U+FF9F
  // Map to corresponding hiragana
  const halfWidthToHiraganaMap: Record<string, string> = {
    ｦ: 'を',
    ｧ: 'ぁ',
    ｨ: 'ぃ',
    ｩ: 'ぅ',
    ｪ: 'ぇ',
    ｫ: 'ぉ',
    ｬ: 'ゃ',
    ｭ: 'ゅ',
    ｮ: 'ょ',
    ｯ: 'っ',
    ｰ: 'ー',
    ｱ: 'あ',
    ｲ: 'い',
    ｳ: 'う',
    ｴ: 'え',
    ｵ: 'お',
    ｶ: 'か',
    ｷ: 'き',
    ｸ: 'く',
    ｹ: 'け',
    ｺ: 'こ',
    ｻ: 'さ',
    ｼ: 'し',
    ｽ: 'す',
    ｾ: 'せ',
    ｿ: 'そ',
    ﾀ: 'た',
    ﾁ: 'ち',
    ﾂ: 'つ',
    ﾃ: 'て',
    ﾄ: 'と',
    ﾅ: 'な',
    ﾆ: 'に',
    ﾇ: 'ぬ',
    ﾈ: 'ね',
    ﾉ: 'の',
    ﾊ: 'は',
    ﾋ: 'ひ',
    ﾌ: 'ふ',
    ﾍ: 'へ',
    ﾎ: 'ほ',
    ﾏ: 'ま',
    ﾐ: 'み',
    ﾑ: 'む',
    ﾒ: 'め',
    ﾓ: 'も',
    ﾔ: 'や',
    ﾕ: 'ゆ',
    ﾖ: 'よ',
    ﾗ: 'ら',
    ﾘ: 'り',
    ﾙ: 'る',
    ﾚ: 'れ',
    ﾛ: 'ろ',
    ﾜ: 'わ',
    ﾝ: 'ん',
  };

  if (halfWidthToHiraganaMap[char]) {
    return halfWidthToHiraganaMap[char];
  }

  return null;
}

/**
 * Normalize symbols
 */
function normalizeSymbols(char: string): string | null {
  const symbolMap: Record<string, string> = {
    // Hyphens and dashes
    ー: '-', // Long vowel mark → hyphen
    '－': '-', // Full-width hyphen → hyphen
    '—': '-', // Em dash → hyphen
    '–': '-', // En dash → hyphen
    '―': '-', // Horizontal bar → hyphen
    // Punctuation
    '／': '/', // Full-width slash → slash
    '＼': '\\', // Full-width backslash → backslash
    '：': ':', // Full-width colon → colon
    '；': ';', // Full-width semicolon → semicolon
    '，': ',', // Full-width comma → comma
    '。': '.', // Full-width period → period
    '．': '.', // Full-width full stop → period
    '、': ',', // Ideographic comma → comma
    '　': ' ', // Full-width space → space
    // Brackets
    '（': '(', // Full-width left parenthesis
    '）': ')', // Full-width right parenthesis
    '［': '[', // Full-width left square bracket
    '］': ']', // Full-width right square bracket
    '｛': '{', // Full-width left curly bracket
    '｝': '}', // Full-width right curly bracket
    '＜': '<', // Full-width less-than sign
    '＞': '>', // Full-width greater-than sign
    '「': '"', // Left corner bracket → double quote
    '」': '"', // Right corner bracket → double quote
    '『': '"', // Left white corner bracket → double quote
    '』': '"', // Right white corner bracket → double quote
    // Quotes
    '\uFF02': '"', // Full-width quotation mark
    '\uFF07': "'", // Full-width apostrophe
    '\u2018': "'", // Left single quotation mark
    '\u2019': "'", // Right single quotation mark
    '\u201C': '"', // Left double quotation mark
    '\u201D': '"', // Right double quotation mark
    // Math and symbols
    '＋': '+', // Full-width plus sign
    '＝': '=', // Full-width equals sign
    '＊': '*', // Full-width asterisk
    '＃': '#', // Full-width number sign
    '＄': '$', // Full-width dollar sign
    '％': '%', // Full-width percent sign
    '＆': '&', // Full-width ampersand
    '＠': '@', // Full-width at sign
    '＾': '^', // Full-width circumflex
    '｜': '|', // Full-width vertical line
    '～': '~', // Full-width tilde
    '＿': '_', // Full-width low line
    '！': '!', // Full-width exclamation mark
    '？': '?', // Full-width question mark
    '｀': '`', // Full-width grave accent
  };
  return symbolMap[char] || null;
}

/**
 * Normalize case (convert to lowercase)
 */
function normalizeCase(char: string): string | null {
  if (char >= 'A' && char <= 'Z') {
    return char.toLowerCase();
  }
  return null;
}

/**
 * Normalize single character
 */
function normalizeSingleChar(char: string): string {
  // Try each normalization type in order
  const normalized = normalizeFullWidthAlphabet(char);
  if (normalized !== null) {
    return normalized;
  }

  const normalizedNumber = normalizeFullWidthNumbers(char);
  if (normalizedNumber !== null) {
    return normalizedNumber;
  }

  // Convert katakana to hiragana (for fuzzy matching between hiragana and katakana)
  const normalizedKatakanaToHiragana = normalizeKatakanaToHiragana(char);
  if (normalizedKatakanaToHiragana !== null) {
    return normalizedKatakanaToHiragana;
  }

  const normalizedSymbol = normalizeSymbols(char);
  if (normalizedSymbol !== null) {
    return normalizedSymbol;
  }

  const normalizedCase = normalizeCase(char);
  if (normalizedCase !== null) {
    return normalizedCase;
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
