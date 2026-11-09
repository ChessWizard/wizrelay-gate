import { describe, expect, it } from 'vitest';
import { isGitHubUrl, orderBranches, parseRepoUrl } from '@/core/integrations/git-url';

/**
 * Deciding whether GitHub can be asked about a URL.
 *
 * Getting this wrong is not a cosmetic failure: it would send a request about somebody's
 * self-hosted GitLab repository, carrying their GitHub token, to api.github.com.
 */
describe('reading owner and repo out of a URL', () => {
  it('reads the forms people actually write', () => {
    const forms = [
      'https://github.com/acme/acme-hub.git',
      'https://github.com/acme/acme-hub',
      'git@github.com:acme/acme-hub.git',
      'ssh://git@github.com/acme/acme-hub.git',
    ];
    for (const url of forms) {
      expect(parseRepoUrl(url), url).toEqual({
        host: 'github.com',
        owner: 'acme',
        repo: 'acme-hub',
      });
    }
  });

  it('keeps the host it was given rather than assuming one', () => {
    expect(parseRepoUrl('git@git.internal:team/hub.git')?.host).toBe('git.internal');
    expect(parseRepoUrl('https://gitlab.com/team/hub')?.host).toBe('gitlab.com');
  });

  it('reads a repository nested under a group', () => {
    expect(parseRepoUrl('https://gitlab.com/team/sub/hub.git')).toEqual({
      host: 'gitlab.com',
      owner: 'sub',
      repo: 'hub',
    });
  });

  it('returns nothing for what is not a repository URL', () => {
    for (const bad of ['', '   ', 'not a url', 'https://github.com/', 'https://github.com/only']) {
      expect(parseRepoUrl(bad), bad).toBeNull();
    }
  });

  it('refuses a scheme git does not fetch over', () => {
    expect(parseRepoUrl('file:///srv/hub.git')).toBeNull();
    expect(parseRepoUrl('javascript:alert(1)//a/b')).toBeNull();
    expect(parseRepoUrl('nothost:owner/repo')).toBeNull();
  });
});

describe('an address somebody typed', () => {
  it('is accepted in the forms a person copies out of GitHub', () => {
    // The "Code" button offers HTTPS and SSH; both have to land on the same project.
    const https = parseRepoUrl('https://github.com/acme/api-service.git');
    const ssh = parseRepoUrl('git@github.com:acme/api-service.git');
    expect(https).toEqual(ssh);
    expect(`${https?.owner}/${https?.repo}`).toBe('acme/api-service');
  });

  it('refuses what a typo produces, so it cannot become a project', () => {
    for (const typo of ['github.com/acme', 'git@github.com', 'acme/hub']) {
      expect(parseRepoUrl(typo), typo).toBeNull();
    }
  });
});

describe('whether GitHub may be asked', () => {
  it('is true only for github.com', () => {
    expect(isGitHubUrl('https://github.com/team/hub.git')).toBe(true);
    expect(isGitHubUrl('git@github.com:team/hub.git')).toBe(true);
    expect(isGitHubUrl('https://gitlab.com/team/hub.git')).toBe(false);
    expect(isGitHubUrl('https://github.company.com/team/hub.git')).toBe(false);
    expect(isGitHubUrl('nonsense')).toBe(false);
  });
});

describe('the order branches are offered in', () => {
  it('puts main first, then master, then the rest alphabetically', () => {
    // The rest are ordered the way a person reads a list, not the way bytes sort.
    expect(orderBranches(['zz', 'master', 'CU-12', 'main', 'alpha'])).toEqual([
      'main',
      'master',
      'alpha',
      'CU-12',
      'zz',
    ]);
  });

  it('says each branch once', () => {
    expect(orderBranches(['main', 'main', 'dev'])).toEqual(['main', 'dev']);
  });
});
