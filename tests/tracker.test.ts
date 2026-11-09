import { describe, expect, it } from 'vitest';
import { trackerLabel, trackerUrl } from '@/core/tracker/link';

describe('the link back to a ticket', () => {
  it('uses the hub\'s own link whatever the tracker is', () => {
    expect(
      trackerUrl({ type: 'something-else', ref: 'X-1', url: 'https://tracker.example/X-1' }),
    ).toBe('https://tracker.example/X-1');
  });

  it('ignores a recorded link that is not a web address', () => {
    expect(trackerUrl({ type: 'jira', ref: 'ABC-1', url: 'not a url' })).toBeNull();
  });

  it('rebuilds a ClickUp link from the reference', () => {
    expect(trackerUrl({ type: 'clickup', ref: '86c1abcd' })).toBe(
      'https://app.clickup.com/t/86c1abcd',
    );
  });

  it('drops the CU- prefix the hub writes into relay ids', () => {
    expect(trackerUrl({ type: 'ClickUp', ref: 'CU-86c1abcd' })).toBe(
      'https://app.clickup.com/t/86c1abcd',
    );
  });

  it('rebuilds a GitHub issue link from owner/repo#number', () => {
    expect(trackerUrl({ type: 'github', ref: 'acme/api#42' })).toBe(
      'https://github.com/acme/api/issues/42',
    );
  });

  it('gives no link for a GitHub reference it cannot parse', () => {
    expect(trackerUrl({ type: 'github', ref: '42' })).toBeNull();
  });

  it('gives no link for a tracker whose URL cannot be rebuilt', () => {
    expect(trackerUrl({ type: 'jira', ref: 'ABC-123' })).toBeNull();
    expect(trackerUrl({ type: 'linear', ref: 'ENG-7' })).toBeNull();
  });

  it('gives no link when there is nothing to build from', () => {
    expect(trackerUrl(undefined)).toBeNull();
    expect(trackerUrl({ type: 'clickup', ref: '' })).toBeNull();
  });

  it('prints the reference whether or not it links anywhere', () => {
    expect(trackerLabel({ type: 'jira', ref: 'ABC-123' })).toBe('ABC-123');
    expect(trackerLabel(undefined)).toBe('');
  });
});
