/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { EmitOptions, ExpandResult } from '../../shorthands/types';

import { TokenList } from '../../token-types';
import { fontDef } from '../font';

function run(value: string, options: EmitOptions): ExpandResult {
  return fontDef.run(new TokenList(value), options);
}

function expectParseError(result: ExpandResult, message?: RegExp) {
  expect(result.type).toEqual('cannot-expand');
  if (result.type === 'cannot-expand') {
    expect(result.reason.kind).toEqual('parse-error');
    if (message != null && result.reason.kind === 'parse-error') {
      expect(result.reason.message).toMatch(message);
    }
  }
}

function expectUnsupported(result: ExpandResult, feature: string) {
  expect(result).toEqual({
    type: 'cannot-expand',
    reason: { kind: 'unsupported-feature', feature },
  });
}

describe('font def', () => {
  describe('def metadata', () => {
    it('declares the six longhands in spec order', () => {
      expect(fontDef.key).toEqual('font');
      expect(fontDef.canonical).toEqual('font');
      expect(fontDef.longhands).toEqual([
        'fontStyle',
        'fontVariant',
        'fontWeight',
        'fontSize',
        'lineHeight',
        'fontFamily',
      ]);
      expect(fontDef.dialectMap).toEqual({});
    });

    it('has no number fast path and keeps the single-component fast path', () => {
      expect(fontDef.runNumber).toBe(null);
      expect(fontDef.singleComponentIsIdentity).toBe(true);
    });
  });

  describe('spec output', () => {
    it('expands the full prefix + size/line-height + family form', () => {
      expect(run('italic bold 12px/30px serif', { output: 'spec' })).toEqual({
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
    });

    it("defaults style, variant, weight, and line-height to 'normal'", () => {
      expect(run('12px serif', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontStyle', value: 'normal', origin: 'defaulted' },
          { property: 'fontVariant', value: 'normal', origin: 'defaulted' },
          { property: 'fontWeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('accepts the prefix in any order', () => {
      const expected = run('italic small-caps bold 12px serif', {
        output: 'spec',
      });
      expect(expected.type).toEqual('ok');
      for (const permutation of [
        'italic bold small-caps 12px serif',
        'bold italic small-caps 12px serif',
        'small-caps bold italic 12px serif',
      ]) {
        expect(run(permutation, { output: 'spec' })).toEqual(expected);
      }
    });
  });

  describe("the 'normal' prefix keyword", () => {
    it('fills the first unfilled of style -> variant -> weight', () => {
      expect(run('normal 12px serif', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontStyle', value: 'normal', origin: 'explicit' },
          { property: 'fontVariant', value: 'normal', origin: 'defaulted' },
          { property: 'fontWeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('falls through to variant once style is filled', () => {
      expect(run('italic normal 12px serif', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontStyle', value: 'italic', origin: 'explicit' },
          { property: 'fontVariant', value: 'normal', origin: 'explicit' },
          { property: 'fontWeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('refuses a fourth normal once all three slots are filled', () => {
      expectParseError(
        run('normal normal normal normal 12px serif', { output: 'spec' }),
      );
    });
  });

  describe('weights', () => {
    it('accepts keyword and numeric weights 100-900', () => {
      for (const weight of ['bolder', 'lighter', '100', '550', '900']) {
        const result = run(`${weight} 12px serif`, { output: 'spec' });
        expect(result.type).toEqual('ok');
        if (result.type === 'ok') {
          expect(result.assignments[2]).toEqual({
            property: 'fontWeight',
            value: weight,
            origin: 'explicit',
          });
        }
      }
    });

    it('refuses numeric weights outside 100-900', () => {
      expectParseError(run('50 12px serif', { output: 'spec' }));
      expectParseError(run('950 12px serif', { output: 'spec' }));
    });
  });

  describe('sizes and line-heights', () => {
    it('accepts size keywords case-insensitively, slices verbatim', () => {
      expect(run('X-LARGE serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: 'X-LARGE', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
      expect(run('smaller serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: 'smaller', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('accepts math functions as the size', () => {
      expect(run('calc(1em + 2px) serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'fontSize',
            value: 'calc(1em + 2px)',
            origin: 'explicit',
          },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('takes the component after a slash as the line-height', () => {
      // '12px/1.5' is THREE top-level components (size, slash, number):
      // no re-split machinery, just a slash check after the size.
      expect(run('12px/1.5 serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: '1.5', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
      expect(run('12px / 120% serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: '120%', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
      expect(run('12px/normal serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: 'normal', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });
  });

  describe('families', () => {
    it('joins remaining components with single spaces', () => {
      expect(run('12px Helvetica Neue', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          {
            property: 'fontFamily',
            value: 'Helvetica Neue',
            origin: 'explicit',
          },
        ],
      });
    });

    it('keeps quoted names and comma runs byte-for-byte', () => {
      expect(
        run('12px "Helvetica Neue", serif', { output: 'minimal' }),
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
      expect(run('12px Arial,serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'fontFamily', value: 'Arial,serif', origin: 'explicit' },
        ],
      });
    });
  });

  describe('minimal output', () => {
    it('emits authored slots only (plain origin filter)', () => {
      expect(run('italic bold 12px/30px serif', { output: 'minimal' })).toEqual(
        {
          type: 'ok',
          important: false,
          assignments: [
            { property: 'fontStyle', value: 'italic', origin: 'explicit' },
            { property: 'fontWeight', value: 'bold', origin: 'explicit' },
            { property: 'fontSize', value: '12px', origin: 'explicit' },
            { property: 'lineHeight', value: '30px', origin: 'explicit' },
            { property: 'fontFamily', value: 'serif', origin: 'explicit' },
          ],
        },
      );
    });
  });

  describe('unsupported features', () => {
    it('refuses system font keywords as a typed unsupported-feature', () => {
      for (const keyword of [
        'caption',
        'icon',
        'menu',
        'message-box',
        'small-caption',
        'status-bar',
      ]) {
        expectUnsupported(run(keyword, { output: 'spec' }), 'system-font');
      }
    });

    it('matches system keywords case-insensitively, in both modes', () => {
      expectUnsupported(run('MENU', { output: 'spec' }), 'system-font');
      // Def-level only: at the boundary, minimal mode fast-paths the
      // single component to a no-op before the grammar runs.
      expectUnsupported(run('menu', { output: 'minimal' }), 'system-font');
    });

    it('only treats a SOLE system keyword as a system font', () => {
      expectParseError(run('menu serif', { output: 'spec' }));
    });
  });

  describe("the 'oblique <angle>' style", () => {
    it('joins the pair into one fontStyle value in both modes', () => {
      expect(run('oblique 45deg 12px serif', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'fontStyle',
            value: 'oblique 45deg',
            origin: 'explicit',
          },
          { property: 'fontVariant', value: 'normal', origin: 'defaulted' },
          { property: 'fontWeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'lineHeight', value: 'normal', origin: 'defaulted' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
      expect(run('oblique 45deg 12px serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'fontStyle',
            value: 'oblique 45deg',
            origin: 'explicit',
          },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('combines with the other prefix slots', () => {
      expect(
        run('oblique 30deg small-caps bold 12px serif', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'fontStyle',
            value: 'oblique 30deg',
            origin: 'explicit',
          },
          {
            property: 'fontVariant',
            value: 'small-caps',
            origin: 'explicit',
          },
          { property: 'fontWeight', value: 'bold', origin: 'explicit' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });

    it('does not validate the angle range', () => {
      // Range enforcement (font-style caps the slant at +/-90deg) is the
      // longhand grammar's job, not this relocation layer's.
      const result = run('oblique 120deg 12px serif', { output: 'minimal' });
      expect(result.type).toEqual('ok');
      if (result.type === 'ok') {
        expect(result.assignments[0]).toEqual({
          property: 'fontStyle',
          value: 'oblique 120deg',
          origin: 'explicit',
        });
      }
      const negative = run('oblique -30deg 12px serif', { output: 'minimal' });
      expect(negative.type).toEqual('ok');
      if (negative.type === 'ok') {
        expect(negative.assignments[0]).toEqual({
          property: 'fontStyle',
          value: 'oblique -30deg',
          origin: 'explicit',
        });
      }
    });

    it("accepts plain 'oblique' as a style", () => {
      expect(run('oblique 12px serif', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'fontStyle', value: 'oblique', origin: 'explicit' },
          { property: 'fontSize', value: '12px', origin: 'explicit' },
          { property: 'fontFamily', value: 'serif', origin: 'explicit' },
        ],
      });
    });
  });

  describe('refusals', () => {
    it('requires a size', () => {
      expectParseError(run('bold', { output: 'spec' }), /font-size/);
      expectParseError(
        run('italic bold serif', { output: 'spec' }),
        /Unexpected component/,
      );
    });

    it('requires a family after the size', () => {
      expectParseError(run('12px', { output: 'spec' }), /font-family/);
      expectParseError(run('12px/1.5', { output: 'spec' }), /font-family/);
    });

    it('requires a line-height after a slash', () => {
      expectParseError(run('12px/ serif', { output: 'spec' }), /line-height/);
      expectParseError(run('12px/', { output: 'spec' }), /line-height/);
    });

    it('reports duplicate prefix slots', () => {
      expectParseError(
        run('italic oblique 12px serif', { output: 'spec' }),
        /Duplicate style/,
      );
      expectParseError(
        run('bold 700 12px serif', { output: 'spec' }),
        /Duplicate weight/,
      );
    });

    it('refuses var() components as plain parse errors', () => {
      // The boundary reclassifies these as contains-variable.
      expectParseError(run('var(--style) 12px serif', { output: 'spec' }));
      expectParseError(run('italic var(--size) serif', { output: 'spec' }));
    });

    it('refuses an empty value', () => {
      expectParseError(run('', { output: 'spec' }), /at least one component/);
    });
  });
});
