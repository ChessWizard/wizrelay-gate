import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS, LANGUAGES, SECTIONS, bodyOf, renderFile, renderIndex } from '../scripts/docs-nav.mjs';

/**
 * The documentation is a deliverable, so it is tested like one: both languages carry the
 * same sections, every page has a body, the navigation is what the generator would write,
 * and no relative link points at a file that is not there.
 */
const INTERNAL_LINK = /\]\((?!https?:|mailto:|#)([^)\s]+)\)/g;

describe('the sections', () => {
  it.each(LANGUAGES)('%s has exactly the sections the generator lists', (language) => {
    const onDisk = readdirSync(join(DOCS, language))
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .map((name) => name.replace(/\.md$/, ''))
      .sort();
    expect(onDisk).toEqual(SECTIONS.map((section) => section.slug).sort());
  });

  it('gives every section a title in both languages', () => {
    for (const section of SECTIONS) {
      for (const language of LANGUAGES) {
        expect(section[language], section.slug).toBeTruthy();
      }
    }
  });
});

describe('every page', () => {
  const pages = LANGUAGES.flatMap((language) =>
    SECTIONS.map((section, index) => ({
      language,
      section,
      index,
      path: join(DOCS, language, `${section.slug}.md`),
    })),
  );

  it.each(pages.map((page) => [`${page.language}/${page.section.slug}`, page] as const))(
    '%s has current navigation',
    (_name, page) => {
      expect(readFileSync(page.path, 'utf8')).toBe(
        renderFile(page.path, page.section, page.index, page.language),
      );
    },
  );

  it.each(pages.map((page) => [`${page.language}/${page.section.slug}`, page] as const))(
    '%s opens with a heading and a summary line',
    (_name, page) => {
      const body = bodyOf(readFileSync(page.path, 'utf8'));
      expect(body.startsWith('# ')).toBe(true);
      const summary = body.split('\n').slice(1).find((line) => line.trim() && !line.startsWith('#'));
      expect(summary, 'a page with no summary gets an empty cell in the index').toBeTruthy();
    },
  );

  it('resolves every relative link', () => {
    const files = [
      ...pages.map((page) => page.path),
      ...LANGUAGES.map((language) => join(DOCS, language, 'README.md')),
      join(DOCS, 'README.md'),
      join(process.cwd(), 'README.md'),
      join(process.cwd(), 'README.tr.md'),
      join(process.cwd(), 'CLAUDE.md'),
    ];
    const broken: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(INTERNAL_LINK)) {
        const target = match[1].split('#')[0];
        if (!target || target.startsWith('/')) continue;
        const resolved = join(file, '..', target);
        if (!existsSync(resolved)) broken.push(`${file} → ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('the indexes', () => {
  it.each(LANGUAGES)('%s index is current', (language) => {
    expect(readFileSync(join(DOCS, language, 'README.md'), 'utf8')).toBe(renderIndex(language));
  });

  it('links the two languages to each other', () => {
    expect(readFileSync(join(DOCS, 'en', 'README.md'), 'utf8')).toContain('../tr/README.md');
    expect(readFileSync(join(DOCS, 'tr', 'README.md'), 'utf8')).toContain('../en/README.md');
    expect(readFileSync(join(process.cwd(), 'README.md'), 'utf8')).toContain('README.tr.md');
    expect(readFileSync(join(process.cwd(), 'README.tr.md'), 'utf8')).toContain('README.md');
  });
});
