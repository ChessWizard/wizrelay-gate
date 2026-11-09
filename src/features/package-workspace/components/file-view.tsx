'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Segmented } from '@/shared/ui/controls';
import { Icon } from '@/shared/ui/icons';
import { JsonView } from '@/shared/ui/json-view';
import { Markdown } from '@/shared/ui/markdown';
import { Banner, Button, Row, Stack } from '@/shared/ui/primitives';
import { editWithClaude, savePackageFile } from '../actions';

/**
 * One package file, shown the way it is meant to be read.
 *
 * The readable view is the default because that is what the file is for — a document a
 * researcher wrote for a developer to read. The source view stays one click away, and it
 * is the exact bytes on disk: the note under this panel promises that edits here land in
 * the package, so there has to be a view where what you see is what is written.
 */
export function FileView({
  path,
  body,
  bytes,
  relayId,
  role,
  canEdit,
  canAsk,
}: {
  path: string;
  body: string;
  /** The size on disk. A file too large to read is not loaded, so `body` comes empty. */
  bytes: number;
  relayId: string;
  role?: string;
  /** This person owns this half of the package, and the file is one a tool does not write. */
  canEdit: boolean;
  /** Claude Code is available, so the gate can be handed an instruction. */
  canAsk: boolean;
}) {
  const t = useTranslator();
  const [view, setView] = useState<'read' | 'source' | 'edit'>('read');
  const [draft, setDraft] = useState(body);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [asking, startAsk] = useTransition();
  const router = useRouter();

  // The file on screen can change under the editor — another tab, a gate that just wrote
  // it. Keying the draft to the body means switching files starts from what is on disk
  // rather than from what was being typed into the previous one.
  const [keyed, setKeyed] = useState(body);
  if (keyed !== body && draft === keyed) {
    setKeyed(body);
    setDraft(body);
  }

  const dirty = draft !== body;

  const save = () =>
    startSave(async () => {
      setError(null);
      const result = await savePackageFile({ relayId, role, path, body: draft });
      if (result.ok) {
        setSaved(path);
        router.refresh();
      } else {
        setError(result.errorKey ?? 'error.commandFailed');
      }
    });

  const ask = () =>
    startAsk(async () => {
      setError(null);
      const result = await editWithClaude({ relayId, role, path, instruction });
      if (result.ok) {
        setInstruction('');
        router.push(`/relay/${relayId}/gate/research/console${role ? `?role=${role}` : ''}`);
      } else {
        setError(result.errorKey ?? 'error.commandFailed');
      }
    });

  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const copied = copiedPath === path;

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopiedPath(null), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const readable = path.endsWith('.md') || path.endsWith('.json');
  const json = path.endsWith('.json');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedPath(path);
    } catch {
    }
  };

  if (!body) {
    return (
      <Banner
        tone="info"
        inline
        title={bytes > 0 ? t('package.tooLarge') : t('package.emptyFile')}
      />
    );
  }

  return (
    <Stack gap={8}>
      <Row wrap gap={8} className="file-bar">
        {readable ? (
          <Segmented
            label={t('package.viewLabel')}
            active={view}
            onSelect={(id) => setView(id as 'read' | 'source' | 'edit')}
            options={[
              { id: 'read', label: t('package.viewRead') },
              { id: 'source', label: t('package.viewSource') },
              ...(canEdit ? [{ id: 'edit', label: t('package.edit') }] : []),
            ]}
          />
        ) : null}
        {dirty ? <span className="chip s-waiting">{t('package.unsaved')}</span> : null}
        {saved === path && !dirty ? (
          <span className="chip s-passed">
            <Icon name="check" />
            {t('package.saved')}
          </span>
        ) : null}
        <span className="grow" />
        <button type="button" className="file-copy" onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} />
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </Row>

      <div className="file-body">
        {view === 'read' && json ? <JsonView text={body} /> : null}
        {view === 'read' && readable && !json ? (
          <Markdown source={body} holeTitle={t('package.holeTitle')} />
        ) : null}
        {view === 'edit' && canEdit ? (
          <textarea
            className="file-editor mono"
            value={draft}
            spellCheck={false}
            aria-label={path}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}
        {view === 'source' || (!readable && view !== 'edit') ? (
          <pre className="file-source">{body}</pre>
        ) : null}
      </div>

      {error ? <Banner tone="error" inline title={t(error as 'error.forbidden')} /> : null}

      {view === 'edit' && canEdit ? (
        <Row wrap gap={10}>
          <Button variant="primary" icon="check" disabled={saving || !dirty} onClick={save}>
            {t('package.save')}
          </Button>
          <Button variant="ghost" disabled={saving || !dirty} onClick={() => setDraft(body)}>
            {t('package.discard')}
          </Button>
          <span className="xs t3">{t('package.editHelp')}</span>
        </Row>
      ) : null}

      {canAsk && canEdit ? (
        <div className="ask-claude">
          <label className="label" htmlFor={`ask-${path}`}>
            {t('package.askClaude')}
          </label>
          <Row wrap gap={8}>
            <input
              id={`ask-${path}`}
              className="input grow"
              value={instruction}
              placeholder={t('package.askClaudePlaceholder')}
              onChange={(event) => setInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && instruction.trim()) ask();
              }}
            />
            <Button icon="play" disabled={asking || !instruction.trim()} onClick={ask}>
              {t('package.askClaudeSend')}
            </Button>
          </Row>
          <span className="xs t3">{t('package.askClaudeHelp')}</span>
        </div>
      ) : (
        <span className="xs t3">{t('package.editorHint')}</span>
      )}
    </Stack>
  );
}
