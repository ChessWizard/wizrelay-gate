import { describe, expect, it } from 'vitest';
import { holesIn, parseInline, parseMarkdown, safeHref } from '@/core/markdown/parse';
import type { Block, Inline } from '@/core/markdown/parse';
import { SAMPLE_PACKAGE_FILES } from '@/services/fixtures/details';

/** The text of a tree, so a test can assert what a reader sees without walking it. */
function flatten(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case 'text':
          return node.text;
        case 'code':
          return `\`${node.text}\``;
        case 'hole':
          return `{{${node.text}}}`;
        default:
          return flatten(node.children);
      }
    })
    .join('');
}

function kinds(blocks: Block[]): string[] {
  return blocks.map((block) => block.kind);
}

describe('reading a package document', () => {
  it('has nothing to show for an empty file', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('   \n\n  ')).toEqual([]);
  });

  it('reads headings at their own level', () => {
    const blocks = parseMarkdown('# Research\n\n## Problem\n\n#### Deep');
    expect(blocks.map((block) => (block.kind === 'heading' ? block.level : 0))).toEqual([1, 2, 4]);
    expect(blocks[1].kind === 'heading' && flatten(blocks[1].children)).toBe('Problem');
  });

  it('keeps the line breaks inside a paragraph', () => {
    const blocks = parseMarkdown('Given a tenant\nWhen a request arrives\nThen it answers 429');
    expect(kinds(blocks)).toEqual(['paragraph']);
    expect(blocks[0].kind === 'paragraph' && blocks[0].lines).toHaveLength(3);
  });

  it('marks the label a package line starts with', () => {
    const blocks = parseMarkdown('Verification: pytest tests/quota/test_quota.py');
    const line = blocks[0].kind === 'paragraph' ? blocks[0].lines[0] : null;
    expect(line?.label).toBe('Verification');
    expect(line && flatten(line.children)).toBe('pytest tests/quota/test_quota.py');
  });

  it('marks a label written in the hub language', () => {
    const blocks = parseMarkdown('Doğrulama: pytest -q\nBaşlık dilbilgisi: ## AC-1 Başlık');
    const lines = blocks[0].kind === 'paragraph' ? blocks[0].lines : [];
    expect(lines.map((line) => line.label)).toEqual(['Doğrulama', 'Başlık dilbilgisi']);
  });

  it('does not mistake a sentence for a label', () => {
    const blocks = parseMarkdown('Tenants can exhaust shared capacity; one tenant degrades it.');
    expect(blocks[0].kind === 'paragraph' && blocks[0].lines[0].label).toBeNull();
  });

  it('reads a plan as checked and unchecked steps', () => {
    const blocks = parseMarkdown('- [x] 1. Add the field\n- [ ] 2. Expose it\n- plain item');
    const list = blocks[0];
    expect(list.kind).toBe('list');
    expect(list.kind === 'list' && list.items.map((item) => item.checked)).toEqual([
      true,
      false,
      null,
    ]);
  });

  it('reads a nested list as a list inside its item', () => {
    const blocks = parseMarkdown('- outer\n  - inner one\n  - inner two\n- second');
    const list = blocks[0];
    expect(list.kind === 'list' && list.items).toHaveLength(2);
    const nested = list.kind === 'list' ? list.items[0].blocks : [];
    expect(kinds(nested)).toEqual(['paragraph', 'list']);
  });

  it('keeps an ordered list numbered from where it starts', () => {
    const blocks = parseMarkdown('3. third\n4. fourth');
    expect(blocks[0].kind === 'list' && blocks[0].ordered).toBe(true);
    expect(blocks[0].kind === 'list' && blocks[0].start).toBe(3);
  });

  it('reads a fenced block with its language and leaves the inside alone', () => {
    const blocks = parseMarkdown('```python\nif x:  # **not bold**\n    pass\n```');
    expect(blocks[0]).toEqual({
      kind: 'code',
      language: 'python',
      text: 'if x:  # **not bold**\n    pass',
    });
  });

  it('closes an unterminated fence at the end of the file', () => {
    const blocks = parseMarkdown('```\nno closing fence');
    expect(blocks[0]).toEqual({ kind: 'code', language: null, text: 'no closing fence' });
  });

  it('reads a table with its alignments', () => {
    const blocks = parseMarkdown('| id | result |\n| --- | ---: |\n| AC-1 | PASS |\n| AC-2 | FAIL |');
    const table = blocks[0];
    expect(table.kind).toBe('table');
    if (table.kind !== 'table') return;
    expect(table.align).toEqual(['left', 'right']);
    expect(table.head.map(flatten)).toEqual(['id', 'result']);
    expect(table.rows.map((row) => row.map(flatten))).toEqual([
      ['AC-1', 'PASS'],
      ['AC-2', 'FAIL'],
    ]);
  });

  it('reads a quote, and stops at the heading after it', () => {
    const blocks = parseMarkdown('> a note\n> over two lines\n\n# After');
    expect(kinds(blocks)).toEqual(['quote', 'heading']);
  });

  it('reads a rule', () => {
    expect(kinds(parseMarkdown('above\n\n---\n\nbelow'))).toEqual(['paragraph', 'rule', 'paragraph']);
  });
});

describe('reading what is inside a line', () => {
  it('reads a code span', () => {
    expect(parseInline('see `app/api/middleware.py:31` for it')).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'code', text: 'app/api/middleware.py:31' },
      { kind: 'text', text: ' for it' },
    ]);
  });

  it('reads a hole, which is what the gates count', () => {
    expect(parseInline('the frontend {{shows what?}} here')).toEqual([
      { kind: 'text', text: 'the frontend ' },
      { kind: 'hole', text: 'shows what?' },
      { kind: 'text', text: ' here' },
    ]);
  });

  it('does not find emphasis in a glob, because code is read first', () => {
    const nodes = parseInline('The backend owns `app/quota/**` and `tests/quota/**`.');
    expect(nodes.some((node) => node.kind === 'strong' || node.kind === 'em')).toBe(false);
    expect(flatten(nodes)).toBe('The backend owns `app/quota/**` and `tests/quota/**`.');
  });

  it('does not pair the stars of two bare globs', () => {
    const nodes = parseInline('app/quota/** and app/billing/** are different');
    expect(nodes.every((node) => node.kind === 'text')).toBe(true);
  });

  it('reads emphasis', () => {
    expect(parseInline('**bold** and *italic* and ~~gone~~')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'bold' }] },
      { kind: 'text', text: ' and ' },
      { kind: 'em', children: [{ kind: 'text', text: 'italic' }] },
      { kind: 'text', text: ' and ' },
      { kind: 'strike', children: [{ kind: 'text', text: 'gone' }] },
    ]);
  });

  it('leaves an underscored name alone', () => {
    expect(parseInline('schema_version_one')).toEqual([
      { kind: 'text', text: 'schema_version_one' },
    ]);
  });

  it('reads a link, and says whether it leaves the panel', () => {
    expect(parseInline('[the task](https://app.clickup.com/t/86c1abcd)')).toEqual([
      {
        kind: 'link',
        href: 'https://app.clickup.com/t/86c1abcd',
        external: true,
        children: [{ kind: 'text', text: 'the task' }],
      },
    ]);
    const internal = parseInline('[the board](/board)');
    expect(internal[0].kind === 'link' && internal[0].external).toBe(false);
  });

  it('reads a bare URL as a link', () => {
    const nodes = parseInline('see https://example.com/a, then stop');
    expect(nodes[1]).toEqual({
      kind: 'link',
      href: 'https://example.com/a',
      external: true,
      children: [{ kind: 'text', text: 'https://example.com/a' }],
    });
  });

  it('refuses a link the panel will not follow, and shows the text instead', () => {
    const nodes = parseInline('[click](javascript:alert(1))');
    expect(nodes.every((node) => node.kind === 'text')).toBe(true);
    expect(flatten(nodes)).toBe('[click](javascript:alert(1))');
  });

  it('judges a href on its scheme', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com');
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeHref('/board')).toBe('/board');
    expect(safeHref('#AC-1')).toBe('#AC-1');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,<script>')).toBeNull();
    expect(safeHref('vbscript:x')).toBeNull();
    expect(safeHref('')).toBeNull();
  });

  it('never hands markup through, whatever the file says', () => {
    const nodes = parseInline('<img src=x onerror="alert(1)"> and <b>bold</b>');
    expect(nodes.every((node) => node.kind === 'text')).toBe(true);
    expect(flatten(nodes)).toContain('<img src=x');
  });
});

describe('the bundled package', () => {
  it('reads every sample file without losing its text', () => {
    for (const file of SAMPLE_PACKAGE_FILES.filter((entry) => entry.path.endsWith('.md'))) {
      const blocks = parseMarkdown(file.body);
      expect(blocks.length, file.path).toBeGreaterThan(0);
    }
  });

  it('counts a hole inside a code span, because the gate does', () => {
    const blocks = parseMarkdown('Empty when `${{ vars.X }}` is undefined.');
    expect(holesIn(blocks)).toEqual(['vars.X']);
  });

  it('finds the hole the critic flagged in contracts.md', () => {
    const contracts = SAMPLE_PACKAGE_FILES.find((file) => file.path === 'contracts.md');
    expect(holesIn(parseMarkdown(contracts?.body ?? ''))).toEqual(['shows what?']);
  });

  it('reads the plan steps as a checklist', () => {
    const plan = SAMPLE_PACKAGE_FILES.find((file) => file.path === 'plan.md');
    const blocks = parseMarkdown(plan?.body ?? '');
    const list = blocks.find((block) => block.kind === 'list');
    expect(list?.kind === 'list' && list.items.filter((item) => item.checked === true)).toHaveLength(
      4,
    );
    expect(
      list?.kind === 'list' && list.items.filter((item) => item.checked === false),
    ).toHaveLength(3);
  });
});
