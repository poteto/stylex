/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ParityCase } from '../parity-corpus';
import type { ExpandResult } from '../types';

import { expandShorthand, lookupShorthand } from '../index';
import { PARITY_CORPUS } from '../parity-corpus';

/**
 * The corpus runner asserts STRUCTURAL invariants over every case in
 * both output modes -- never per-case hand-written expansions (the
 * def-level suites own those). The compact snapshot at the end pins
 * every output so any engine change diffs visibly.
 */

const MODES = ['minimal', 'spec'] as const;

const caseLabel = (entry: ParityCase): string => {
  const flags = [
    entry.allowImportant === true ? 'allowImportant' : null,
    entry.preferInline === true ? 'preferInline' : null,
  ].filter(Boolean);
  const flagText = flags.length > 0 ? ` [${flags.join(',')}]` : '';
  return `${entry.property}: ${JSON.stringify(entry.value)}${flagText}`;
};

const hasImportant = (entry: ParityCase): boolean =>
  typeof entry.value === 'string' && /!\s*important\s*$/i.test(entry.value);

const run = (entry: ParityCase, output: 'minimal' | 'spec'): ExpandResult =>
  expandShorthand(entry.property, entry.value, {
    output,
    allowImportant: entry.allowImportant,
    preferInline: entry.preferInline,
  });

describe('parity corpus', () => {
  it('contains no duplicate cases and carries both source tags', () => {
    const keys = PARITY_CORPUS.map(
      (entry) =>
        `${entry.property}\u0000${String(entry.value)}\u0000` +
        `${String(entry.allowImportant)}\u0000${String(entry.preferInline)}`,
    );
    expect(new Set(keys).size).toEqual(keys.length);
    const sources = new Set(PARITY_CORPUS.map((entry) => entry.source));
    expect(sources).toEqual(new Set(['rule-fixture', 'mdn']));
  });

  describe.each(MODES)('%s output', (output) => {
    it.each(PARITY_CORPUS.map((entry) => [caseLabel(entry), entry]))(
      '%s',
      (_label, entry) => {
        // (a) the boundary never throws on CSS input. The call is pure,
        // so running it again for the typed result is free.
        expect(() => run(entry, output)).not.toThrow();
        const result: ExpandResult = run(entry, output);

        // (b) the result is one of the four variants.
        expect(['ok', 'not-shorthand', 'no-op', 'cannot-expand']).toContain(
          result.type,
        );

        if (result.type !== 'ok') {
          return;
        }

        // (c) ok results: non-empty assignments of non-empty string keys
        // to string-or-number values, no duplicate keys.
        const { assignments } = result;
        expect(assignments.length).toBeGreaterThan(0);
        for (const declaration of assignments) {
          expect(typeof declaration.property).toEqual('string');
          expect(declaration.property.length).toBeGreaterThan(0);
          expect(['string', 'number']).toContain(typeof declaration.value);
          if (typeof declaration.value === 'string') {
            expect(declaration.value.length).toBeGreaterThan(0);
          }
        }
        const properties = assignments.map((d) => d.property);
        expect(new Set(properties).size).toEqual(properties.length);

        const def = lookupShorthand(entry.property);
        if (def == null) {
          throw new Error(`ok result for unknown shorthand ${entry.property}`);
        }
        // preferInline projects keys through the def's dialect table.
        const specKeys = def.longhands.map((longhand) =>
          entry.preferInline === true
            ? (def.dialectMap[longhand] ?? longhand)
            : longhand,
        );

        if (output === 'spec') {
          // Spec output is exactly the def's longhands, in spec order.
          expect(properties).toEqual(specKeys);
        } else {
          // Minimal output is a subset of the spec keys (authored cells
          // only) OR a collapse onto fewer, condensed keys (block/inline
          // pairs, the shorthand's own key).
          const isSubset = properties.every((property) =>
            specKeys.includes(property),
          );
          if (!isSubset) {
            expect(properties.length).toBeLessThan(specKeys.length);
          }
        }

        // (d) important passthrough: every emitted string value carries
        // the suffix when the input had !important and the caller allowed
        // it (important inputs only parse when allowed, so ok implies
        // allowed here).
        if (hasImportant(entry)) {
          expect(result.important).toBe(true);
          for (const declaration of assignments) {
            if (typeof declaration.value === 'string') {
              expect(declaration.value).toMatch(/ !important$/);
            }
          }
        } else {
          expect(result.important).toBe(false);
        }
      },
    );
  });

  it('matches the pinned output snapshot', () => {
    const serializeResult = (result: ExpandResult): string => {
      switch (result.type) {
        case 'ok': {
          const cells = result.assignments
            .map(
              (d) => `${d.property}=${JSON.stringify(d.value)}(${d.origin[0]})`,
            )
            .join(' ');
          return `ok${result.important ? '!' : ''} ${cells}`;
        }
        case 'no-op':
          return 'no-op';
        case 'not-shorthand':
          return 'not-shorthand';
        case 'cannot-expand': {
          const { reason } = result;
          switch (reason.kind) {
            case 'parse-error':
              return `cannot-expand:parse-error (${reason.message})`;
            case 'unsupported-feature':
              return `cannot-expand:unsupported-feature (${reason.feature})`;
            default:
              return `cannot-expand:${reason.kind}`;
          }
        }
        default:
          throw new Error(`Unknown result type: ${String(result.type)}`);
      }
    };

    const lines = PARITY_CORPUS.flatMap((entry) =>
      MODES.map(
        (output) =>
          `${caseLabel(entry)} <${entry.source}> ${output} -> ` +
          serializeResult(run(entry, output)),
      ),
    );
    expect(lines.join('\n')).toMatchSnapshot();
  });
});
