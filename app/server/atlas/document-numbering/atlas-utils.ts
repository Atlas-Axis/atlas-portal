// Compare two document numbers using natural ordering with embedded number support.
// - Ignores leading letter prefixes like "A." when comparing
// - Splits strings into alternating text and numeric chunks for natural comparison
// - Compares numeric chunks numerically (10 > 2) and text chunks lexicographically
// - Empty or invalid values are sorted last
//
// Examples (all return -1, 0, or 1):
//   compareDocNumbers('A.1.2', 'A.1.12')                       => -1   (2 < 12)
//   compareDocNumbers('A.1.12', 'A.1.2')                       =>  1   (12 > 2)
//   compareDocNumbers('A.10', 'A.2')                           =>  1   (10 > 2)
//   compareDocNumbers('1.9', 'A.1.10')                         => -1   (1.9 < 1.10)
//   compareDocNumbers('A.1.2', 'B.1.2')                        =>  0   (prefix ignored)
//   compareDocNumbers('A.1.4 - A2 - ...', 'A.1.4 - A10 - ...')  => -1   (A2 < A10)
//   compareDocNumbers('', 'A.1')                               =>  1   (empty sorts last)
export function compareDocNumbers(a: string, b: string): number {
  // Trim whitespace
  const normalize = (s: string): string => (s || '').trim();
  // Remove leading letter prefixes like "A."
  const stripPrefix = (s: string): string => s.replace(/^[A-Za-z]+\./, '');

  const aa = stripPrefix(normalize(a));
  const bb = stripPrefix(normalize(b));

  // If both are empty or invalid, they are equal
  if (!aa && !bb) return 0;
  // Empty or invalid values sort last
  if (!aa) return 1;
  // If only the second is empty or invalid, it sorts last
  if (!bb) return -1;

  // Split string into alternating text and numeric chunks
  // e.g., "4 - A10 - Text" becomes ["4", " - A", "10", " - Text"]
  const splitIntoChunks = (str: string): Array<{ text: string; isNumber: boolean }> => {
    const chunks: Array<{ text: string; isNumber: boolean }> = [];
    let current = '';
    let isCurrentNumber = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const isDigit = /\d/.test(char);

      if (i === 0) {
        // Initialize
        current = char;
        isCurrentNumber = isDigit;
      } else if (isDigit === isCurrentNumber) {
        // Continue current chunk
        current += char;
      } else {
        // Start new chunk
        chunks.push({ text: current, isNumber: isCurrentNumber });
        current = char;
        isCurrentNumber = isDigit;
      }
    }

    // Push the last chunk
    if (current) {
      chunks.push({ text: current, isNumber: isCurrentNumber });
    }

    return chunks;
  };

  const aChunks = splitIntoChunks(aa);
  const bChunks = splitIntoChunks(bb);
  const maxLen = Math.max(aChunks.length, bChunks.length);

  // Compare each chunk
  for (let i = 0; i < maxLen; i++) {
    const aChunk = aChunks[i];
    const bChunk = bChunks[i];

    // If one string ended, the shorter one comes first
    if (!aChunk && !bChunk) return 0;
    if (!aChunk) return -1;
    if (!bChunk) return 1;

    // If both chunks are numbers, compare numerically
    if (aChunk.isNumber && bChunk.isNumber) {
      const aNum = parseInt(aChunk.text, 10);
      const bNum = parseInt(bChunk.text, 10);
      if (aNum < bNum) return -1;
      if (aNum > bNum) return 1;
      continue;
    }

    // Otherwise compare as strings
    const cmp = aChunk.text.localeCompare(bChunk.text);
    if (cmp !== 0) return cmp;
  }

  return 0;
}
