/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import {
  expandShorthand,
  isShorthand,
  lookupShorthand,
  normalizeKey,
  registry,
} from '../index';
import * as styleValueParser from '../../index';

describe('expandShorthand', () => {
  describe('registry boundary', () => {
    it('returns not-shorthand for properties the registry does not know', () => {
      expect(expandShorthand('color', 'red', { output: 'spec' })).toEqual({
        type: 'not-shorthand',
      });
      expect(
        expandShorthand('marginTop', '10px', { output: 'minimal' }),
      ).toEqual({ type: 'not-shorthand' });
    });

    it('throws on an unknown output mode (programmer error, not CSS input)', () => {
      expect(() =>
        expandShorthand('margin', '10px', {
          output: 'bogus' as $FlowFixMe,
        }),
      ).toThrow();
    });

    it('exposes a frozen registry and derived lookups', () => {
      expect(Object.isFrozen(registry)).toBe(true);
      expect(isShorthand('margin')).toBe(true);
      expect(isShorthand('marginTop')).toBe(false);
      expect(normalizeKey('margin')).toEqual('margin');
      expect(normalizeKey('somethingElse')).toEqual('somethingElse');
      expect(lookupShorthand('margin')?.key).toEqual('margin');
      expect(lookupShorthand('nope')).toBe(null);
    });

    it('is re-exported from the package index as `shorthands`', () => {
      expect(typeof styleValueParser.shorthands.expandShorthand).toEqual(
        'function',
      );
    });
  });

  describe('spec output', () => {
    it('expands two values to four longhands with explicit/replicated origins', () => {
      expect(
        expandShorthand('margin', '10px 20px', { output: 'spec' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '10px', origin: 'explicit' },
          { property: 'marginRight', value: '20px', origin: 'explicit' },
          { property: 'marginBottom', value: '10px', origin: 'replicated' },
          { property: 'marginLeft', value: '20px', origin: 'replicated' },
        ],
      });
    });

    it('expands a single value to four longhands (no fast-path short-circuit)', () => {
      expect(expandShorthand('margin', '10px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '10px', origin: 'explicit' },
          { property: 'marginRight', value: '10px', origin: 'replicated' },
          { property: 'marginBottom', value: '10px', origin: 'replicated' },
          { property: 'marginLeft', value: '10px', origin: 'replicated' },
        ],
      });
    });

    it('always emits assignments in the def-declared spec order', () => {
      for (const value of [
        '1px',
        '1px 2px',
        '1px 2px 3px',
        '1px 2px 3px 4px',
      ]) {
        const result = expandShorthand('margin', value, { output: 'spec' });
        if (result.type !== 'ok') {
          throw new Error(`expected ok for '${value}', got ${result.type}`);
        }
        expect(result.assignments.map((a) => a.property)).toEqual([
          'marginTop',
          'marginRight',
          'marginBottom',
          'marginLeft',
        ]);
      }
    });
  });

  describe('minimal output', () => {
    it('condenses two values to the block/inline pair', () => {
      expect(
        expandShorthand('margin', '10px 20px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: '10px', origin: 'explicit' },
          { property: 'marginInline', value: '20px', origin: 'explicit' },
        ],
      });
    });

    it('expands three values to four longhands', () => {
      expect(
        expandShorthand('margin', '1px 2px 3px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '1px', origin: 'explicit' },
          { property: 'marginRight', value: '2px', origin: 'explicit' },
          { property: 'marginBottom', value: '3px', origin: 'explicit' },
          { property: 'marginLeft', value: '2px', origin: 'replicated' },
        ],
      });
    });

    it('treats single values as a no-op', () => {
      expect(expandShorthand('margin', '10px', { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });

    it('treats all-identical values as a no-op, like the old splitter collapse', () => {
      expect(
        expandShorthand('margin', '10px 10px 10px 10px', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
    });
  });

  describe('preferInline dialect mapping', () => {
    it('maps right/left to InlineEnd/InlineStart on 3-4 value forms', () => {
      expect(
        expandShorthand('margin', '10em 1em 5em 2em', {
          output: 'minimal',
          preferInline: true,
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '10em', origin: 'explicit' },
          { property: 'marginInlineEnd', value: '1em', origin: 'explicit' },
          { property: 'marginBottom', value: '5em', origin: 'explicit' },
          { property: 'marginInlineStart', value: '2em', origin: 'explicit' },
        ],
      });
    });

    it('leaves the 2-value block/inline pair untouched', () => {
      expect(
        expandShorthand('margin', '10em 1em', {
          output: 'minimal',
          preferInline: true,
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: '10em', origin: 'explicit' },
          { property: 'marginInline', value: '1em', origin: 'explicit' },
        ],
      });
    });

    it('applies to spec output as well', () => {
      expect(
        expandShorthand('margin', '1px 2px 3px 4px', {
          output: 'spec',
          preferInline: true,
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '1px', origin: 'explicit' },
          { property: 'marginInlineEnd', value: '2px', origin: 'explicit' },
          { property: 'marginBottom', value: '3px', origin: 'explicit' },
          { property: 'marginInlineStart', value: '4px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('numeric values', () => {
    it('expands a number to four numeric declarations in spec output', () => {
      expect(expandShorthand('margin', 10, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: 10, origin: 'explicit' },
          { property: 'marginRight', value: 10, origin: 'replicated' },
          { property: 'marginBottom', value: 10, origin: 'replicated' },
          { property: 'marginLeft', value: 10, origin: 'replicated' },
        ],
      });
    });

    it('treats a number as a no-op in minimal output', () => {
      expect(expandShorthand('margin', 10, { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });
  });

  describe('!important', () => {
    it('suffixes every emitted value when allowed', () => {
      expect(
        expandShorthand('margin', '10px 12px 13px 14px !important', {
          output: 'minimal',
          allowImportant: true,
        }),
      ).toEqual({
        type: 'ok',
        important: true,
        assignments: [
          {
            property: 'marginTop',
            value: '10px !important',
            origin: 'explicit',
          },
          {
            property: 'marginRight',
            value: '12px !important',
            origin: 'explicit',
          },
          {
            property: 'marginBottom',
            value: '13px !important',
            origin: 'explicit',
          },
          {
            property: 'marginLeft',
            value: '14px !important',
            origin: 'explicit',
          },
        ],
      });
    });

    it('refuses with important-disallowed when not allowed', () => {
      expect(
        expandShorthand('margin', '10px 20px !important', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'important-disallowed' },
      });
      expect(
        expandShorthand('margin', '10px 20px !important', {
          output: 'spec',
          allowImportant: false,
        }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'important-disallowed' },
      });
    });

    it('matches the keyword case-insensitively with interior whitespace', () => {
      expect(
        expandShorthand('margin', '10px 20px ! IMPORTANT', {
          output: 'minimal',
          allowImportant: true,
        }),
      ).toEqual({
        type: 'ok',
        important: true,
        assignments: [
          {
            property: 'marginBlock',
            value: '10px !important',
            origin: 'explicit',
          },
          {
            property: 'marginInline',
            value: '20px !important',
            origin: 'explicit',
          },
        ],
      });
    });
  });

  describe('CSS-wide keywords', () => {
    it('replicates the keyword to every longhand in spec output', () => {
      expect(expandShorthand('margin', 'inherit', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: 'inherit', origin: 'replicated' },
          { property: 'marginRight', value: 'inherit', origin: 'replicated' },
          { property: 'marginBottom', value: 'inherit', origin: 'replicated' },
          { property: 'marginLeft', value: 'inherit', origin: 'replicated' },
        ],
      });
    });

    it('is a no-op in minimal output (already a single component)', () => {
      expect(
        expandShorthand('margin', 'inherit', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
      expect(
        expandShorthand('margin', 'revert-layer', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
    });

    it('combines with !important in spec output', () => {
      expect(
        expandShorthand('margin', 'inherit !important', {
          output: 'spec',
          allowImportant: true,
        }),
      ).toEqual({
        type: 'ok',
        important: true,
        assignments: [
          {
            property: 'marginTop',
            value: 'inherit !important',
            origin: 'replicated',
          },
          {
            property: 'marginRight',
            value: 'inherit !important',
            origin: 'replicated',
          },
          {
            property: 'marginBottom',
            value: 'inherit !important',
            origin: 'replicated',
          },
          {
            property: 'marginLeft',
            value: 'inherit !important',
            origin: 'replicated',
          },
        ],
      });
    });
  });

  describe('variables and functions', () => {
    it('passes a top-level var() through as one component', () => {
      expect(
        expandShorthand('margin', 'var(--x) 10px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: 'var(--x)', origin: 'explicit' },
          { property: 'marginInline', value: '10px', origin: 'explicit' },
        ],
      });
    });

    it('treats a lone var() as a single-component no-op in minimal output', () => {
      expect(
        expandShorthand('margin', 'var(--x)', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
    });

    it('accepts calc() components verbatim', () => {
      expect(
        expandShorthand('margin', 'calc(1px + 2%) 10px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginBlock',
            value: 'calc(1px + 2%)',
            origin: 'explicit',
          },
          { property: 'marginInline', value: '10px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('verbatim value preservation', () => {
    it('keeps authored casing and interior spacing byte-identical', () => {
      expect(
        expandShorthand('margin', 'calc( 1px + 2% ) 10PX', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginBlock',
            value: 'calc( 1px + 2% )',
            origin: 'explicit',
          },
          { property: 'marginInline', value: '10PX', origin: 'explicit' },
        ],
      });
    });

    it('tolerates surrounding whitespace without leaking it into values', () => {
      expect(
        expandShorthand('margin', '  10px   20px  ', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: '10px', origin: 'explicit' },
          { property: 'marginInline', value: '20px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('refusals', () => {
    it('refuses values the grammar cannot parse', () => {
      const result = expandShorthand('margin', 'red green', {
        output: 'minimal',
      });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });

    it('refuses empty values', () => {
      const result = expandShorthand('margin', '   ', { output: 'spec' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });
  });
});
