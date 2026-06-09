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
import { cornerShapeDef } from '../../../properties/corner-shape';

function run(value: string, options: EmitOptions) {
  return cornerShapeDef.run(new TokenList(value), options);
}

describe('corner-shape def', () => {
  describe('def metadata', () => {
    it('exposes spec-ordered physical longhands', () => {
      expect(cornerShapeDef.key).toEqual('cornerShape');
      expect(cornerShapeDef.canonical).toEqual('corner-shape');
      expect(cornerShapeDef.longhands).toEqual([
        'cornerTopLeftShape',
        'cornerTopRightShape',
        'cornerBottomRightShape',
        'cornerBottomLeftShape',
      ]);
    });

    it('carries the physical-to-logical corner map as data', () => {
      expect(cornerShapeDef.dialectMap).toEqual({
        cornerTopLeftShape: 'cornerStartStartShape',
        cornerTopRightShape: 'cornerStartEndShape',
        cornerBottomLeftShape: 'cornerEndStartShape',
        cornerBottomRightShape: 'cornerEndEndShape',
      });
    });

    it('has no number fast path', () => {
      expect(cornerShapeDef.runNumber).toBe(null);
    });
  });

  describe('spec output: physical corner longhands', () => {
    it('replicates a single keyword to all four corners', () => {
      expect(run('scoop', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerTopLeftShape',
            value: 'scoop',
            origin: 'explicit',
          },
          {
            property: 'cornerTopRightShape',
            value: 'scoop',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'scoop',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'scoop',
            origin: 'replicated',
          },
        ],
      });
    });

    it('expands four authored keywords in TL TR BR BL order', () => {
      expect(run('round scoop bevel notch', { output: 'spec' })).toEqual({
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
            value: 'scoop',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'notch',
            origin: 'explicit',
          },
        ],
      });
    });

    it('matches keywords case-insensitively but emits them verbatim', () => {
      expect(run('SQUARE Squircle', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerTopLeftShape',
            value: 'SQUARE',
            origin: 'explicit',
          },
          {
            property: 'cornerTopRightShape',
            value: 'Squircle',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'SQUARE',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'Squircle',
            origin: 'replicated',
          },
        ],
      });
    });
  });

  describe('superellipse()', () => {
    it('accepts a numeric argument and keeps the slice verbatim', () => {
      expect(run('superellipse(1.5) bevel', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerTopLeftShape',
            value: 'superellipse(1.5)',
            origin: 'explicit',
          },
          {
            property: 'cornerTopRightShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'superellipse(1.5)',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'bevel',
            origin: 'replicated',
          },
        ],
      });
    });

    it('preserves interior whitespace, sign, and name casing verbatim', () => {
      expect(run('SuperEllipse( -1.5 ) round', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerTopLeftShape',
            value: 'SuperEllipse( -1.5 )',
            origin: 'explicit',
          },
          {
            property: 'cornerTopRightShape',
            value: 'round',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'SuperEllipse( -1.5 )',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'round',
            origin: 'replicated',
          },
        ],
      });
    });

    it.each([
      'superellipse(infinity)',
      'superellipse(-infinity)',
      'superellipse(calc(0.5 * 4))',
    ])("accepts the math-constant and calc argument '%s'", (value) => {
      const result = run(`${value} round`, { output: 'minimal' });
      expect(result.type).toEqual('ok');
      if (result.type === 'ok') {
        expect(result.assignments[0]).toEqual({
          property: 'cornerTopLeftShape',
          value,
          origin: 'explicit',
        });
      }
    });

    it('expands four superellipse() corners, infinity included (WPT)', () => {
      // WPT corner-shape-valid marks superellipse(infinity) a valid corner
      // and Chromium accepts the four-corner form.
      expect(
        run(
          'superellipse(0.5) superellipse(3) superellipse(1) superellipse(infinity)',
          { output: 'spec' },
        ),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerTopLeftShape',
            value: 'superellipse(0.5)',
            origin: 'explicit',
          },
          {
            property: 'cornerTopRightShape',
            value: 'superellipse(3)',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'superellipse(1)',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'superellipse(infinity)',
            origin: 'explicit',
          },
        ],
      });
    });

    it.each([
      ['superellipse(red) round', 'a non-numeric argument'],
      ['superellipse(1px) round', 'a dimension argument'],
      ['superellipse(1 round', 'unbalanced parentheses'],
      ['superellipse() round', 'a missing argument'],
    ])("refuses '%s' (%s)", (value) => {
      const result = run(value, { output: 'spec' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });
  });

  describe('minimal output: physical corner keys', () => {
    it('collapses all-identical corner values onto the shorthand key', () => {
      expect(run('bevel bevel', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'cornerShape', value: 'bevel', origin: 'explicit' },
        ],
      });
    });

    it('emits the physical key list in quad order when corners differ', () => {
      // Deliberate divergence from splitShorthands.js, which emitted
      // logical keys by default (with a mirrored BR/BL pairing). See the
      // def's doc comment; preferInline mapping is boundary data.
      expect(run('round scoop bevel notch', { output: 'minimal' })).toEqual({
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
            value: 'scoop',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'notch',
            origin: 'explicit',
          },
        ],
      });
    });

    it('replicates the two-value form onto the physical keys', () => {
      expect(run('round scoop', { output: 'minimal' })).toEqual({
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
            value: 'scoop',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'round',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'scoop',
            origin: 'replicated',
          },
        ],
      });
    });

    it('passes a top-level var() through as one component', () => {
      expect(run('var(--shape) bevel', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'cornerTopLeftShape',
            value: 'var(--shape)',
            origin: 'explicit',
          },
          {
            property: 'cornerTopRightShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerBottomRightShape',
            value: 'var(--shape)',
            origin: 'replicated',
          },
          {
            property: 'cornerBottomLeftShape',
            value: 'bevel',
            origin: 'replicated',
          },
        ],
      });
    });
  });

  describe('refusals', () => {
    it.each([
      ['round / bevel', 'corner-shape has no two-axis slash form'],
      ['rounded scoop', 'an unknown keyword'],
      ['round scoop bevel notch square', 'a fifth component'],
      ['round, scoop', 'comma-separated values'],
    ])("refuses '%s' (%s)", (value) => {
      const result = run(value, { output: 'spec' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });
  });
});
