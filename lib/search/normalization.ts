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
 * Check if character is a digit (0-9, full-width, or kanji number)
 */
function isDigit(char: string): boolean {
  // Half-width digits
  if (char >= '0' && char <= '9') {
    return true;
  }
  // Full-width digits
  if (char >= '\uFF10' && char <= '\uFF19') {
    return true;
  }
  // Kanji numbers
  const kanjiNumbers = [
    '一',
    '二',
    '三',
    '四',
    '五',
    '六',
    '七',
    '八',
    '九',
    '十',
    '百',
    '千',
    '万',
    '零',
    '〇',
  ];
  if (kanjiNumbers.includes(char)) {
    return true;
  }
  return false;
}

/**
 * Check if character is a number separator (comma or period)
 */
function isNumberSeparator(char: string): boolean {
  return char === ',' || char === '.' || char === '，' || char === '。' || char === '．';
}

/**
 * Find and normalize a number sequence starting at the given index
 * Returns the normalized number string and the new index after processing
 * Normalizes number separators (commas and periods) to allow matching between different formats
 * Strategy: Remove all separators, but keep the last separator as decimal point if it's followed by 1-3 digits
 */
function processNumberSequence(
  text: string,
  startIndex: number,
  normalizedText: string[],
  ranges: Array<{ start: number; end: number }>
): number {
  let i = startIndex;
  const originalStart = startIndex;
  const digitsOnly: string[] = [];
  const separatorPositions: number[] = [];
  const separatorTypes: Array<'comma' | 'period'> = [];

  // Collect digits and track separator positions and types
  while (i < text.length) {
    const char = text[i];

    if (isDigit(char)) {
      const normalized = normalizeSingleChar(char);
      digitsOnly.push(normalized);
      i++;
    } else if (isNumberSeparator(char)) {
      separatorPositions.push(digitsOnly.length);
      // Determine separator type: comma (,) or period (.)
      const isComma = char === ',' || char === '，';
      separatorTypes.push(isComma ? 'comma' : 'period');
      i++;
    } else {
      // End of number sequence
      break;
    }
  }

  if (digitsOnly.length === 0) {
    return startIndex;
  }

  // Determine if the last separator is a decimal point
  // Rule: The last separator is a decimal point if:
  // 1. It's followed by 1-3 digits
  // 2. AND it's NOT part of a thousands separator pattern
  // Thousands separator pattern: 3 digits before separator, or consistent 3-digit groups
  let decimalPointPos = -1;
  if (separatorPositions.length > 0) {
    const lastSepPos = separatorPositions[separatorPositions.length - 1];
    const digitsAfterLastSep = digitsOnly.length - lastSepPos;
    const digitsBeforeLastSep = lastSepPos;

    // If there are 1-3 digits after the last separator
    if (digitsAfterLastSep > 0 && digitsAfterLastSep <= 3) {
      // Check if it's a thousands separator pattern
      // Pattern 1: Exactly 3 digits after the separator AND (1-3 digits before OR consistent pattern)
      // Pattern 2: Multiple separators with 3 digits between them (e.g., 1,234,567)
      let isThousandsSeparator = false;

      // Check separator type to help distinguish between thousands separator and decimal point
      const lastSepType = separatorTypes[separatorTypes.length - 1];

      if (digitsAfterLastSep === 3) {
        // Exactly 3 digits after - check if it's part of thousands pattern
        if (lastSepType === 'period' && digitsBeforeLastSep < 3) {
          // Period with less than 3 digits before and 3 digits after - likely decimal point (e.g., 1.234)
          // Exception: if digitsBeforeLastSep === 1 and all digits after are 0, it might be thousands separator (e.g., 1.000)
          // Check if all digits after separator are 0
          const allZeros = digitsOnly.slice(lastSepPos, lastSepPos + 3).every((d) => d === '0');
          if (allZeros && digitsBeforeLastSep === 1) {
            // 1.000 - likely thousands separator
            isThousandsSeparator = true;
          } else {
            // 1.234 - likely decimal point
            isThousandsSeparator = false;
          }
        } else if (digitsBeforeLastSep <= 3) {
          // 1-3 digits before and 3 digits after - likely thousands separator (e.g., 1,000 or 12,000)
          isThousandsSeparator = true;
        } else if (separatorPositions.length > 1) {
          // Multiple separators - check if pattern is consistent
          // If previous separators also have 3 digits after them, it's thousands separator
          const prevSepPos = separatorPositions[separatorPositions.length - 2];
          const digitsBetween = lastSepPos - prevSepPos;
          if (digitsBetween === 3) {
            // Pattern like 1,234,567 - previous separator has 3 digits after it
            // For fuzzy search, we want "1,234,56" to match "1,234,567"
            // The issue is:
            // - "1,234,56" → "1234.56" (last separator treated as decimal point)
            // - "1,234,567" → "1234567" (last separator removed as thousands separator)
            // These don't match.
            // Solution: For patterns like "1,234,56" where we have multiple separators
            // and the last separator has 2 digits after it, we should treat it as
            // a thousands separator (remove it) to allow matching with "1,234,567"
            // This means "1,234,56" → "123456" which matches "1234567"
            if (digitsBeforeLastSep >= 3) {
              // 3+ digits before - likely thousands separator
              isThousandsSeparator = true;
            } else {
              // Less than 3 digits before last separator with 3 digits after
              // For consistency with "1,234,56" pattern, treat as thousands separator
              isThousandsSeparator = true;
            }
          }
        }
      } else if (digitsAfterLastSep < 3) {
        // Less than 3 digits after - check if it's a decimal point or thousands separator
        if (separatorPositions.length === 1) {
          // Single separator with less than 3 digits after - likely decimal point (e.g., 123.45)
          isThousandsSeparator = false;
        } else if (separatorPositions.length > 1) {
          // Multiple separators - check if pattern is consistent
          // Multiple separators with less than 3 digits after last separator
          // Check if previous separators have consistent pattern
          const prevSepPos = separatorPositions[separatorPositions.length - 2];
          const digitsBetween = lastSepPos - prevSepPos;
          if (digitsBetween === 3) {
            // Previous separator has 3 digits after it - likely thousands separator pattern
            // But last separator has less than 3 digits after it - might be decimal point
            // For fuzzy search, we want to match both patterns:
            // - If it's a thousands separator: 1,234,56 → 123456 (no decimal point)
            // - If it's a decimal point: 1,234,56 → 1234.56
            // However, if there are multiple separators with 3 digits between them,
            // and the last separator has 2 digits after it, treat as decimal point for better matching
            // This allows "1,234,56" to match "1,234,567" (both can be interpreted as having decimal parts)
            if (digitsAfterLastSep === 2) {
              // 2 digits after last separator - could be decimal point (e.g., 1,234,56)
              // Check separator type: if last separator is different type from previous ones,
              // it's likely a decimal point (e.g., 1,234.56 - comma is thousands, period is decimal)
              const prevSepType = separatorTypes[separatorTypes.length - 2];
              if (lastSepType !== prevSepType) {
                // Different separator types - last one is likely decimal point
                isThousandsSeparator = false;
              } else if (separatorPositions.length >= 3) {
                // 3+ separators with same type - if last separator has 2 digits after it,
                // it's likely a decimal point (e.g., 1,234.567.89)
                isThousandsSeparator = false;
              } else if (digitsBeforeLastSep >= 3) {
                // Same separator type with 2 separators (e.g., 1,234,56) - for fuzzy search compatibility
                // with "1,234,567", treat as thousands separator (remove it)
                // so "1,234,56" → "123456" which matches "1234567"
                isThousandsSeparator = true;
              } else {
                // Less than 3 digits before - likely decimal point
                isThousandsSeparator = false;
              }
            } else {
              // Less than 2 digits - treat as thousands separator
              isThousandsSeparator = true;
            }
          } else if (digitsBetween < 3) {
            // Less than 3 digits between separators - likely not thousands separator (e.g., 1,2,3)
            // All separators should be removed (not decimal point)
            isThousandsSeparator = true;
          } else {
            // Inconsistent pattern - likely not thousands separator
            isThousandsSeparator = false;
          }
          // Additional check: if any separator has less than 3 digits before or after it,
          // and it's not the last separator, then all separators are likely not thousands separators
          let hasInvalidPattern = false;
          for (let k = 0; k < separatorPositions.length; k++) {
            const sepPos = separatorPositions[k];
            const digitsBefore = sepPos;
            const digitsAfter =
              k < separatorPositions.length - 1
                ? separatorPositions[k + 1] - sepPos
                : digitsOnly.length - sepPos;
            if (digitsBefore < 3 && digitsAfter < 3 && k < separatorPositions.length - 1) {
              hasInvalidPattern = true;
              break;
            }
          }
          if (hasInvalidPattern) {
            // Pattern like 1,2,3 - all separators should be removed
            isThousandsSeparator = true;
          }
        } else {
          // Single separator with less than 3 digits after - likely decimal point
          isThousandsSeparator = false;
        }
      } else if (separatorPositions.length > 1) {
        // Multiple separators - check if pattern is consistent
        // All separators should have 3 digits after them (except the last one)
        let allHaveThreeDigits = true;
        for (let k = 0; k < separatorPositions.length - 1; k++) {
          const nextSepPos = separatorPositions[k + 1];
          const digitsBetween = nextSepPos - separatorPositions[k];
          if (digitsBetween !== 3) {
            allHaveThreeDigits = false;
            break;
          }
        }
        // Also check digits before first separator
        if (separatorPositions[0] > 0 && separatorPositions[0] !== 3) {
          // If first separator doesn't have exactly 3 digits before it,
          // check if it's part of a pattern (e.g., 12,345,678)
          const digitsBeforeFirst = separatorPositions[0];
          if (digitsBeforeFirst > 3 && digitsBeforeFirst % 3 !== 0) {
            allHaveThreeDigits = false;
          }
        }
        if (allHaveThreeDigits) {
          isThousandsSeparator = true;
        }
      }

      // If it's not a thousands separator, treat it as decimal point
      if (!isThousandsSeparator) {
        decimalPointPos = lastSepPos;
      }
    }
  }

  // Build normalized number: digits only, with decimal point if applicable
  const normalizedNumber: string[] = [];
  for (let j = 0; j < digitsOnly.length; j++) {
    if (j === decimalPointPos) {
      normalizedNumber.push('.');
    }
    normalizedNumber.push(digitsOnly[j]);
  }

  // Add normalized number to output
  const normalizedStr = normalizedNumber.join('');
  // Calculate the number of characters in the original text (excluding separators that are removed)
  // This is: digitsOnly.length + (1 if decimal point is added, 0 otherwise)
  const originalCharCount = digitsOnly.length + (decimalPointPos >= 0 ? 1 : 0);

  for (let j = 0; j < normalizedStr.length; j++) {
    normalizedText.push(normalizedStr[j]);
    // Each character in normalized string gets its own range mapping to the entire original number sequence
    ranges.push({ start: originalStart, end: i });
  }

  // If the normalized string is shorter than the original character count, add additional ranges
  // This happens when separators are removed but we still want to map to the original positions
  while (ranges.length < originalCharCount) {
    ranges.push({ start: originalStart, end: i });
  }

  return i;
}

/**
 * Process single character
 * Handles cases where one character normalizes to multiple characters (e.g., ß → ss)
 */
function processSingleCharacter(
  char: string,
  originalIndex: number,
  normalizedText: string[],
  ranges: Array<{ start: number; end: number }>
): number {
  const normalized = normalizeSingleChar(char);
  // If normalized to multiple characters, add each character separately with the same range
  for (const normalizedChar of normalized) {
    normalizedText.push(normalizedChar);
    ranges.push({ start: originalIndex, end: originalIndex + 1 });
  }
  return originalIndex + 1;
}

/**
 * Normalize text for fuzzy search
 * Handles:
 * - Full-width to half-width conversion (alphabet, numbers, katakana)
 * - Symbol normalization (hyphens, long vowels, etc.)
 * - Combining diacritical marks (e.g., "か゛" → "が")
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

    // Check if this is the start of a number sequence
    if (isDigit(char)) {
      originalIndex = processNumberSequence(originalText, originalIndex, normalizedText, ranges);
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
    originalText,
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
 * Normalize superscript, subscript, and circled numbers to regular numbers
 * Converts:
 * - Superscript numbers (¹, ², ³, ⁰-⁹) → 1, 2, 3, 0-9
 * - Subscript numbers (₁, ₂, ₃, ₀-₉) → 1, 2, 3, 0-9
 * - Circled numbers (①-⑳, ⓫-⓴, ⓵-⓿) → 1-20, 11-20, 1-10
 */
function normalizeSpecialNumbers(char: string): string | null {
  const codePoint = char.charCodeAt(0);

  // Superscript numbers: U+2070-U+2079 (⁰-⁹), U+00B9 (¹), U+00B2 (²), U+00B3 (³)
  if (codePoint >= 0x2070 && codePoint <= 0x2079) {
    // ⁰-⁹ → 0-9
    return String.fromCharCode(codePoint - 0x2070 + 0x30);
  }
  if (codePoint === 0x00b9) return '1'; // ¹ → 1
  if (codePoint === 0x00b2) return '2'; // ² → 2
  if (codePoint === 0x00b3) return '3'; // ³ → 3

  // Subscript numbers: U+2080-U+2089 (₀-₉)
  if (codePoint >= 0x2080 && codePoint <= 0x2089) {
    // ₀-₉ → 0-9
    return String.fromCharCode(codePoint - 0x2080 + 0x30);
  }

  // Circled numbers: U+2460-U+2473 (①-⑳), U+24EB-U+24F4 (⓫-⓴), U+24F5-U+24FF (⓵-⓿)
  if (codePoint >= 0x2460 && codePoint <= 0x2473) {
    // ①-⑳ → 1-20
    const num = codePoint - 0x2460 + 1;
    return num.toString();
  }
  if (codePoint >= 0x24eb && codePoint <= 0x24f4) {
    // ⓫-⓴ → 11-20
    const num = codePoint - 0x24eb + 11;
    return num.toString();
  }
  if (codePoint >= 0x24f5 && codePoint <= 0x24ff) {
    // ⓵-⓿ → 1-10 (but ⓿ is 0)
    if (codePoint === 0x24ff) return '0'; // ⓿ → 0
    const num = codePoint - 0x24f5 + 1;
    return num.toString();
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
 * Get query expansion options for accented characters
 * Returns array of possible search patterns for a given accented character
 * For example, 'ä' can match both 'a' and 'ae'
 */
function getAccentedCharQueryExpansions(char: string): string[] | null {
  const expansionMap: Record<string, string[]> = {
    // German umlauts: can match both base letter and substitution spelling
    ä: ['a', 'ae'],
    ö: ['o', 'oe'],
    ü: ['u', 'ue'],
    Ä: ['a', 'ae'],
    Ö: ['o', 'oe'],
    Ü: ['u', 'ue'],
    ß: ['ss'], // ß only matches 'ss', not 's'
    // French ligatures
    œ: ['oe'],
    Œ: ['oe'],
    // Scandinavian
    æ: ['ae'],
    Æ: ['ae'],
    // Other characters that normalize to multiple characters
    // Note: Characters that normalize to single characters (like à → a) don't need expansion
    // because they will match through the normalization process
  };
  return expansionMap[char] || null;
}

/**
 * Normalize accented characters to their base English alphabet equivalents
 * Supports French, German, Italian, Spanish, and other European languages
 */
function normalizeAccentedCharacters(char: string): string | null {
  const accentedCharMap: Record<string, string> = {
    // French
    à: 'a',
    â: 'a',
    ç: 'c',
    é: 'e',
    è: 'e',
    ê: 'e',
    ë: 'e',
    î: 'i',
    ï: 'i',
    ô: 'o',
    ù: 'u',
    û: 'u',
    ÿ: 'y',
    // French uppercase
    À: 'a',
    Â: 'a',
    Ç: 'c',
    É: 'e',
    È: 'e',
    Ê: 'e',
    Ë: 'e',
    Î: 'i',
    Ï: 'i',
    Ô: 'o',
    Ù: 'u',
    Û: 'u',
    Ÿ: 'y',
    œ: 'oe', // French ligature → oe (substitution spelling)
    Œ: 'oe', // French ligature uppercase → oe
    // German (with substitution spelling)
    ä: 'ae', // German umlaut → ae (substitution spelling)
    ö: 'oe', // German umlaut → oe (substitution spelling)
    ü: 'ue', // German umlaut → ue (substitution spelling)
    Ä: 'ae', // German umlaut uppercase → ae
    Ö: 'oe', // German umlaut uppercase → oe
    Ü: 'ue', // German umlaut uppercase → ue
    ß: 'ss', // German sharp S → ss (substitution spelling)
    // Italian
    ì: 'i',
    ò: 'o',
    Ì: 'i',
    Ò: 'o',
    // Spanish
    á: 'a',
    í: 'i',
    ñ: 'n',
    ó: 'o',
    ú: 'u',
    Á: 'a',
    Í: 'i',
    Ñ: 'n',
    Ó: 'o',
    Ú: 'u',
    // Portuguese
    ã: 'a',
    õ: 'o',
    Ã: 'a',
    Õ: 'o',
    // Scandinavian
    å: 'a',
    æ: 'ae',
    ø: 'o',
    Å: 'a',
    Æ: 'ae',
    Ø: 'o',
    // Other European languages
    č: 'c',
    ć: 'c',
    đ: 'd',
    š: 's',
    ž: 'z',
    Č: 'c',
    Ć: 'c',
    Đ: 'd',
    Š: 's',
    Ž: 'z',
    ł: 'l',
    Ł: 'l',
    ń: 'n',
    ś: 's',
    ź: 'z',
    ż: 'z',
    Ń: 'n',
    Ś: 's',
    Ź: 'z',
    Ż: 'z',
    // Romanian
    ă: 'a',
    ș: 's',
    ț: 't',
    Ă: 'a',
    Ș: 's',
    Ț: 't',
    // Czech/Slovak
    ý: 'y',
    Ý: 'y',
  };
  return accentedCharMap[char] || null;
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

  const normalizedSpecialNumber = normalizeSpecialNumbers(char);
  if (normalizedSpecialNumber !== null) {
    return normalizedSpecialNumber;
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

  // Normalize accented characters to base English alphabet
  const normalizedAccented = normalizeAccentedCharacters(char);
  if (normalizedAccented !== null) {
    return normalizedAccented;
  }

  // Keep as-is if no normalization needed
  return char;
}

/**
 * Get reverse mapping: base characters that can match accented characters
 * For example, 'a' can match 'ä' (which normalizes to 'ae')
 * Returns the normalized form of accented characters that match this base character
 */
function getBaseCharExpansions(char: string): string[] | null {
  // Map base characters to their accented character normalizations
  // For example, 'a' can match 'ä' (→ 'ae'), 'à' (→ 'a'), 'â' (→ 'a'), etc.
  // But we only need the substitution spellings (like 'ae' for 'ä')
  const baseCharMap: Record<string, string[]> = {
    a: ['a', 'ae'], // 'a' can match 'a' and 'ä' (→ 'ae')
    o: ['o', 'oe'], // 'o' can match 'o' and 'ö' (→ 'oe')
    u: ['u', 'ue'], // 'u' can match 'u' and 'ü' (→ 'ue')
    s: ['s', 'ss'], // 's' can match 's' and 'ß' (→ 'ss')
  };
  return baseCharMap[char] || null;
}

/**
 * Check if a character is an accented character that should not be expanded
 * (i.e., if the query contains accented characters, they should match only accented characters)
 */
export function isAccentedCharInQuery(char: string): boolean {
  // Check if this character has a query expansion (meaning it's an accented character)
  // If it has expansions, it means it's an accented character that should match base characters
  // But if it's in the query, we don't want to expand it
  return getAccentedCharQueryExpansions(char) !== null;
}

/**
 * Expand query to handle accented characters with multiple matching patterns
 * For example, 'a' expands to ['a', 'ae'] to match both 'a' and 'ä' (which normalizes to 'ae')
 * But if query contains 'ä', it only matches 'ä' (not 'a' or 'ae')
 * @param query Original query string
 * @returns Array of expanded query patterns
 */
export function expandQueryForAccentedChars(query: string): string[] {
  if (query.length === 0) {
    return [query];
  }

  // Check if query contains any accented characters
  // If it does, don't expand - just normalize and return as-is
  let hasAccentedChar = false;
  for (let i = 0; i < query.length; i++) {
    if (isAccentedCharInQuery(query[i])) {
      hasAccentedChar = true;
      break;
    }
  }

  if (hasAccentedChar) {
    // Query contains accented characters - don't expand, just normalize
    const normalized = normalizeText(query).normalizedText;
    return [normalized];
  }

  // Query doesn't contain accented characters - expand to match accented characters
  // Generate all combinations of expanded characters
  const expansions: string[][] = [];
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const normalized = normalizeSingleChar(char);

    // Check if this base character can match accented characters
    const baseExpansions = getBaseCharExpansions(normalized);
    if (baseExpansions && baseExpansions.length > 0) {
      // This character can match accented characters - expand it
      expansions.push(baseExpansions);
    } else {
      // No expansion, use the normalized character as-is
      expansions.push([normalized]);
    }
  }

  // Generate cartesian product of all expansions
  if (expansions.length === 0) {
    return [query];
  }

  const results: string[] = [];
  const indices = new Array(expansions.length).fill(0);

  while (true) {
    // Build query from current indices
    let expandedQuery = '';
    for (let i = 0; i < expansions.length; i++) {
      expandedQuery += expansions[i][indices[i]];
    }
    results.push(expandedQuery);

    // Increment indices
    let i = expansions.length - 1;
    while (i >= 0) {
      indices[i]++;
      if (indices[i] < expansions[i].length) {
        break;
      }
      indices[i] = 0;
      i--;
    }

    if (i < 0) {
      break; // All combinations generated
    }
  }

  return results;
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
