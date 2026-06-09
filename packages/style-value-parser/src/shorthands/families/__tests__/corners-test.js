/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { EmitOptions } from '../../types';

import { TokenList } from '../../../token-types';
import { borderRadiusDef } from '../../../properties/border-radius';

function run(value: string, options: EmitOptions) {
  return borderRadiusDef.run(new TokenList(value), options);
}

describe('corners family (via the border-radius def)', () => {
  describe('def metadata', () => {
    it('exposes spec-ordered corner longhands', () => {
      expect(borderRadiusDef.key).toEqual('borderRadius');
      expect(borderRadiusDef.canonical).toEqual('border-radius');
      expect(borderRadiusDef.longhands).toEqual([
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomRightRadius',
        'borderBottomLeftRadius',
      ]);
    });

    it('carries the physical-to-logical corner map as data', () => {
      expect(borderRadiusDef.dialectMap).toEqual({
        borderTopLeftRadius: 'borderStartStartRadius',
        borderTopRightRadius: 'borderStartEndRadius',
        borderBottomLeftRadius: 'borderEndStartRadius',
        borderBottomRightRadius: 'borderEndEndRadius',
      });
    });
  });

  describe('spec output: corner fill without a slash', () => {
    it('replicates a single value to all four corners', () => {
      expect(run('10px', { output: 'spec' })).toEqual({
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
            value: '10px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomRightRadius',
            value: '10px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '10px',
            origin: 'replicated',
          },
        ],
      });
    });

    it('fills bottom-right from top-left and bottom-left from top-right', () => {
      expect(run('10px 20px', { output: 'spec' })).toEqual({
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

    it('fills bottom-left from top-right for three values', () => {
      expect(run('1px 2px 3px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopLeftRadius', value: '1px', origin: 'explicit' },
          {
            property: 'borderTopRightRadius',
            value: '2px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '3px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '2px',
            origin: 'replicated',
          },
        ],
      });
    });

    it('marks all four corners explicit when authored', () => {
      expect(run('1px 2px 3px 4px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopLeftRadius', value: '1px', origin: 'explicit' },
          {
            property: 'borderTopRightRadius',
            value: '2px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '3px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '4px',
            origin: 'explicit',
          },
        ],
      });
    });

    it('always emits in the spec-ordered longhand order', () => {
      for (const value of [
        '9px',
        '9px 8px',
        '9px 8px 7px',
        '9px 8px 7px 6px',
        '9px / 8px',
        '9px 8px / 7px 6px',
      ]) {
        const result = run(value, { output: 'spec' });
        if (result.type !== 'ok') {
          throw new Error(`expected ok for '${value}', got ${result.type}`);
        }
        expect(result.assignments.map((a) => a.property)).toEqual(
          borderRadiusDef.longhands,
        );
      }
    });
  });

  describe('spec output: slash forms (independent vertical fill)', () => {
    it('joins horizontal and vertical slices per corner', () => {
      expect(run('10px / 20px', { output: 'spec' })).toEqual({
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
    });

    it('fills the two lists independently', () => {
      expect(run('1px 2px / 5% 6% 7%', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: '1px 5%',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '2px 6%',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '1px 7%',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '2px 6%',
            origin: 'replicated',
          },
        ],
      });
    });

    it('emits the bare horizontal slice when a corner has equal radii', () => {
      expect(run('10px 5% / 10px 30px', { output: 'spec' })).toEqual({
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
            value: '5% 30px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '10px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '5% 30px',
            origin: 'replicated',
          },
        ],
      });
    });

    it('derives origins from the horizontal list alone', () => {
      // An authored vertical list never widens the explicit set: presence
      // tracks the horizontal positions only.
      expect(run('10px / 1px 2px 3px 4px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: '10px 1px',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '10px 2px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomRightRadius',
            value: '10px 3px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '10px 4px',
            origin: 'replicated',
          },
        ],
      });
    });

    it('parses a slash without surrounding whitespace', () => {
      expect(run('10px/20px', { output: 'spec' })).toEqual({
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
    });
  });

  describe('minimal output: collapse or all four corners', () => {
    it('treats a single value as a no-op', () => {
      expect(run('10px', { output: 'minimal' })).toEqual({ type: 'no-op' });
    });

    it('collapses all-identical corner values onto the shorthand key', () => {
      const collapsed = {
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderRadius', value: '8px', origin: 'explicit' },
        ],
      };
      expect(run('8px 8px', { output: 'minimal' })).toEqual(collapsed);
      expect(run('8px 8px 8px', { output: 'minimal' })).toEqual(collapsed);
      expect(run('8px 8px 8px 8px', { output: 'minimal' })).toEqual(collapsed);
    });

    it('collapses an all-equal slash form to the single-value serialization', () => {
      expect(run('10px / 10px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderRadius', value: '10px', origin: 'explicit' },
        ],
      });
    });

    it('collapses uniform two-axis corners to the h / v serialization', () => {
      const collapsed = {
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderRadius',
            value: '10px / 20px',
            origin: 'explicit',
          },
        ],
      };
      expect(run('10px / 20px', { output: 'minimal' })).toEqual(collapsed);
      expect(run('10px 10px / 20px 20px', { output: 'minimal' })).toEqual(
        collapsed,
      );
      expect(run('10px 10px 10px 10px / 20px', { output: 'minimal' })).toEqual(
        collapsed,
      );
    });

    it('emits all four corners when values differ (no block/inline pairing)', () => {
      expect(run('10px 20px', { output: 'minimal' })).toEqual({
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

    it('emits joined two-axis values per corner when a slash is present', () => {
      expect(run('10px 20px / 30px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: '10px 30px',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '20px 30px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '10px 30px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '20px 30px',
            origin: 'replicated',
          },
        ],
      });
    });

    it('compares values verbatim, so differing case is not collapsed', () => {
      expect(run('8px 8PX', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopLeftRadius', value: '8px', origin: 'explicit' },
          {
            property: 'borderTopRightRadius',
            value: '8PX',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: '8px',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '8PX',
            origin: 'replicated',
          },
        ],
      });
    });
  });

  describe('verbatim value slices', () => {
    it('preserves interior spacing of calc() components', () => {
      expect(run('calc( 1px + 2% ) 5px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: 'calc( 1px + 2% )',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '5px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: 'calc( 1px + 2% )',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '5px',
            origin: 'replicated',
          },
        ],
      });
    });

    it('passes a top-level var() through as one component per list', () => {
      expect(run('var(--r) 5px / 1em', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: 'var(--r) 1em',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '5px 1em',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: 'var(--r) 1em',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '5px 1em',
            origin: 'replicated',
          },
        ],
      });
    });

    it('keeps var() fallbacks intact inside a corner component', () => {
      expect(run('var(--r, 4px) 8px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderTopLeftRadius',
            value: 'var(--r, 4px)',
            origin: 'explicit',
          },
          {
            property: 'borderTopRightRadius',
            value: '8px',
            origin: 'explicit',
          },
          {
            property: 'borderBottomRightRadius',
            value: 'var(--r, 4px)',
            origin: 'replicated',
          },
          {
            property: 'borderBottomLeftRadius',
            value: '8px',
            origin: 'replicated',
          },
        ],
      });
    });
  });

  describe('numeric values', () => {
    it('expands a number to all four corners in spec output', () => {
      expect(borderRadiusDef.runNumber?.(8, { output: 'spec' })).toEqual({
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
    });

    it('treats a number as a single-component no-op in minimal output', () => {
      expect(borderRadiusDef.runNumber?.(8, { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });
  });

  describe('refusals', () => {
    it.each([
      ['red', 'keyword outside the grammar'],
      ['1px 2px 3px 4px 5px', 'a fifth horizontal radius'],
      ['10px, 20px', 'comma-separated values'],
      ['10px / 20px / 30px', 'a second slash'],
      ['10px /', 'a dangling slash'],
      ['/ 10px', 'a leading slash'],
      ['10px / 1px 2px 3px 4px 5px', 'a fifth vertical radius'],
    ])("refuses '%s' (%s)", (value) => {
      const result = run(value, { output: 'spec' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });
  });
});
