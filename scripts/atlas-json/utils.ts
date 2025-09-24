import { AtlasDatabaseName, GitHubAtlasDocumentType } from '@/app/server/services/atlas/constants';

const CATEGORIES_REQUIRING_A_PREFIX: ReadonlyArray<GitHubAtlasDocumentType | AtlasDatabaseName> = [
  'Active Data',
  'Type Specifications',
  'Articles',
  'Sections & Primary Docs',
];

export function fixDocumentNumberPrefix(
  docNumber: string,
  category: GitHubAtlasDocumentType | AtlasDatabaseName,
): string {
  if (!docNumber) return docNumber;
  if (CATEGORIES_REQUIRING_A_PREFIX.includes(category)) {
    if (!docNumber.startsWith('A.')) {
      return `A.${docNumber}`;
    }
  }
  return docNumber;
}

// Compare two document numbers using natural, dot-aware numeric ordering.
// - Ignores leading letter prefixes like "A." when comparing
// - Compares each dot-separated segment numerically when possible
// - Falls back to string comparison for non-numeric segments
// - Empty or invalid values are sorted last
//
// Examples (all return -1, 0, or 1):
//   compareDocNumbers('A.1.2', 'A.1.12')  => -1   (2 < 12 within same subgroup)
//   compareDocNumbers('A.1.12', 'A.1.2')  =>  1   (12 > 2)
//   compareDocNumbers('A.10', 'A.2')      =>  1   (10 > 2 numerically)
//   compareDocNumbers('1.9', 'A.1.10')    => -1   (prefix ignored; 1.9 < 1.10)
//   compareDocNumbers('A.1.2', 'B.1.2')   =>  0   (prefix ignored; equal numbers)
//   compareDocNumbers('', 'A.1')          =>  1   (empty sorts last)
export function compareDocNumbers(a: string, b: string): number {
  const normalize = (s: string): string => (s || '').trim();
  const stripPrefix = (s: string): string => s.replace(/^[A-Za-z]+\./, '');

  const aa = stripPrefix(normalize(a));
  const bb = stripPrefix(normalize(b));

  if (!aa && !bb) return 0;
  if (!aa) return 1;
  if (!bb) return -1;

  const ap = aa.split('.');
  const bp = bb.split('.');
  const maxLen = Math.max(ap.length, bp.length);

  for (let i = 0; i < maxLen; i++) {
    const av = ap[i];
    const bv = bp[i];

    if (av === undefined && bv === undefined) return 0;
    if (av === undefined) return -1; // shorter comes first
    if (bv === undefined) return 1;

    const an = /^\d+$/.test(av) ? parseInt(av, 10) : NaN;
    const bn = /^\d+$/.test(bv) ? parseInt(bv, 10) : NaN;

    if (!Number.isNaN(an) && !Number.isNaN(bn)) {
      if (an < bn) return -1;
      if (an > bn) return 1;
      continue;
    }

    // Fallback to localeCompare for non-numeric tokens
    const cmp = av.localeCompare(bv);
    if (cmp !== 0) return cmp;
  }

  return 0;
}

