// Full-text search over the decrypted index, entirely in the browser.
//
// Every search term must match somewhere in a document (title, tags, category,
// file name, notes, or the text extracted from the file). Matching is
// case-insensitive, ignores accents, and also tries a punctuation-free form so
// "hpsp" finds "H.P.S.P." and "policy 12345" finds "Policy #12-345".

const FIELDS = [
  { key: 'title', weight: 10 },
  { key: 'tags', weight: 6 },
  { key: 'category', weight: 4 },
  { key: 'fileName', weight: 4 },
  { key: 'notes', weight: 3 },
  { key: 'text', weight: 1 },
];

export function normalize(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(s) {
  return s.replace(/[^a-z0-9]/g, '');
}

export function tokenize(query) {
  const terms = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(query))) {
    const t = normalize(m[1] ?? m[2]);
    if (t) terms.push(t);
  }
  return terms;
}

function fieldText(doc, key) {
  const v = doc[key];
  return Array.isArray(v) ? v.join(' ') : v || '';
}

function prepare(doc) {
  const fields = {};
  for (const { key } of FIELDS) {
    const n = normalize(fieldText(doc, key));
    fields[key] = { n, c: compact(n) };
  }
  return fields;
}

function countOccurrences(hay, needle, cap = 20) {
  let count = 0;
  let i = hay.indexOf(needle);
  while (i !== -1 && count < cap) {
    count++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return count;
}

function isWordStart(hay, i) {
  return i === 0 || !/[a-z0-9]/.test(hay[i - 1]);
}

function scoreTerm(fields, term) {
  const cterm = compact(term);
  let score = 0;
  for (const { key, weight } of FIELDS) {
    const f = fields[key];
    const i = f.n.indexOf(term);
    if (i !== -1) {
      let s = weight * (1 + Math.log2(countOccurrences(f.n, term)));
      if (isWordStart(f.n, i)) s *= 1.5;
      if (key === 'title' && f.n === term) s *= 2;
      score += s;
    } else if (cterm.length >= 2 && f.c.includes(cterm)) {
      score += weight * 0.8;
    }
  }
  return score;
}

/**
 * Returns [{ doc, score }] for docs matching every term, best first.
 * An empty query returns all docs (score 0) in their given order.
 */
export function search(docs, query) {
  const terms = tokenize(query);
  if (terms.length === 0) return docs.map((doc) => ({ doc, score: 0 }));
  const results = [];
  for (const doc of docs) {
    const fields = prepare(doc);
    let total = 0;
    let ok = true;
    for (const term of terms) {
      const s = scoreTerm(fields, term);
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) results.push({ doc, score: total });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Finds a short excerpt of `text` around the first matched term.
 * Returns [{ text, match }] segments for safe rendering, or null if no match.
 */
export function snippet(text, query, radius = 70) {
  const terms = tokenize(query);
  if (!text || terms.length === 0) return null;
  const lower = normalize(text);
  // normalize() can change string length (collapsed whitespace, stripped
  // accents), so work on the normalized text for both matching and display.
  let first = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (first === -1 || i < first)) first = i;
  }
  if (first === -1) return null;
  const display = String(text).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const start = Math.max(0, first - radius);
  const end = Math.min(display.length, first + radius * 2);
  const excerpt = display.slice(start, end);
  const lowerExcerpt = lower.slice(start, end);
  return highlight(excerpt, lowerExcerpt, terms, start > 0, end < display.length);
}

/** Splits `value` into [{ text, match }] segments for the given query terms. */
export function highlightText(value, query) {
  const terms = tokenize(query);
  const display = String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  return highlight(display, normalize(value), terms, false, false);
}

function highlight(display, lower, terms, leadingEllipsis, trailingEllipsis) {
  const marks = new Array(display.length).fill(false);
  for (const t of terms) {
    let i = lower.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length && k < marks.length; k++) marks[k] = true;
      i = lower.indexOf(t, i + t.length);
    }
  }
  const segments = [];
  if (leadingEllipsis) segments.push({ text: '… ', match: false });
  let cur = '';
  let curMatch = marks[0] ?? false;
  for (let i = 0; i < display.length; i++) {
    if (marks[i] !== curMatch) {
      if (cur) segments.push({ text: cur, match: curMatch });
      cur = '';
      curMatch = marks[i];
    }
    cur += display[i];
  }
  if (cur) segments.push({ text: cur, match: curMatch });
  if (trailingEllipsis) segments.push({ text: ' …', match: false });
  return segments;
}
