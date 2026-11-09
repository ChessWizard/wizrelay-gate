import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUERY,
  hasTerm,
  isEmptyQuery,
  matches,
  parseQuery,
  search,
  toggleTerm,
} from '@/core/search/query';
import { summarise } from '@/core/relay/derive';
import { sampleRelays } from '@/services/fixtures/relays';

const relays = sampleRelays().map((relay) => summarise(relay));
const quota = relays.find((relay) => relay.id === 'CU-86c1abcd');

describe('parsing a query', () => {
  it('treats bare words as free text', () => {
    expect(parseQuery('quota backend').text).toBe('quota backend');
    expect(parseQuery('quota backend').roles).toEqual([]);
  });

  it('reads the terms it knows', () => {
    const query = parseQuery('needs:me role:backend status:waiting gate:verify');
    expect(query.needsMe).toBe(true);
    expect(query.roles).toEqual(['backend']);
    expect(query.statuses).toEqual(['waiting']);
    expect(query.gates).toEqual(['verify']);
    expect(query.text).toBe('');
  });

  it('keeps a term it does not know as text, rather than dropping a typed word', () => {
    const query = parseQuery('http://localhost:3100');
    expect(query.text).toBe('http://localhost:3100');
  });

  it('ignores a value that is not a real status or gate', () => {
    const query = parseQuery('status:sideways gate:nowhere');
    expect(query.statuses).toEqual([]);
    expect(query.gates).toEqual([]);
  });

  it('is empty when nothing was typed', () => {
    expect(isEmptyQuery(parseQuery(''))).toBe(true);
    expect(isEmptyQuery(EMPTY_QUERY)).toBe(true);
    expect(isEmptyQuery(parseQuery('needs:me'))).toBe(false);
  });
});

describe('matching a relay', () => {
  it('finds a relay by id, whatever the case', () => {
    expect(quota).toBeDefined();
    expect(matches(quota!, parseQuery('cu-86C1ABCD'))).toBe(true);
  });

  it('finds a relay by a word in its title', () => {
    const word = quota!.title.split(' ')[0];
    expect(matches(quota!, parseQuery(word))).toBe(true);
  });

  it('folds the Turkish dotted I, so a Turkish title is searchable', () => {
    const relay = { ...quota!, title: 'İstek kotası' };
    expect(matches(relay, parseQuery('istek'))).toBe(true);
  });

  it('rejects a relay that matches nothing', () => {
    expect(matches(quota!, parseQuery('zzzzz'))).toBe(false);
  });

  it('matches a role term against the relay roles', () => {
    const role = quota!.roles[0];
    expect(matches(quota!, parseQuery(`role:${role}`))).toBe(true);
    expect(matches(quota!, parseQuery('role:nonexistent'))).toBe(false);
  });

  it('matches a status term against any gate, not only the relay status', () => {
    const status = quota!.research[0].status;
    expect(matches(quota!, parseQuery(`status:${status}`))).toBe(true);
  });

  it('needs:me keeps only relays with an open prompt', () => {
    const waiting = relays.filter((relay) => relay.waiting > 0);
    const found = search(relays, parseQuery('needs:me'));
    expect(found).toHaveLength(waiting.length);
    for (const relay of found) expect(relay.waiting).toBeGreaterThan(0);
  });

  it('requires every term, not any of them', () => {
    const query = parseQuery('role:backend zzzzz');
    expect(search(relays, query)).toHaveLength(0);
  });
});

describe('searching', () => {
  it('returns everything for an empty query, including the same array order', () => {
    expect(search(relays, parseQuery(''))).toEqual(relays);
  });

  it('never returns more than it was given', () => {
    expect(search(relays, parseQuery('needs:me')).length).toBeLessThanOrEqual(relays.length);
  });
});

describe('editing a query from a filter chip', () => {
  it('adds a term that is not there', () => {
    expect(toggleTerm('', 'needs', 'me')).toBe('needs:me');
    expect(toggleTerm('quota', 'status', 'failed')).toBe('quota status:failed');
  });

  it('removes a term that is, and leaves the rest alone', () => {
    expect(toggleTerm('quota needs:me status:failed', 'needs', 'me')).toBe('quota status:failed');
  });

  it('reports whether a term is present, ignoring case', () => {
    expect(hasTerm('Needs:ME', 'needs', 'me')).toBe(true);
    expect(hasTerm('status:failed', 'needs', 'me')).toBe(false);
  });
});
