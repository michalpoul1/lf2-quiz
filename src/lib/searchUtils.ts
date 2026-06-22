/**
 * Normalize text for diacritic-insensitive, case-insensitive search.
 * "buněčná" → "bunecna", "kyselin" → "kyselin"
 */
export function normalizeText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type TextSegment = { text: string; highlight: boolean };

/**
 * Split text into highlighted/non-highlighted segments based on search term.
 * Uses diacritic-insensitive matching so original characters are preserved in output.
 */
export function getHighlightedSegments(text: string, term: string): TextSegment[] {
  if (!term || term.length === 0) return [{ text, highlight: false }];
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return [{ text, highlight: false }];

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let searchFrom = 0;

  while (searchFrom <= normalizedText.length) {
    const foundIndex = normalizedText.indexOf(normalizedTerm, searchFrom);
    if (foundIndex === -1) break;
    if (foundIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, foundIndex), highlight: false });
    }
    segments.push({
      text: text.slice(foundIndex, foundIndex + normalizedTerm.length),
      highlight: true,
    });
    lastIndex = foundIndex + normalizedTerm.length;
    searchFrom = lastIndex;
    if (normalizedTerm.length === 0) break;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}
