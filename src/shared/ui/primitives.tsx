import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/shared/lib/cn';
import { Icon } from './icons';
import type { IconName } from './icons';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
type ButtonSize = 'default' | 'sm' | 'lg';

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'ghost' && 'btn-ghost',
    variant === 'danger' && 'btn-danger',
    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
}

export function Button({
  variant = 'default',
  size = 'default',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
}

export function LinkButton({
  href,
  variant = 'default',
  size = 'default',
  icon,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export function Row({
  children,
  className,
  spread,
  wrap,
  gap,
}: {
  children: ReactNode;
  className?: string;
  spread?: boolean;
  wrap?: boolean;
  gap?: number;
}) {
  return (
    <div
      className={cn('row', spread && 'spread', wrap && 'wrap', className)}
      style={gap === undefined ? undefined : { gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}

export function Stack({
  children,
  className,
  gap,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <div className={cn('stack', className)} style={gap === undefined ? undefined : { gap: `${gap}px` }}>
      {children}
    </div>
  );
}

export function Grow() {
  return <span className="grow" />;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('mono', className)}>{children}</span>;
}

export function Panel({
  title,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('panel', className)}>
      {title ? (
        <div className="panel-h">
          <h4>{title}</h4>
          {aside}
        </div>
      ) : null}
      {children ? <div className={cn('panel-b', bodyClassName)}>{children}</div> : null}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function SectionHeader({
  title,
  count,
  note,
  actions,
  spread = true,
  level = 2,
}: {
  title: ReactNode;
  count?: number | string;
  note?: ReactNode;
  actions?: ReactNode;
  spread?: boolean;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className={cn('section-h', spread && 'spread')}>
      <div className="row wrap" style={{ gap: '10px' }}>
        <Heading>{title}</Heading>
        {count !== undefined ? <span className="count-badge">{count}</span> : null}
        {note ? <span className="sm t3">{note}</span> : null}
      </div>
      {actions}
    </div>
  );
}

export function KeyValues({ items }: { items: { key: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="kv">
      {items.map((item, index) => (
        <div key={index} style={{ display: 'contents' }}>
          <dt>{item.key}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Hr() {
  return <div className="hr" />;
}

export function CommandBlock({
  command,
  exitCode,
  output,
}: {
  command: string;
  exitCode?: number;
  output?: string;
}) {
  return (
    <div className="stack" style={{ gap: '4px' }}>
      <div className="cmd">
        <span className="p">$</span>
        <code>{command}</code>
        {exitCode !== undefined ? (
          <span className={cn('exit chip', exitCode === 0 ? 's-passed' : 's-failed')}>
            exit {exitCode}
          </span>
        ) : null}
      </div>
      {output ? <div className="out">{output}</div> : null}
    </div>
  );
}

export function GlobChip({ pattern, kind }: { pattern: string; kind: 'allow' | 'deny' }) {
  return (
    <span className={cn('glob', kind === 'deny' && 'deny')}>
      <span className="gk">{kind}</span>
      {pattern}
    </span>
  );
}

export function OwnershipBadge({
  owner,
  label,
}: {
  owner: 'researcher' | 'developer';
  label: string;
}) {
  return (
    <span className={cn('own', owner === 'researcher' ? 'res' : 'dev')}>
      <Icon name={owner === 'researcher' ? 'lock' : 'user'} />
      {label}
    </span>
  );
}

export function VersionChip({ children, ahead }: { children: ReactNode; ahead?: boolean }) {
  return <span className={cn('vchip', ahead && 'is-ahead')}>{children}</span>;
}

export function Banner({
  tone,
  title,
  body,
  action,
  icon,
  inline,
  role = 'status',
}: {
  tone: 'info' | 'warn' | 'error' | 'success';
  title?: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  inline?: boolean;
  role?: 'status' | 'note' | 'alert';
}) {
  const toneClass = { info: 'b-info', warn: 'b-warn', error: 'b-error', success: 'b-success' }[tone];
  const toneIcon: IconName =
    icon ?? (tone === 'error' ? 'failed' : tone === 'warn' ? 'warned' : tone === 'success' ? 'passed' : 'relay');
  return (
    <div className={cn('banner', toneClass, inline && 'inline')} role={role}>
      <Icon name={toneIcon} className="bi" />
      <div className="grow stack" style={{ gap: '4px' }}>
        {title ? <span className="bt">{title}</span> : null}
        {body ? <span className="sm t2">{body}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
  illustration,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="empty" style={{ padding: '64px 24px' }}>
      {illustration}
      <span className="lg" style={{ color: 'var(--text-primary)' }}>
        {title}
      </span>
      {body ? (
        <span className="sm t3" style={{ maxWidth: '520px' }}>
          {body}
        </span>
      ) : null}
      {action}
    </div>
  );
}

export function Skeleton({ width, height = 14 }: { width?: number | string; height?: number }) {
  return <span className="skel" style={{ width: width ?? '100%', height: `${height}px` }} />;
}

export function Quoted({ source, children }: { source: string; children: ReactNode }) {
  return (
    <div className="quoted">
      <span className="qsrc">{source}</span>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Indeterminate({ width }: { width?: number }) {
  return <div className="indet" style={width ? { width: `${width}px` } : undefined} />;
}
