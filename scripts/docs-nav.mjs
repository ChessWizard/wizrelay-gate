#!/usr/bin/env node
/**
 * The documentation navigation generator.
 *
 * Each page owns its body; this script owns the breadcrumb, the language switch and the
 * previous/next trail, and it writes the index for each language. Run it after adding or
 * renaming a section — `tests/docs.test.ts` fails when a page's navigation is stale,
 * because stale navigation and wrong navigation are the same thing.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = join(ROOT, 'docs');
export const LANGUAGES = ['en', 'tr'];
export const DEFAULT_LANGUAGE = 'en';

export const SECTIONS = [
  { slug: '01-overview', en: 'Overview', tr: 'Genel bakış' },
  { slug: '02-install', en: 'Install and run', tr: 'Kurulum ve çalıştırma' },
  { slug: '03-initialize', en: 'Setting up the panel', tr: 'Paneli kurmak' },
  { slug: '04-gates', en: 'The nine task quality gates', tr: 'Dokuz task kalite kapısı' },
  { slug: '05-board', en: 'The relay board', tr: 'Relay panosu' },
  { slug: '06-run-and-console', en: 'The run and its console', tr: 'Çalıştırma ve konsolu' },
  { slug: '07-prompts', en: 'Gate prompts and approvals', tr: 'Kapı istemleri ve onaylar' },
  { slug: '08-routing', en: 'Model and effort routing', tr: 'Model ve effort yönlendirmesi' },
  { slug: '09-scope-and-audit', en: 'Scope protection and the audit', tr: 'Kapsam koruması ve denetim' },
  { slug: '10-verify', en: 'The verification report', tr: 'Doğrulama raporu' },
  { slug: '11-questions', en: 'The question loop', tr: 'Soru döngüsü' },
  { slug: '12-settings', en: 'Settings, connections and privacy', tr: 'Ayarlar, bağlantılar ve gizlilik' },
  { slug: '13-architecture', en: 'How the code is organised', tr: 'Kodun düzeni' },
  { slug: '14-development', en: 'Working on wizrelay-gate', tr: 'wizrelay-gate üzerinde çalışmak' },
  { slug: '15-troubleshooting', en: 'Troubleshooting', tr: 'Sorun giderme' },
  { slug: '16-faq', en: 'FAQ', tr: 'Sık sorulan sorular' },
  { slug: '17-docker', en: 'Running on a server', tr: 'Sunucuda çalıştırmak' },
  { slug: '18-activity', en: 'People, roles and activity', tr: 'Kişiler, roller ve etkinlik' },
  { slug: '19-agent', en: 'Running on your own machine', tr: 'Kendi makinende çalıştırmak' },
  { slug: '20-access', en: 'Who sees what', tr: 'Kim neyi görür' },
  { slug: '21-walkthrough', en: 'Setup, end to end', tr: 'Baştan sona kurulum' },
];

const LABEL = {
  en: { index: 'Documentation', previous: 'Previous', next: 'Next', other: 'Türkçe', home: 'wizrelay-gate' },
  tr: { index: 'Dokümantasyon', previous: 'Önceki', next: 'Sonraki', other: 'English', home: 'wizrelay-gate' },
};

const NAV_OPEN = '<!-- nav -->';
const NAV_CLOSE = '<!-- /nav -->';
const FOOT_OPEN = '<!-- foot -->';
const FOOT_CLOSE = '<!-- /foot -->';

const title = (section, language) => section[language];

function header(section, language) {
  const other = language === 'en' ? 'tr' : 'en';
  const labels = LABEL[language];
  return [
    NAV_OPEN,
    `[${labels.home}](../../README.md) · [${labels.index}](README.md) · [${LABEL[language].other}](../${other}/${section.slug}.md)`,
    NAV_CLOSE,
  ].join('\n');
}

function footer(index, language) {
  const labels = LABEL[language];
  const previous = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];
  const parts = [];
  if (previous) parts.push(`← ${labels.previous}: [${title(previous, language)}](${previous.slug}.md)`);
  parts.push(`[${labels.index}](README.md)`);
  if (next) parts.push(`${labels.next}: [${title(next, language)}](${next.slug}.md) →`);
  return [FOOT_OPEN, parts.join(' · '), FOOT_CLOSE].join('\n');
}

/** The body is everything between the generated blocks; the page owns it. */
export function bodyOf(text) {
  let body = text;
  const navEnd = body.indexOf(NAV_CLOSE);
  if (navEnd !== -1) body = body.slice(navEnd + NAV_CLOSE.length);
  const footStart = body.indexOf(FOOT_OPEN);
  if (footStart !== -1) body = body.slice(0, footStart);
  return body.trim();
}

export function renderFile(path, section, index, language) {
  const body = bodyOf(readFileSync(path, 'utf8'));
  return `${header(section, language)}\n\n${body}\n\n${footer(index, language)}\n`;
}

export function summaryOf(path) {
  const body = bodyOf(readFileSync(path, 'utf8'));
  const lines = body.split('\n');
  const headingAt = lines.findIndex((line) => line.startsWith('# '));
  for (const line of lines.slice(headingAt + 1)) {
    if (line.trim() && !line.startsWith('#')) return line.trim();
  }
  return '';
}

export function renderIndex(language) {
  const labels = LABEL[language];
  const other = language === 'en' ? 'tr' : 'en';
  const rows = SECTIONS.map((section, index) => {
    const path = join(DOCS, language, `${section.slug}.md`);
    const summary = existsSync(path) ? summaryOf(path) : '';
    return `| ${index + 1}. [${title(section, language)}](${section.slug}.md) | ${summary} |`;
  });
  return [
    NAV_OPEN,
    `[${labels.home}](../../README.md) · [${LABEL[language].other}](../${other}/README.md)`,
    NAV_CLOSE,
    '',
    `# ${labels.index}`,
    '',
    language === 'en'
      ? 'One guide, one file per section. Start at the overview; every page links to the next.'
      : 'Tek kılavuz, bölüm başına tek dosya. Genel bakışla başla; her sayfa bir sonrakine bağlanır.',
    '',
    `| ${language === 'en' ? 'Section' : 'Bölüm'} | ${language === 'en' ? 'What it covers' : 'Ne anlatıyor'} |`,
    '|---|---|',
    ...rows,
    '',
  ].join('\n');
}

export function run() {
  let written = 0;
  for (const language of LANGUAGES) {
    SECTIONS.forEach((section, index) => {
      const path = join(DOCS, language, `${section.slug}.md`);
      if (!existsSync(path)) {
        console.error(`missing: docs/${language}/${section.slug}.md`);
        process.exitCode = 1;
        return;
      }
      const rendered = renderFile(path, section, index, language);
      if (rendered !== readFileSync(path, 'utf8')) {
        writeFileSync(path, rendered, 'utf8');
        written += 1;
      }
    });
    const indexPath = join(DOCS, language, 'README.md');
    const index = renderIndex(language);
    if (!existsSync(indexPath) || index !== readFileSync(indexPath, 'utf8')) {
      writeFileSync(indexPath, index, 'utf8');
      written += 1;
    }
  }
  console.log(`docs navigation: ${written} file(s) updated`);
}

if (process.argv[1] && process.argv[1].endsWith('docs-nav.mjs')) run();
