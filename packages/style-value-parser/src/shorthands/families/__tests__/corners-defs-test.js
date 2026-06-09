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
            property: 'cornerStartStartShape',
            value: 'superellipse(1.5)',
            origin: 'explicit',
          },
          {
            property: 'cornerStartEndShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerEndStartShape',
            value: 'superellipse(1.5)',
            origin: 'replicated',
          },
          {
            property: 'cornerEndEndShape',
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
            property: 'cornerStartStartShape',
            value: 'SuperEllipse( -1.5 )',
            origin: 'explicit',
          },
          {
            property: 'cornerStartEndShape',
            value: 'round',
            origin: 'explicit',
          },
          {
            property: 'cornerEndStartShape',
            value: 'SuperEllipse( -1.5 )',
            origin: 'replicated',
          },
          {
            property: 'cornerEndEndShape',
            value: 'round',
            origin: 'replicated',
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

  describe('minimal output: old-splitter key parity', () => {
    it('collapses all-identical corner values onto the shorthand key', () => {
      expect(run('bevel bevel', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'cornerShape', value: 'bevel', origin: 'explicit' },
        ],
      });
    });

    it('emits the logical key list in quad order when corners differ', () => {
      // Key pairing reproduces splitShorthands.js: the BR quad slot lands
      // on cornerEndStartShape and BL on cornerEndEndShape, the reverse of
      // this def's dialectMap pairing. See the def for the parity note.
      expect(run('round scoop bevel notch', { output: 'minimal' })).toEqual({
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
            property: 'cornerEndStartShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerEndEndShape',
            value: 'notch',
            origin: 'explicit',
          },
        ],
      });
    });

    it('replicates the two-value form onto the logical keys', () => {
      expect(run('round scoop', { output: 'minimal' })).toEqual({
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
            property: 'cornerEndStartShape',
            value: 'round',
            origin: 'replicated',
          },
          {
            property: 'cornerEndEndShape',
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
            property: 'cornerStartStartShape',
            value: 'var(--shape)',
            origin: 'explicit',
          },
          {
            property: 'cornerStartEndShape',
            value: 'bevel',
            origin: 'explicit',
          },
          {
            property: 'cornerEndStartShape',
            value: 'var(--shape)',
            origin: 'replicated',
          },
          {
            property: 'cornerEndEndShape',
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
