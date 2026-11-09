'use client';

import { useMemo, useState } from 'react';
import { safeHref } from '@/core/markdown/parse';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from './icons';
import { Banner } from './primitives';

/**
 * A JSON file, read rather than printed.
 *
 * `task.json` is the contract of a package — ids, roles, and a scope nested two levels
 * deep — and as one long string it is the least readable file in the package even though
 * it is the most important. So it is drawn as the structure it is: keys set apart from
 * values, values coloured by type, and every object foldable, because the way to read a
 * nested scope is to close the parts you are not looking at.
 *
 * A file that will not parse is still shown. A broken `task.json` is exactly when someone
 * needs to look at it, so the text comes through unchanged with a note above it.
 */
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** How deep to open on arrival: enough to see the shape, not enough to need scrolling. */
const OPEN_DEPTH = 2;

/** An array of plain values stays on one line while it is short enough to read there. */
const INLINE_WIDTH = 72;

export function JsonView({ text, openDepth = OPEN_DEPTH }: { text: string; openDepth?: number }) {
  const t = useTranslator();
  const [depth, setDepth] = useState(openDepth);
  const [generation, setGeneration] = useState(0);

  const parsed = useMemo<{ ok: true; value: Json } | { ok: false }>(() => {
    try {
      return { ok: true, value: JSON.parse(text) as Json };
    } catch {
      return { ok: false };
    }
  }, [text]);

  if (!parsed.ok) {
    return (
      <div className="stack" style={{ gap: '8px' }}>
        <Banner tone="warn" inline title={t('json.invalid')} />
        <pre className="out">{text}</pre>
      </div>
    );
  }

  const all = (next: number) => {
    setDepth(next);

    setGeneration((value) => value + 1);
  };

  const container = parsed.value !== null && typeof parsed.value === 'object';

  return (
    <div className="jv">
      {container ? (
        <div className="jv-bar">
          <button type="button" onClick={() => all(Number.MAX_SAFE_INTEGER)}>
            <Icon name="plus" />
            {t('json.expandAll')}
          </button>
          <button type="button" onClick={() => all(0)}>
            <Icon name="close" />
            {t('json.collapseAll')}
          </button>
        </div>
      ) : null}

      <div className="jv-tree" key={generation}>
        <Entry name={null} value={parsed.value} level={0} openDepth={depth} last />
      </div>
    </div>
  );
}

function Scalar({ value }: { value: null | boolean | number | string }) {
  if (value === null) return <span className="jv-null">null</span>;
  if (typeof value === 'boolean') return <span className="jv-bool">{String(value)}</span>;
  if (typeof value === 'number') return <span className="jv-num">{String(value)}</span>;

  const href = /^https?:\/\//i.test(value) ? safeHref(value) : null;
  return (
    <span className="jv-str">
      &quot;
      {href ? (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {value}
        </a>
      ) : (
        value
      )}
      &quot;
    </span>
  );
}

/** Roughly how wide the array would be on one line, quotes and separators included. */
function inlineWidthOf(values: Json[]): number {
  let width = 0;
  for (const value of values) width += String(value).length + 4;
  return width;
}

function Entry({
  name,
  value,
  level,
  openDepth,
  last,
}: {
  name: string | null;
  value: Json;
  level: number;
  openDepth: number;
  last: boolean;
}) {
  const t = useTranslator();
  const [open, setOpen] = useState(level < openDepth);

  const key = name === null ? null : <span className="jv-key">&quot;{name}&quot;: </span>;
  const comma = last ? null : <span className="jv-punct">,</span>;
  const pad = { paddingLeft: `${level * 14}px` };

  if (value === null || typeof value !== 'object') {
    return (
      <div className="jv-row" style={pad}>
        {key}
        <Scalar value={value} />
        {comma}
      </div>
    );
  }

  const array = Array.isArray(value);
  const entries: [string | null, Json][] = array
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);
  const [openBrace, closeBrace] = array ? ['[', ']'] : ['{', '}'];

  if (entries.length === 0) {
    return (
      <div className="jv-row" style={pad}>
        {key}
        <span className="jv-punct">
          {openBrace}
          {closeBrace}
        </span>
        {comma}
      </div>
    );
  }

  const plain =
    array && value.every((item) => item === null || typeof item !== 'object');
  if (plain && inlineWidthOf(value) <= INLINE_WIDTH) {
    return (
      <div className="jv-row" style={pad}>
        {key}
        <span className="jv-punct">{openBrace} </span>
        {value.map((item, index) => (
          <span key={index}>
            <Scalar value={item as null | boolean | number | string} />
            {index < value.length - 1 ? <span className="jv-punct">, </span> : null}
          </span>
        ))}
        <span className="jv-punct"> {closeBrace}</span>
        {comma}
      </div>
    );
  }

  const summary = array
    ? t('json.items', { count: entries.length })
    : t('json.keys', { count: entries.length });

  return (
    <>
      <div className="jv-row" style={pad}>
        <button
          type="button"
          className="jv-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value_) => !value_)}
        >
          <Icon name="chevron" />
        </button>
        {key}
        <span className="jv-punct">{openBrace}</span>
        {open ? null : (
          <>
            <button type="button" className="jv-count" onClick={() => setOpen(true)}>
              {summary}
            </button>
            <span className="jv-punct">{closeBrace}</span>
            {comma}
          </>
        )}
      </div>

      {open ? (
        <>
          {entries.map(([childName, childValue], index) => (
            <Entry
              key={childName ?? index}
              name={array ? null : childName}
              value={childValue}
              level={level + 1}
              openDepth={openDepth}
              last={index === entries.length - 1}
            />
          ))}
          <div className="jv-row" style={pad}>
            <span className="jv-punct">{closeBrace}</span>
            {comma}
          </div>
        </>
      ) : null}
    </>
  );
}
