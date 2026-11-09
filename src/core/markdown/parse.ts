/**
 * A Markdown reader for the files a research package is made of.
 *
 * A package is Markdown and JSON on disk, and the panel used to print it into a `<pre>`.
 * That is the file, but it is not the document: a reader cannot see the headings, the
 * checked plan steps or the acceptance table, and the one thing they most need to see —
 * an unfilled `{{placeholder}}` — looks like ordinary prose.
 *
 * So this turns the text into a tree, and the UI draws React elements from it. No HTML is
 * produced here and none is accepted: a package comes out of a git repository that many
 * people write to, so there is no safe way to hand its raw markup to a browser. Anything
 * this reader does not understand stays text and is shown as text.
 *
 * It is deliberately a reader for *these* files rather than a conforming CommonMark
 * implementation. Two decisions are worth knowing:
 *
 *   - A single newline inside a paragraph is kept. CommonMark folds soft breaks into
 *     spaces, which would run `Given` / `When` / `Then` together into one sentence and
 *     destroy the shape every acceptance file is written in.
 *   - Code spans are read before emphasis. A package scope is full of globs like
 *     `app/quota/**`, and reading emphasis first would pair the stars of two separate
 *     globs and bold the text between them.
 *
 * Unsupported, and left as plain text on purpose: reference links, footnotes, setext
 * headings, HTML blocks, and backslash escapes.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  /** `{{like this}}` — a hole the research has not filled in. The gates count these. */
  | { kind: 'hole'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'strike'; children: Inline[] }
  | { kind: 'link'; href: string; external: boolean; children: Inline[] };

export type Cell = Inline[];

/**
 * One source line of a paragraph.
 *
 * `label` is the `Given:` / `Verification:` / `Status:` prefix that package files lean on
 * instead of tables. Marking it lets the UI set it apart, which is the whole reason these
 * files are written that way.
 */
export interface Line {
  label: string | null;
  children: Inline[];
}

export interface Item {
  /** `null` when the item is not a checkbox; a plan step is always one. */
  checked: boolean | null;
  blocks: Block[];
}

export type Align = 'left' | 'right' | 'center';

export type Block =
  | { kind: 'heading'; level: number; children: Inline[] }
  | { kind: 'paragraph'; lines: Line[] }
  | { kind: 'code'; language: string | null; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: Item[] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'table'; align: Align[]; head: Cell[]; rows: Cell[][] }
  | { kind: 'rule' };

const SAFE_HREF = /^(?:https?:\/\/|mailto:|\/|\.\/|#)/i;

/**
 * The link target, or `null` when it is not one we will follow.
 *
 * Only absolute http(s), mailto, and in-document references pass. `javascript:` and every
 * other scheme is refused, and the text is then shown as text — the reader still sees what
 * the file says, and nothing in a package can make the panel navigate somewhere odd.
 */
export function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || /[\s<>]/.test(trimmed)) return null;
  return SAFE_HREF.test(trimmed) ? trimmed : null;
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function text(value: string): Inline {
  return { kind: 'text', text: value };
}

/**
 * Rewrite the text inside a node list with one pattern.
 *
 * Code spans and holes are opaque — nothing inside them is markup — so they are handed
 * back untouched. Everything else is walked into, which is what lets a later pass find
 * emphasis inside a link label an earlier pass produced.
 *
 * `make` returning `null` means "this match is not really one": the pattern moves on by a
 * character and the text stays text.
 */
function pass(
  nodes: Inline[],
  pattern: RegExp,
  make: (match: RegExpExecArray) => Inline | null,
): Inline[] {
  const out: Inline[] = [];

  for (const node of nodes) {
    if (node.kind === 'code' || node.kind === 'hole') {
      out.push(node);
      continue;
    }

    if (node.kind === 'strong' || node.kind === 'em' || node.kind === 'strike') {
      out.push({ kind: node.kind, children: pass(node.children, pattern, make) });
      continue;
    }

    if (node.kind === 'link') {
      out.push({ ...node, children: pass(node.children, pattern, make) });
      continue;
    }

    const source = node.text;
    const regex = new RegExp(pattern.source, pattern.flags);
    let at = 0;
    let match = regex.exec(source);

    while (match) {
      const made = make(match);
      if (made) {
        if (match.index > at) out.push(text(source.slice(at, match.index)));
        out.push(made);
        at = match.index + match[0].length;
        regex.lastIndex = at;
      } else {
        regex.lastIndex = match.index + 1;
      }
      match = regex.exec(source);
    }

    if (at < source.length) out.push(text(source.slice(at)));
  }

  return out;
}

/** Backtick spans and `{{holes}}`: read first, because they suppress everything inside. */
const OPAQUE = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)|`([^`]*)`|\{\{([^{}]*)\}\}/g;
const LINK = /(!?)\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+"[^"]*")?\s*\)/g;
const STRONG = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g;
const STRIKE = /~~(?=\S)([\s\S]*?\S)~~/g;
const EM = /(\*|_)(?=[^\s*_])([^*_]*?[^\s*_])\1/g;
const AUTOLINK = /https?:\/\/[^\s<>()[\]]*[^\s<>()[\].,;:!?'"]/g;

const WORD = /[A-Za-z0-9_]/;

export function parseInline(source: string): Inline[] {
  let nodes: Inline[] = source ? [text(source)] : [];

  nodes = pass(nodes, OPAQUE, (match) => {
    if (match[2] !== undefined) return { kind: 'code', text: match[2].trim() };
    if (match[3] !== undefined) return { kind: 'code', text: match[3].trim() };
    return { kind: 'hole', text: (match[4] ?? '').trim() };
  });

  nodes = pass(nodes, LINK, (match) => {
    const href = safeHref(match[3]);

    if (!href) return null;
    const label = match[2] || match[3];
    return { kind: 'link', href, external: isExternal(href), children: [text(label)] };
  });

  nodes = pass(nodes, STRONG, (match) => ({ kind: 'strong', children: [text(match[2])] }));
  nodes = pass(nodes, STRIKE, (match) => ({ kind: 'strike', children: [text(match[1])] }));

  nodes = pass(nodes, EM, (match) => {
    const before = match.index > 0 ? match.input[match.index - 1] : '';
    const after = match.input[match.index + match[0].length] ?? '';
    if (WORD.test(before) || WORD.test(after)) return null;
    return { kind: 'em', children: [text(match[2])] };
  });

  nodes = pass(nodes, AUTOLINK, (match) => ({
    kind: 'link',
    href: match[0],
    external: true,
    children: [text(match[0])],
  }));

  return nodes;
}

/**
 * `Verification: pytest …` — a label, not a sentence that happens to hold a colon.
 *
 * Any letter, not just an ASCII one: these packages are written in the language of the
 * team that owns the hub, and `Doğrulama:` is the same label as `Verification:`.
 */
const LABEL = /^(\p{Lu}\p{L}[\p{L} ]{0,22}):(?:\s+|$)/u;

function lineOf(raw: string): Line {
  const match = LABEL.exec(raw);
  if (!match) return { label: null, children: parseInline(raw) };
  return { label: match[1], children: parseInline(raw.slice(match[0].length)) };
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE = /^ {0,3}>/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const CHECKBOX = /^\[([ xX])\]\s+/;

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    ITEM.test(line)
  );
}

function isDelimiterRow(line: string | undefined): boolean {
  if (!line || !line.includes('-')) return false;
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((part) => part.trim());
}

function alignmentsOf(line: string): Align[] {
  return splitRow(line).map((part) => {
    if (part.startsWith(':') && part.endsWith(':')) return 'center';
    if (part.endsWith(':')) return 'right';
    return 'left';
  });
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * One list, and the line after it.
 *
 * An item owns every following line indented past its marker, so a nested list and a
 * fenced block inside an item are read by parsing that item's own text from the start.
 */
function parseList(lines: string[], from: number): [Block, number] {
  const first = ITEM.exec(lines[from]) as RegExpExecArray;
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const start = ordered ? Number.parseInt(first[2], 10) : 1;
  const chunks: string[][] = [];
  let index = from;

  while (index < lines.length) {
    const line = lines[index];
    const item = ITEM.exec(line);

    if (item && item[1].length <= indent) {
      if (item[1].length < indent || ordered !== /\d/.test(item[2])) break;
      chunks.push([item[3]]);
      index += 1;
      continue;
    }

    if (!line.trim()) {
      const next = lines[index + 1];
      const continues = Boolean(next?.trim()) && (leadingSpaces(next) > indent || ITEM.test(next));
      if (!continues || chunks.length === 0) break;
      chunks[chunks.length - 1].push('');
      index += 1;
      continue;
    }

    if (chunks.length === 0) break;
    chunks[chunks.length - 1].push(line.slice(Math.min(leadingSpaces(line), indent + 2)));
    index += 1;
  }

  const items: Item[] = chunks.map((chunk) => {
    const body = chunk.join('\n');
    const box = CHECKBOX.exec(body);
    return {
      checked: box ? box[1] !== ' ' : null,
      blocks: parseBlocks((box ? body.slice(box[0].length) : body).split('\n')),
    };
  });

  return [{ kind: 'list', ordered, start, items }, index];
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const closing = new RegExp(`^ {0,3}\\${marker}{${fence[1].length},}\\s*$`);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !closing.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: 'code', language: fence[2] || null, text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        children: parseInline(heading[2]),
      });
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length && lines[index].trim()) {
        if (!QUOTE.test(lines[index]) && (body.length === 0 || startsBlock(lines[index]))) break;
        body.push(lines[index].replace(/^ {0,3}>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', blocks: parseBlocks(body) });
      continue;
    }

    if (line.includes('|') && isDelimiterRow(lines[index + 1])) {
      const head = splitRow(line).map((cell) => parseInline(cell));
      const align = alignmentsOf(lines[index + 1]);
      index += 2;
      const rows: Cell[][] = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(splitRow(lines[index]).map((cell) => parseInline(cell)));
        index += 1;
      }
      blocks.push({ kind: 'table', align, head, rows });
      continue;
    }

    if (ITEM.test(line)) {
      const [list, next] = parseList(lines, index);
      blocks.push(list);
      index = next;
      continue;
    }

    const paragraph: Line[] = [lineOf(line.trim())];
    index += 1;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) {
      paragraph.push(lineOf(lines[index].trim()));
      index += 1;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }

  return blocks;
}

/** Read a Markdown document. Never throws: anything unrecognised comes back as text. */
export function parseMarkdown(source: string): Block[] {
  if (!source.trim()) return [];
  return parseBlocks(source.replace(/\r\n?/g, '\n').split('\n'));
}

/**
 * The holes in a document.
 *
 * Inside a code span too. Emphasis stops at a backtick because a glob is not italics, but
 * `wizrelay hub validate` reads the file as plain text and refuses the package over a
 * `{{…}}` wherever it sits. Counting them any other way would tell a researcher the
 * package is ready for a gate that is about to turn it back.
 */
const HOLE_IN_CODE = /\{\{([^{}]{0,200})\}\}/g;

export function holesIn(blocks: Block[]): string[] {
  const found: string[] = [];

  const inlines = (nodes: Inline[]): void => {
    for (const node of nodes) {
      if (node.kind === 'hole') {
        found.push(node.text);
      } else if (node.kind === 'code') {
        HOLE_IN_CODE.lastIndex = 0;
        let match = HOLE_IN_CODE.exec(node.text);
        while (match) {
          found.push(match[1].trim());
          match = HOLE_IN_CODE.exec(node.text);
        }
      } else if (node.kind !== 'text') {
        inlines(node.children);
      }
    }
  };

  const walk = (list: Block[]): void => {
    for (const block of list) {
      switch (block.kind) {
        case 'heading':
          inlines(block.children);
          break;
        case 'paragraph':
          for (const line of block.lines) inlines(line.children);
          break;
        case 'list':
          for (const item of block.items) walk(item.blocks);
          break;
        case 'quote':
          walk(block.blocks);
          break;
        case 'table':
          for (const cell of block.head) inlines(cell);
          for (const row of block.rows) for (const cell of row) inlines(cell);
          break;
        default:
          break;
      }
    }
  };

  walk(blocks);
  return found;
}
