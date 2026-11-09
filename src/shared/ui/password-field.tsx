'use client';

import { useId, useState } from 'react';
import { passwordChecks } from '@/core/auth/password-rule';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from './icons';

/**
 * A password field, everywhere one is typed.
 *
 * Two things were different in each of the three places a password was entered: whether
 * you could read what you had typed, and whether you were told the rule before or after
 * submitting. Both belong to the field, not to the page, so they live here and every
 * screen gets the same ones.
 *
 * The rule is `core/auth/password-rule`, the same array the server checks against. Showing
 * it while somebody types is not a second implementation — there is one list, and this
 * renders it.
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  /** Show the rule and tick it off as it is met. For setting a password, not for signing in. */
  rules,
  required = true,
  autoFocus,
}: {
  name: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  rules?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const t = useTranslator();
  const id = useId();
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState('');
  const checks = rules ? passwordChecks(value) : [];

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-with-action">
        <input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          className="input"
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="button"
          className="field-action"
          onClick={() => setShown((previous) => !previous)}
          aria-pressed={shown}
          aria-label={t(shown ? 'auth.hidePassword' : 'auth.showPassword')}
          title={t(shown ? 'auth.hidePassword' : 'auth.showPassword')}
        >
          <Icon name={shown ? 'eyeOff' : 'eye'} />
        </button>
      </div>

      {rules ? (
        <ul className="pw-rules">
          {checks.map((check) => (
            <li
              key={check.key}
              className={check.met ? 'is-met' : undefined}

              aria-hidden={value.length === 0 || undefined}
            >
              <Icon name={check.met ? 'passed' : 'dot'} />
              {t(check.key as 'auth.rule.length')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
