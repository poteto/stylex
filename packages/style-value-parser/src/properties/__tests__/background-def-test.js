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
import { backgroundDef } from '../background';

function run(value: string, options: EmitOptions): ExpandResult {
  return backgroundDef.run(new TokenList(value), options);
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

describe('background def', () => {
  describe('def metadata', () => {
    it('declares the six longhands in the old emit order', () => {
      expect(backgroundDef.key).toEqual('background');
      expect(backgroundDef.canonical).toEqual('background');
      expect(backgroundDef.longhands).toEqual([
        'backgroundColor',
        'backgroundImage',
        'backgroundRepeat',
        'backgroundAttachment',
        'backgroundPosition',
        'backgroundSize',
      ]);
      expect(backgroundDef.dialectMap).toEqual({});
    });

    it('has no number fast path and keeps the single-component fast path', () => {
      expect(backgroundDef.runNumber).toBe(null);
      expect(backgroundDef.singleComponentIsIdentity).toBe(true);
    });
  });

  describe('spec output', () => {
    it('expands a full layer, defaulting only the omitted attachment', () => {
      expect(
        run('red url(a.png) no-repeat center / cover', { output: 'spec' }),
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
    });

    it('defaults every omitted slot to its initial value', () => {
      expect(run('url(a.png) fixed', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'backgroundColor',
            value: 'transparent',
            origin: 'defaulted',
          },
          {
            property: 'backgroundImage',
            value: 'url(a.png)',
            origin: 'explicit',
          },
          {
            property: 'backgroundRepeat',
            value: 'repeat',
            origin: 'defaulted',
          },
          {
            property: 'backgroundAttachment',
            value: 'fixed',
            origin: 'explicit',
          },
          {
            property: 'backgroundPosition',
            value: '0% 0%',
            origin: 'defaulted',
          },
          { property: 'backgroundSize', value: 'auto', origin: 'defaulted' },
        ],
      });
    });

    it('classifies components independent of authored order', () => {
      const expected = run('red url(a.png) no-repeat scroll', {
        output: 'spec',
      });
      expect(expected.type).toEqual('ok');
      for (const permutation of [
        'url(a.png) red scroll no-repeat',
        'no-repeat scroll url(a.png) red',
        'scroll red no-repeat url(a.png)',
      ]) {
        expect(run(permutation, { output: 'spec' })).toEqual(expected);
      }
    });
  });

  describe('minimal output', () => {
    it('emits authored slots only (plain origin filter)', () => {
      expect(
        run('red url(a.png) no-repeat center / cover', { output: 'minimal' }),
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
  });

  describe('image slot', () => {
    it("classifies 'none' as the image, never the color", () => {
      expect(run('none red', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'backgroundColor', value: 'red', origin: 'explicit' },
          { property: 'backgroundImage', value: 'none', origin: 'explicit' },
        ],
      });
    });

    it('accepts quoted-url and image functions, balanced and verbatim', () => {
      for (const image of [
        'url("a b.png")',
        'image-set("a.png" 1x, "b.png" 2x)',
        'linear-gradient(to right, rgb(0, 0, 0), blue)',
        'radial-gradient(circle, red, blue)',
        'conic-gradient(from 90deg, red, blue)',
        'repeating-linear-gradient(45deg, red, blue 10px)',
        'repeating-radial-gradient(red, blue 10px)',
        'repeating-conic-gradient(red, blue 30deg)',
        'cross-fade(url(a.png), url(b.png), 50%)',
        'element(#canvas)',
      ]) {
        expect(run(`${image} red`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            { property: 'backgroundColor', value: 'red', origin: 'explicit' },
            { property: 'backgroundImage', value: image, origin: 'explicit' },
          ],
        });
      }
    });

    it('matches image function names case-insensitively', () => {
      expect(run('LINEAR-GRADIENT(red, blue)', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: expect.arrayContaining([
          {
            property: 'backgroundImage',
            value: 'LINEAR-GRADIENT(red, blue)',
            origin: 'explicit',
          },
        ]),
      });
    });
  });

  describe('repeat, attachment, and color slots', () => {
    it('accepts every repeat keyword', () => {
      for (const repeat of [
        'repeat',
        'repeat-x',
        'repeat-y',
        'no-repeat',
        'space',
        'round',
      ]) {
        expect(run(`url(a.png) ${repeat}`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            {
              property: 'backgroundImage',
              value: 'url(a.png)',
              origin: 'explicit',
            },
            { property: 'backgroundRepeat', value: repeat, origin: 'explicit' },
          ],
        });
      }
    });

    it('accepts every attachment keyword', () => {
      for (const attachment of ['scroll', 'fixed', 'local']) {
        const result = run(`url(a.png) ${attachment}`, { output: 'minimal' });
        expect(result.type).toEqual('ok');
        if (result.type === 'ok') {
          expect(result.assignments[1]).toEqual({
            property: 'backgroundAttachment',
            value: attachment,
            origin: 'explicit',
          });
        }
      }
    });

    it('accepts named, hash, functional, and currentcolor colors', () => {
      for (const color of ['red', '#f0f', 'rgb(1, 2, 3)', 'CURRENTCOLOR']) {
        expect(run(`${color} no-repeat`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            { property: 'backgroundColor', value: color, origin: 'explicit' },
            {
              property: 'backgroundRepeat',
              value: 'no-repeat',
              origin: 'explicit',
            },
          ],
        });
      }
    });

    it('classifies modern color functions to the color slot by name', () => {
      for (const color of [
        'oklch(0.6 0.1 240)',
        'oklab(0.4 0.1 0.2)',
        'hwb(120 20% 30%)',
        'color(display-p3 1 0.5 0)',
      ]) {
        expect(run(`${color} no-repeat`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            { property: 'backgroundColor', value: color, origin: 'explicit' },
            {
              property: 'backgroundRepeat',
              value: 'no-repeat',
              origin: 'explicit',
            },
          ],
        });
      }
    });
  });

  describe('position slot', () => {
    it('accepts keywords, length-percentages, and math functions', () => {
      for (const position of [
        'left',
        'bottom',
        'center',
        '25%',
        '10px',
        'calc(50% - 10px)',
      ]) {
        expect(run(`url(a.png) ${position}`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            {
              property: 'backgroundImage',
              value: 'url(a.png)',
              origin: 'explicit',
            },
            {
              property: 'backgroundPosition',
              value: position,
              origin: 'explicit',
            },
          ],
        });
      }
    });

    it('consumes an adjacent pair greedily, joined with a single space', () => {
      expect(run('url(a.png) center   top', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'backgroundImage',
            value: 'url(a.png)',
            origin: 'explicit',
          },
          {
            property: 'backgroundPosition',
            value: 'center top',
            origin: 'explicit',
          },
        ],
      });
      expect(run('left 10px red', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'backgroundColor', value: 'red', origin: 'explicit' },
          {
            property: 'backgroundPosition',
            value: 'left 10px',
            origin: 'explicit',
          },
        ],
      });
    });

    it('takes a single component when the next one is not position-ish', () => {
      expect(run('center no-repeat', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
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
        ],
      });
    });

    it('refuses a third position component (the pair is maximal)', () => {
      expectParseError(
        run('left top center', { output: 'minimal' }),
        /Duplicate position/,
      );
      // Non-adjacent position components never merge across other slots
      // (the old splitter reordered them into one position; we refuse).
      expectParseError(
        run('left no-repeat top', { output: 'minimal' }),
        /Duplicate position/,
      );
    });
  });

  describe('size after a slash', () => {
    it('parses one or two size components, joined with a single space', () => {
      expect(run('center/cover', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'backgroundPosition',
            value: 'center',
            origin: 'explicit',
          },
          { property: 'backgroundSize', value: 'cover', origin: 'explicit' },
        ],
      });
      expect(run('center / 100%  auto', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'backgroundPosition',
            value: 'center',
            origin: 'explicit',
          },
          {
            property: 'backgroundSize',
            value: '100% auto',
            origin: 'explicit',
          },
        ],
      });
      expect(run('left top / contain', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'backgroundPosition',
            value: 'left top',
            origin: 'explicit',
          },
          { property: 'backgroundSize', value: 'contain', origin: 'explicit' },
        ],
      });
    });

    it('requires a preceding position before the slash', () => {
      expectParseError(
        run('url(a.png) / cover', { output: 'minimal' }),
        /preceding position/,
      );
    });

    it('requires a size after the slash and refuses a second slash', () => {
      expectParseError(
        run('center /', { output: 'minimal' }),
        /background-size/,
      );
      expectParseError(
        run('center / cover / contain', { output: 'minimal' }),
        /Duplicate background-size/,
      );
    });
  });

  describe('multiple layers', () => {
    it('refuses top-level commas as multiple-layers', () => {
      for (const value of [
        'url(a.png), url(b.png)',
        'url(a.png),url(b.png)',
        'red, blue',
      ]) {
        expect(run(value, { output: 'spec' })).toEqual({
          type: 'cannot-expand',
          reason: { kind: 'multiple-layers' },
        });
        expect(run(value, { output: 'minimal' })).toEqual({
          type: 'cannot-expand',
          reason: { kind: 'multiple-layers' },
        });
      }
    });

    it('keeps function-nested commas inert', () => {
      expect(
        run('linear-gradient(red, blue) no-repeat', { output: 'minimal' }).type,
      ).toEqual('ok');
    });
  });

  describe('box keywords', () => {
    it('refuses origin/clip box keywords as a typed unsupported-feature', () => {
      for (const value of [
        'content-box red',
        'red padding-box',
        'border-box',
      ]) {
        expect(run(value, { output: 'spec' })).toEqual({
          type: 'cannot-expand',
          reason: {
            kind: 'unsupported-feature',
            feature: 'background-box-values',
          },
        });
      }
    });
  });

  describe('var() placement', () => {
    it('fills the one open single-component slot by elimination', () => {
      expect(
        run('url(a.png) no-repeat scroll var(--c)', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'backgroundColor',
            value: 'var(--c)',
            origin: 'explicit',
          },
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
            origin: 'explicit',
          },
        ],
      });
    });

    it('refuses a var() when several single-component slots are open', () => {
      // The boundary reclassifies these parse errors as contains-variable.
      expectParseError(
        run('red var(--i)', { output: 'minimal' }),
        /slot elimination/,
      );
    });

    it('never assigns a var() to the position or size pair slots', () => {
      // All four single-component slots are filled, position alone is
      // open; a pair slot cannot take a var() by elimination.
      expectParseError(
        run('red url(a.png) no-repeat scroll var(--p)', {
          output: 'minimal',
        }),
        /slot elimination/,
      );
    });
  });

  describe('refusals', () => {
    it('refuses unknown idents instead of guessing color (old fallthrough)', () => {
      expectParseError(
        run('foobar url(a.png)', { output: 'minimal' }),
        /Unexpected component/,
      );
    });

    it('reports duplicate slots', () => {
      expectParseError(
        run('red blue', { output: 'minimal' }),
        /Duplicate color/,
      );
      expectParseError(
        run('url(a.png) url(b.png)', { output: 'minimal' }),
        /Duplicate image/,
      );
      expectParseError(
        run('repeat repeat-x', { output: 'minimal' }),
        /Duplicate repeat/,
      );
      expectParseError(
        run('scroll fixed', { output: 'minimal' }),
        /Duplicate attachment/,
      );
      expectParseError(
        run('none none', { output: 'minimal' }),
        /Duplicate image/,
      );
    });

    it('refuses an empty value', () => {
      expectParseError(run('', { output: 'spec' }), /at least one component/);
    });
  });
});
