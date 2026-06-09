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

    it('collapses all-identical multivalue input to the shorthand itself', () => {
      expect(
        expandShorthand('margin', '10px 10px 10px 10px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'margin', value: '10px', origin: 'explicit' },
        ],
      });
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

    it('falls back to the stringified grammar when a def has no number path', () => {
      expect(lookupShorthand('borderStyle')?.runNumber).toBe(null);
      const spec = expandShorthand('borderStyle', 5, { output: 'spec' });
      expect(spec.type).toEqual('cannot-expand');
      if (spec.type === 'cannot-expand') {
        expect(spec.reason.kind).toEqual('parse-error');
      }
      expect(expandShorthand('borderStyle', 5, { output: 'minimal' })).toEqual({
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

  describe('new def boundary vectors', () => {
    it('expands a gap number in spec output and no-ops in minimal', () => {
      expect(expandShorthand('gap', 4, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'rowGap', value: 4, origin: 'explicit' },
          { property: 'columnGap', value: 4, origin: 'replicated' },
        ],
      });
      expect(expandShorthand('gap', 4, { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });

    it('resolves the gridGap legacy alias to the gap def', () => {
      expect(normalizeKey('gridGap')).toEqual('gap');
      expect(
        expandShorthand('gridGap', '1px 2px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'rowGap', value: '1px', origin: 'explicit' },
          { property: 'columnGap', value: '2px', origin: 'explicit' },
        ],
      });
    });

    it('projects a 2-value borderColor per output mode', () => {
      expect(
        expandShorthand('borderColor', '#fff blue', { output: 'spec' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopColor', value: '#fff', origin: 'explicit' },
          { property: 'borderRightColor', value: 'blue', origin: 'explicit' },
          {
            property: 'borderBottomColor',
            value: '#fff',
            origin: 'replicated',
          },
          { property: 'borderLeftColor', value: 'blue', origin: 'replicated' },
        ],
      });
      expect(
        expandShorthand('borderColor', '#fff blue', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderBlockColor', value: '#fff', origin: 'explicit' },
          { property: 'borderInlineColor', value: 'blue', origin: 'explicit' },
        ],
      });
    });

    it('accepts auto inside inset and maps sides for preferInline', () => {
      expect(
        expandShorthand('inset', 'auto 10px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'insetBlock', value: 'auto', origin: 'explicit' },
          { property: 'insetInline', value: '10px', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand('inset', '1px 2px 3px 4px', {
          output: 'minimal',
          preferInline: true,
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'top', value: '1px', origin: 'explicit' },
          { property: 'insetInlineEnd', value: '2px', origin: 'explicit' },
          { property: 'bottom', value: '3px', origin: 'explicit' },
          { property: 'insetInlineStart', value: '4px', origin: 'explicit' },
        ],
      });
    });

    it('splits an overflow pair and no-ops a single overflow keyword', () => {
      expect(
        expandShorthand('overflow', 'hidden scroll', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'overflowX', value: 'hidden', origin: 'explicit' },
          { property: 'overflowY', value: 'scroll', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand('overflow', 'hidden', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
    });

    it('keeps authored unit casing verbatim in padding output', () => {
      expect(
        expandShorthand('padding', '1PX 2px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'paddingBlock', value: '1PX', origin: 'explicit' },
          { property: 'paddingInline', value: '2px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('corner shorthand boundary vectors', () => {
    it('projects a two-axis borderRadius per output mode', () => {
      expect(
        expandShorthand('borderRadius', '10px / 20px', { output: 'spec' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: '10px 20px',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '10px 20px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomRightRadius',
            value: '10px 20px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '10px 20px',
            origin: 'replicated',
          },
        ],
      });
      expect(
        expandShorthand('borderRadius', '10px / 20px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderRadius',
            value: '10px / 20px',
            origin: 'explicit',
          },
        ],
      });
    });

    it('emits all four corners for a 2-value borderRadius in minimal output', () => {
      expect(
        expandShorthand('borderRadius', '10px 20px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: '10px',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '20px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '10px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '20px',
            origin: 'replicated',
          },
        ],
      });
    });

    it('expands a borderRadius number in spec output and no-ops in minimal', () => {
      expect(expandShorthand('borderRadius', 8, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopLeftRadius', value: 8, origin: 'explicit' },
          { property: 'borderTopRightRadius', value: 8, origin: 'replicated' },
          {
            property: 'borderBottomRightRadius',
            value: 8,
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: 8,
            origin: 'replicated',
          },
        ],
      });
      expect(expandShorthand('borderRadius', 8, { output: 'minimal' })).toEqual(
        { type: 'no-op' },
      );
    });

    it('maps all four corners to logical keys for preferInline', () => {
      expect(
        expandShorthand('borderRadius', '1px 2px 3px 4px', {
          output: 'minimal',
          preferInline: true,
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderStartStartRadius',
            value: '1px',
            origin: 'explicit',
          },
          {
            property: 'borderStartEndRadius',
            value: '2px',
            origin: 'explicit',
          },
          { property: 'borderEndEndRadius', value: '3px', origin: 'explicit' },
          {
            property: 'borderEndStartRadius',
            value: '4px',
            origin: 'explicit',
          },
        ],
      });
    });

    it('no-ops a single cornerShape keyword and splits a pair', () => {
      expect(
        expandShorthand('cornerShape', 'squircle', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
      expect(
        expandShorthand('cornerShape', 'round squircle', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerTopLeftShape',
            value: 'round',
            origin: 'explicit',
          },
          {
            property: 'cornerTopRightShape',
            value: 'squircle',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'round',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'squircle',
            origin: 'replicated',
          },
        ],
      });
    });

    it('maps cornerShape corners to logical keys for preferInline', () => {
      // The dialectMap pairing follows CORNER_SHAPE_MAP: bottom-left maps
      // to end-start and bottom-right to end-end, so the BR/BL quad slots
      // emit EndEnd before EndStart (same shape as the borderRadius
      // vector above).
      expect(
        expandShorthand('cornerShape', 'round scoop bevel notch', {
          output: 'minimal',
          preferInline: true,
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerStartStartShape',
            value: 'round',
            origin: 'explicit',
          },
          {
            property: 'cornerStartEndShape',
            value: 'scoop',
            origin: 'explicit',
          },
          {
            property: 'cornerEndEndShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerEndStartShape',
            value: 'notch',
            origin: 'explicit',
          },
        ],
      });
    });

    it('joins a slash form with a var() in the horizontal list', () => {
      expect(
        expandShorthand('borderRadius', '10px var(--r) / 20px', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: '10px 20px',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: 'var(--r) 20px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '10px 20px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: 'var(--r) 20px',
            origin: 'replicated',
          },
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
