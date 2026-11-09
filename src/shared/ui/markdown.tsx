import type { ReactNode } from 'react';
import { parseMarkdown } from '@/core/markdown/parse';
import type { Block, Cell, Inline, Line } from '@/core/markdown/parse';
import { Icon } from './icons';

/**
 * A package document, drawn.
 *
 * Every node is a React element built from the reader's tree. Nothing is injected as HTML,
 * so a package can contain whatever its authors push to the hub and the worst it can do is
 * show its own angle brackets.
 *
 * The one thing drawn louder than the rest is a `{{hole}}`: it is the signal the research
 * is not finished, the gates count it, and in a wall of grey text nobody sees it.
 */
export function Markdown({
  source,
  holeTitle,
  className,
}: {
  source: string;
  /** What a hole means, for its tooltip; the caller has the translator. */
  holeTitle?: string;
  className?: string;
}) {
  return (
    <div className={className ? `md ${className}` : 'md'}>
      {renderBlocks(parseMarkdown(source), holeTitle)}
    </div>
  );
}

/**
 * Mark the holes inside a code span.
 *
 * The reader treats a backtick span as opaque, which is right for emphasis — a glob is
 * not italics. A hole is the exception: `wizrelay hub validate` scans the file as text and
 * will refuse the package over a `{{…}}` wherever it sits, backticks included. So one is
 * shown wherever it is, or the panel would quietly promise a package the gate then fails.
 * The pattern is the plugin's own, so what is marked here is what the gate will catch.
 */
const HOLE_IN_CODE = /\{\{[^{}]{0,200}\}\}/g;

function markHoles(source: string, holeTitle?: string): ReactNode {
  if (!source.includes('{{')) return source;

  const parts: ReactNode[] = [];
  let at = 0;
  HOLE_IN_CODE.lastIndex = 0;
  let match = HOLE_IN_CODE.exec(source);

  while (match) {
    if (match.index > at) parts.push(source.slice(at, match.index));
    parts.push(
      <mark className="md-hole md-hole-plain" key={match.index} title={holeTitle}>
        {match[0]}
      </mark>,
    );
    at = match.index + match[0].length;
    match = HOLE_IN_CODE.exec(source);
  }

  if (at < source.length) parts.push(source.slice(at));
  return parts;
}

function renderInline(nodes: Inline[], holeTitle?: string): ReactNode {
  return nodes.map((node, index) => {
    const key = index;
    switch (node.kind) {
      case 'text':
        return node.text;
      case 'code':
        return (
          <code className="md-code" key={key}>
            {markHoles(node.text, holeTitle)}
          </code>
        );
      case 'hole':
        return (
          <mark className="md-hole" key={key} title={holeTitle}>
            {node.text}
          </mark>
        );
      case 'strong':
        return <strong key={key}>{renderInline(node.children, holeTitle)}</strong>;
      case 'em':
        return <em key={key}>{renderInline(node.children, holeTitle)}</em>;
      case 'strike':
        return <s key={key}>{renderInline(node.children, holeTitle)}</s>;
      case 'link':
        return (
          <a
            className="md-link"
            key={key}
            href={node.href}
            {...(node.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          >
            {renderInline(node.children, holeTitle)}
            {node.external ? <Icon name="external" /> : null}
          </a>
        );
      default:
        return null;
    }
  });
}

function renderLine(line: Line, holeTitle?: string): ReactNode {
  return (
    <>
      {line.label ? <span className="md-label">{line.label}</span> : null}
      {renderInline(line.children, holeTitle)}
    </>
  );
}

function renderCell(cell: Cell, holeTitle?: string): ReactNode {
  return renderInline(cell, holeTitle);
}

function renderBlocks(blocks: Block[], holeTitle?: string): ReactNode {
  return blocks.map((block, index) => {
    const key = index;

    switch (block.kind) {
      case 'heading': {
        const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2';
        return (
          <Tag className={`md-h md-h${block.level}`} key={key}>
            {renderInline(block.children, holeTitle)}
          </Tag>
        );
      }

      case 'paragraph':
        return (
          <p className="md-p" key={key}>
            {block.lines.map((line, at) => (
              <span className="md-line" key={at}>
                {renderLine(line, holeTitle)}
              </span>
            ))}
          </p>
        );

      case 'code':
        return (
          <div className="md-codeblock" key={key}>
            {block.language ? <span className="md-lang">{block.language}</span> : null}
            <pre>
              <code>{block.text}</code>
            </pre>
          </div>
        );

      case 'list': {
        const tasks = block.items.some((item) => item.checked !== null);
        const body = block.items.map((item, at) => (
          <li
            className={item.checked === null ? undefined : 'md-task'}
            data-done={item.checked ? 'true' : undefined}
            key={at}
          >
            {item.checked === null ? null : (
              <span className="md-box" aria-hidden="true">
                {item.checked ? <Icon name="check" /> : null}
              </span>
            )}
            <span className="md-item">{renderBlocks(item.blocks, holeTitle)}</span>
          </li>
        ));
        return block.ordered ? (
          <ol className="md-list" start={block.start} key={key}>
            {body}
          </ol>
        ) : (
          <ul className={tasks ? 'md-list md-checklist' : 'md-list'} key={key}>
            {body}
          </ul>
        );
      }

      case 'quote':
        return (
          <blockquote className="md-quote" key={key}>
            {renderBlocks(block.blocks, holeTitle)}
          </blockquote>
        );

      case 'table':
        return (
          <div className="md-tablewrap" key={key}>
            <table className="md-table">
              <thead>
                <tr>
                  {block.head.map((cell, at) => (
                    <th style={{ textAlign: block.align[at] ?? 'left' }} key={at}>
                      {renderCell(cell, holeTitle)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, at) => (
                  <tr key={at}>
                    {row.map((cell, column) => (
                      <td style={{ textAlign: block.align[column] ?? 'left' }} key={column}>
                        {renderCell(cell, holeTitle)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'rule':
        return <hr className="md-rule" key={key} />;

      default:
        return null;
    }
  });
}
