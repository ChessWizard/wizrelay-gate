'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon } from './icons';
import type { IconName } from './icons';

export function Tabs({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: { id: string; label: ReactNode; count?: ReactNode }[];
  active: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={cn(active === tab.id && 'is-on')}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && tab.count !== '' ? <span className="tc">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({
  options,
  active,
  onSelect,
  label,
}: {
  options: { id: string; label: ReactNode }[];
  active: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={active === option.id}
          className={cn(active === option.id && 'is-on')}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FilterButton({
  children,
  icon,
  active,
  onClick,
}: {
  children: ReactNode;
  icon?: IconName;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={cn('filter', active && 'is-on')} onClick={onClick}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function CopyButton({
  value,
  label,
  copiedLabel,
  size = 'sm',
}: {
  value: string;
  label: string;
  copiedLabel: string;
  size?: 'sm' | 'default';
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cn('btn', size === 'sm' && 'btn-sm', 'btn-ghost')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1_600);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon name="copy" />
      {copied ? copiedLabel : label}
    </button>
  );
}

export function Disclosure({
  summary,
  children,
  open: initialOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className="stack" style={{ gap: '4px' }}>
      <button
        type="button"
        className="think"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="chevron" style={open ? { transform: 'rotate(90deg)' } : undefined} />
        {summary}
      </button>
      {open ? children : null}
    </div>
  );
}
