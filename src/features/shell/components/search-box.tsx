'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from '@/shared/ui/icons';
import { Kbd } from '@/shared/ui/primitives';

/**
 * The panel's search box.
 *
 * It types into the URL rather than into component state: the list filters on the server,
 * so a search is a shareable address and the back button works. Typing is debounced
 * because every keystroke would otherwise re-render the whole list.
 *
 * Results land on the relay list, which has filters of its own. They used to narrow the
 * board in place, which gave a search no page to live on — nothing to narrow further, and
 * nothing to send to somebody else. On that list the navigation replaces, so typing does
 * not fill the history with keystrokes; from anywhere else it pushes, so the back button
 * returns where the person came from.
 */
export function SearchBox() {
  const t = useTranslator();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get('q') ?? '';

  const [value, setValue] = useState(fromUrl);
  const input = useRef<HTMLInputElement | null>(null);
  /** The last value this box sent, so an unrelated navigation does not overwrite typing. */
  const sent = useRef(fromUrl);

  useEffect(() => {
    if (fromUrl !== sent.current) {
      sent.current = fromUrl;
      setValue(fromUrl);
    }
  }, [fromUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (value === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = value;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set('q', value);
      else next.delete('q');
      const query = next.toString();

      const href = `/relays${query ? `?${query}` : ''}`;
      if (pathname === '/relays') router.replace(href, { scroll: false });
      else router.push(href);
    }, 260);
    return () => clearTimeout(timer);
  }, [params, pathname, router, value]);

  return (
    <div className="search" role="search">
      <Icon name="search" />
      <input
        ref={input}
        type="search"
        className="search-input"
        value={value}
        placeholder={t('top.search')}
        aria-label={t('top.search')}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setValue('');
            input.current?.blur();
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="search-clear"
          aria-label={t('search.clear')}
          onClick={() => {
            setValue('');
            input.current?.focus();
          }}
        >
          <Icon name="close" />
        </button>
      ) : (
        <Kbd>⌘K</Kbd>
      )}
    </div>
  );
}
