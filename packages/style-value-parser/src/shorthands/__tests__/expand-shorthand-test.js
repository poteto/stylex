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

    it('gates the single-component fast path per def', () => {
      // Escapees are defs whose one-component values still need the
      // grammar in minimal output: line trios ('border: solid' lives on
      // borderStyle) and grid-area ('header' lives on four line keys).
      const escapees = new Set([
        'border',
        'borderTop',
        'borderRight',
        'borderBottom',
        'borderLeft',
        'gridArea',
        'outline',
      ]);
      for (const key of Object.keys(registry)) {
        expect(registry[key].singleComponentIsIdentity).toBe(
          !escapees.has(key),
        );
      }
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

    it('accepts min/max/clamp as length-ish components', () => {
      expect(
        expandShorthand('margin', 'min(1px, 2vw) 2px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginBlock',
            value: 'min(1px, 2vw)',
            origin: 'explicit',
          },
          { property: 'marginInline', value: '2px', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand('border', 'clamp(1px,2px,3px) solid', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderWidth',
            value: 'clamp(1px,2px,3px)',
            origin: 'explicit',
          },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
        ],
      });
    });

    it('accepts a var() nested inside a math function', () => {
      // The nested var() is invisible to splitting AND to the boundary's
      // contains-variable reclassification (hasTopLevelVar only looks at
      // depth 0): the math function is one opaque length-ish component.
      expect(
        expandShorthand('margin', 'min(var(--a), 2px) 1px', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginBlock',
            value: 'min(var(--a), 2px)',
            origin: 'explicit',
          },
          { property: 'marginInline', value: '1px', origin: 'explicit' },
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

    it('collapses a no-whitespace slash form onto the shorthand key', () => {
      // '10px/20px' is three top-level components (value, slash, value),
      // so minimal output must reach the def instead of fast-path no-oping
      // on a single whitespace-run. The old splitter refused any top-level
      // slash here (CANNOT_FIX); collapsing to the canonical '<h> / <v>'
      // form is a knowing improvement.
      expect(
        expandShorthand('borderRadius', '10px/20px', { output: 'minimal' }),
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

  describe('line-trio boundary vectors', () => {
    it('projects border per output mode', () => {
      expect(
        expandShorthand('border', '1px solid red', { output: 'spec' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand('border', '1px solid red', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
    });

    it('emits only authored slots in minimal output, all three in spec', () => {
      expect(
        expandShorthand('border', '1px solid', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand('border', '1px solid', { output: 'spec' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          {
            property: 'borderColor',
            value: 'currentcolor',
            origin: 'defaulted',
          },
        ],
      });
    });

    it('classifies components independent of authored order', () => {
      expect(
        expandShorthand('border', 'red solid 1px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
    });

    it('matches named colors case-insensitively and emits them verbatim', () => {
      expect(
        expandShorthand('border', '1px solid RED', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'RED', origin: 'explicit' },
        ],
      });
    });

    it('fills the one open slot with the one var() by elimination', () => {
      expect(
        expandShorthand('border', '1px solid var(--c)', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'var(--c)', origin: 'explicit' },
        ],
      });
    });

    it('reclassifies unplaceable var() refusals as contains-variable', () => {
      expect(
        expandShorthand('border', 'var(--a) var(--b) solid', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'contains-variable' },
      });
      // A lone var() is one component, but border escapes the
      // single-component fast path and cannot place it (three open
      // slots), unlike positional grammars where it would no-op.
      expect(
        expandShorthand('border', 'var(--x)', { output: 'minimal' }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'contains-variable' },
      });
    });

    it('expands a single-component border even in minimal output', () => {
      // End-to-end proof of the def-gated fast-path escape: 'solid' is one
      // component, yet its minimal form lives on borderStyle.
      expect(expandShorthand('border', 'solid', { output: 'minimal' })).toEqual(
        {
          type: 'ok',
          important: false,
          assignments: [
            { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          ],
        },
      );
    });

    it('still no-ops a minimal css-wide keyword on an escaping def', () => {
      expect(
        expandShorthand('border', 'inherit', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
      expect(expandShorthand('border', 'inherit', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: 'inherit', origin: 'replicated' },
          { property: 'borderStyle', value: 'inherit', origin: 'replicated' },
          { property: 'borderColor', value: 'inherit', origin: 'replicated' },
        ],
      });
    });

    it('refuses duplicate slots as parse errors', () => {
      const duplicateStyle = expandShorthand('border', 'solid dotted', {
        output: 'minimal',
      });
      expect(duplicateStyle.type).toEqual('cannot-expand');
      if (duplicateStyle.type === 'cannot-expand') {
        expect(duplicateStyle.reason).toEqual({
          kind: 'parse-error',
          message: 'Duplicate style component: dotted',
        });
      }
      const duplicateWidth = expandShorthand('border', '1px 2px solid', {
        output: 'minimal',
      });
      expect(duplicateWidth.type).toEqual('cannot-expand');
      if (duplicateWidth.type === 'cannot-expand') {
        expect(duplicateWidth.reason).toEqual({
          kind: 'parse-error',
          message: 'Duplicate width component: 2px',
        });
      }
    });

    it('refuses a bare number through the stringified fallback', () => {
      // border has no expandNumber: a bare number is not a valid border
      // value (the old splitter refused it too), so the stringified
      // grammar route must refuse rather than invent a width.
      const result = expandShorthand('border', 5, { output: 'minimal' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });

    it('expands border sides onto their side-specific longhands', () => {
      expect(
        expandShorthand('borderTop', '2px dashed', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopWidth', value: '2px', origin: 'explicit' },
          { property: 'borderTopStyle', value: 'dashed', origin: 'explicit' },
        ],
      });
    });

    it("sends a lone outline 'auto' to the style slot", () => {
      expect(expandShorthand('outline', 'auto', { output: 'minimal' })).toEqual(
        {
          type: 'ok',
          important: false,
          assignments: [
            { property: 'outlineStyle', value: 'auto', origin: 'explicit' },
          ],
        },
      );
    });

    it('fills all three outline slots around an auto style', () => {
      expect(
        expandShorthand('outline', '1px auto red', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'outlineWidth', value: '1px', origin: 'explicit' },
          { property: 'outlineStyle', value: 'auto', origin: 'explicit' },
          { property: 'outlineColor', value: 'red', origin: 'explicit' },
        ],
      });
    });
  });

  describe('flex boundary vectors', () => {
    it("expands 'flex: auto' in spec output and no-ops it in minimal", () => {
      expect(expandShorthand('flex', 'auto', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '1', origin: 'replicated' },
          { property: 'flexShrink', value: '1', origin: 'replicated' },
          { property: 'flexBasis', value: 'auto', origin: 'replicated' },
        ],
      });
      expect(expandShorthand('flex', 'auto', { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });

    it('emits the full trio for a 3-value flex in minimal output', () => {
      expect(expandShorthand('flex', '2 1 0%', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'explicit' },
          { property: 'flexBasis', value: '0%', origin: 'explicit' },
        ],
      });
    });

    it('expands a flex number in spec output and no-ops it in minimal', () => {
      expect(expandShorthand('flex', 1, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: 1, origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
      expect(expandShorthand('flex', 1, { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });

    it("refuses 'flex: 1 var(--b)' as contains-variable (old splitter split it)", () => {
      // Knowing divergence: the old splitter accepted var() as a flex
      // basis and emitted flexBasis: var(--b). A var() substitutes an
      // unknowable number of components, so the engine refuses with the
      // typed contains-variable reason instead.
      expect(
        expandShorthand('flex', '1 var(--b)', { output: 'minimal' }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'contains-variable' },
      });
    });
  });

  describe('font boundary vectors', () => {
    it('projects the full font form per output mode', () => {
      expect(
        expandShorthand('font', 'italic bold 12px/30px serif', {
          output: 'spec',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontStyle', value: 'italic', origin: 'explicit' },
          { property: 'fontVariant', value: 'normal', origin: 'defaulted' },
          { property: 'fontWeight', value: 'bold', origin: 'explicit' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: '30px', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand('font', 'italic bold 12px/30px serif', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontStyle', value: 'italic', origin: 'explicit' },
          { property: 'fontWeight', value: 'bold', origin: 'explicit' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: '30px', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('keeps a quoted family with a comma run byte-for-byte', () => {
      expect(
        expandShorthand('font', '12px "Helvetica Neue", serif', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          {
            property: 'fontFamily',
            value: '"Helvetica Neue", serif',
            origin: 'explicit',
          },
        ],
      });
    });

    it("refuses 'font: menu' in spec output as unsupported-feature", () => {
      expect(expandShorthand('font', 'menu', { output: 'spec' })).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'unsupported-feature', feature: 'system-font' },
      });
      // In minimal output the single component fast-paths to a no-op
      // before the grammar (or the unsupported hook) ever runs.
      expect(expandShorthand('font', 'menu', { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });

    it('splits a mid-run slash into size and line-height', () => {
      expect(
        expandShorthand('font', '12px/1.5 serif', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: '1.5', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });
  });

  describe('background boundary vectors', () => {
    it('projects a full layer per output mode', () => {
      expect(
        expandShorthand(
          'background',
          'red url(a.png) no-repeat center / cover',
          {
            output: 'spec',
          },
        ),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'backgroundColor', value: 'red', origin: 'explicit' },
          {
            property: 'backgroundImage',
            value: 'url(a.png)',
            origin: 'explicit',
          },
          {
            property: 'backgroundRepeat',
            value: 'no-repeat',
            origin: 'explicit',
          },
          {
            property: 'backgroundAttachment',
            value: 'scroll',
            origin: 'defaulted',
          },
          {
            property: 'backgroundPosition',
            value: 'center',
            origin: 'explicit',
          },
          { property: 'backgroundSize', value: 'cover', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand(
          'background',
          'red url(a.png) no-repeat center / cover',
          {
            output: 'minimal',
          },
        ),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'backgroundColor', value: 'red', origin: 'explicit' },
          {
            property: 'backgroundImage',
            value: 'url(a.png)',
            origin: 'explicit',
          },
          {
            property: 'backgroundRepeat',
            value: 'no-repeat',
            origin: 'explicit',
          },
          {
            property: 'backgroundPosition',
            value: 'center',
            origin: 'explicit',
          },
          { property: 'backgroundSize', value: 'cover', origin: 'explicit' },
        ],
      });
    });

    it('refuses comma-separated layers as multiple-layers', () => {
      expect(
        expandShorthand('background', 'url(a), url(b)', { output: 'minimal' }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'multiple-layers' },
      });
      expect(
        expandShorthand('background', 'url(a), url(b)', { output: 'spec' }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'multiple-layers' },
      });
    });

    it('refuses box keywords as unsupported-feature', () => {
      expect(
        expandShorthand('background', 'content-box red', { output: 'minimal' }),
      ).toEqual({
        type: 'cannot-expand',
        reason: {
          kind: 'unsupported-feature',
          feature: 'background-box-values',
        },
      });
    });

    it("no-ops a single-component 'background: red' in minimal output", () => {
      expect(
        expandShorthand('background', 'red', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
    });
  });

  describe('animation boundary vectors', () => {
    it('projects a six-component layer per output mode', () => {
      expect(
        expandShorthand(
          'animation',
          '2s ease-in 0.5s infinite alternate slidein',
          {
            output: 'spec',
          },
        ),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '2s', origin: 'explicit' },
          {
            property: 'animationTimingFunction',
            value: 'ease-in',
            origin: 'explicit',
          },
          { property: 'animationDelay', value: '0.5s', origin: 'explicit' },
          {
            property: 'animationIterationCount',
            value: 'infinite',
            origin: 'explicit',
          },
          {
            property: 'animationDirection',
            value: 'alternate',
            origin: 'explicit',
          },
          {
            property: 'animationFillMode',
            value: 'none',
            origin: 'defaulted',
          },
          {
            property: 'animationPlayState',
            value: 'running',
            origin: 'defaulted',
          },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
      expect(
        expandShorthand(
          'animation',
          '2s ease-in 0.5s infinite alternate slidein',
          {
            output: 'minimal',
          },
        ),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '2s', origin: 'explicit' },
          {
            property: 'animationTimingFunction',
            value: 'ease-in',
            origin: 'explicit',
          },
          { property: 'animationDelay', value: '0.5s', origin: 'explicit' },
          {
            property: 'animationIterationCount',
            value: 'infinite',
            origin: 'explicit',
          },
          {
            property: 'animationDirection',
            value: 'alternate',
            origin: 'explicit',
          },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
    });

    it("sends a lone 'none' to the name end to end in spec output", () => {
      const result = expandShorthand('animation', 'none', { output: 'spec' });
      expect(result.type).toEqual('ok');
      if (result.type === 'ok') {
        expect(result.assignments[5]).toEqual({
          property: 'animationFillMode',
          value: 'none',
          origin: 'defaulted',
        });
        expect(result.assignments[7]).toEqual({
          property: 'animationName',
          value: 'none',
          origin: 'explicit',
        });
      }
      // In minimal output the single component fast-paths to a no-op.
      expect(
        expandShorthand('animation', 'none', { output: 'minimal' }),
      ).toEqual({ type: 'no-op' });
    });

    it('refuses a third time component as a parse error', () => {
      const result = expandShorthand('animation', '1s 2s 3s', {
        output: 'minimal',
      });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason).toEqual({
          kind: 'parse-error',
          message: 'Too many time components: 3s',
        });
      }
    });
  });

  describe('grid boundary vectors', () => {
    it("splits 'gridRow: span 2 / 3' in minimal output", () => {
      expect(
        expandShorthand('gridRow', 'span 2 / 3', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'span 2', origin: 'explicit' },
          { property: 'gridRowEnd', value: '3', origin: 'explicit' },
        ],
      });
    });

    it("expands 'gridArea: header' to four longhands in both modes", () => {
      const expected = {
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'header', origin: 'explicit' },
          {
            property: 'gridColumnStart',
            value: 'header',
            origin: 'replicated',
          },
          { property: 'gridRowEnd', value: 'header', origin: 'replicated' },
          {
            property: 'gridColumnEnd',
            value: 'header',
            origin: 'replicated',
          },
        ],
      };
      expect(
        expandShorthand('gridArea', 'header', { output: 'minimal' }),
      ).toEqual(expected);
      expect(expandShorthand('gridArea', 'header', { output: 'spec' })).toEqual(
        expected,
      );
    });

    it('copies an ident column-start to the omitted column-end', () => {
      expect(
        expandShorthand('gridArea', '1 / col2 / 3', { output: 'spec' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '1', origin: 'explicit' },
          { property: 'gridColumnStart', value: 'col2', origin: 'explicit' },
          { property: 'gridRowEnd', value: '3', origin: 'explicit' },
          { property: 'gridColumnEnd', value: 'col2', origin: 'replicated' },
        ],
      });
    });

    it('splits gridTemplate rows / columns in both modes', () => {
      const expected = {
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'gridTemplateRows',
            value: '1fr auto',
            origin: 'explicit',
          },
          {
            property: 'gridTemplateColumns',
            value: '200px 1fr',
            origin: 'explicit',
          },
        ],
      };
      expect(
        expandShorthand('gridTemplate', '1fr auto / 200px 1fr', {
          output: 'spec',
        }),
      ).toEqual(expected);
      expect(
        expandShorthand('gridTemplate', '1fr auto / 200px 1fr', {
          output: 'minimal',
        }),
      ).toEqual(expected);
    });

    it('refuses the grid-template areas form as unsupported-feature', () => {
      expect(
        expandShorthand('gridTemplate', '"a b" 1fr / auto', { output: 'spec' }),
      ).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'unsupported-feature', feature: 'template-areas' },
      });
    });

    it('routes a bare gridRow number through the stringified fallback', () => {
      // No expandNumber on grid defs: minimal no-ops via the identity
      // fast path; spec parses the stringified '2' as one integer group.
      expect(expandShorthand('gridRow', 2, { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
      expect(expandShorthand('gridRow', 2, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '2', origin: 'explicit' },
          { property: 'gridRowEnd', value: 'auto', origin: 'defaulted' },
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
