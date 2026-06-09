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
import { animationDef } from '../animation';

function run(value: string, options: EmitOptions): ExpandResult {
  return animationDef.run(new TokenList(value), options);
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

describe('animation def', () => {
  describe('def metadata', () => {
    it('declares the eight longhands in the old emit order', () => {
      expect(animationDef.key).toEqual('animation');
      expect(animationDef.canonical).toEqual('animation');
      expect(animationDef.longhands).toEqual([
        'animationDuration',
        'animationTimingFunction',
        'animationDelay',
        'animationIterationCount',
        'animationDirection',
        'animationFillMode',
        'animationPlayState',
        'animationName',
      ]);
      expect(animationDef.dialectMap).toEqual({});
    });

    it('has no number fast path and keeps the single-component fast path', () => {
      expect(animationDef.runNumber).toBe(null);
      expect(animationDef.singleComponentIsIdentity).toBe(true);
    });
  });

  describe('spec output', () => {
    it('expands a six-component layer, defaulting fill-mode and play-state', () => {
      expect(
        run('2s ease-in 0.5s infinite alternate slidein', { output: 'spec' }),
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
          { property: 'animationFillMode', value: 'none', origin: 'defaulted' },
          {
            property: 'animationPlayState',
            value: 'running',
            origin: 'defaulted',
          },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
    });

    it('defaults every omitted slot to its initial value', () => {
      expect(run('slidein', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '0s', origin: 'defaulted' },
          {
            property: 'animationTimingFunction',
            value: 'ease',
            origin: 'defaulted',
          },
          { property: 'animationDelay', value: '0s', origin: 'defaulted' },
          {
            property: 'animationIterationCount',
            value: '1',
            origin: 'defaulted',
          },
          {
            property: 'animationDirection',
            value: 'normal',
            origin: 'defaulted',
          },
          { property: 'animationFillMode', value: 'none', origin: 'defaulted' },
          {
            property: 'animationPlayState',
            value: 'running',
            origin: 'defaulted',
          },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
    });
  });

  describe('minimal output', () => {
    it('emits authored slots only (plain origin filter)', () => {
      expect(
        run('2s ease-in 0.5s infinite alternate slidein', {
          output: 'minimal',
        }),
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
  });

  describe('time components are positional', () => {
    it('assigns the first time to duration and the second to delay', () => {
      expect(run('1s 2s slidein', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          { property: 'animationDelay', value: '2s', origin: 'explicit' },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
    });

    it('accepts ms, negative, and decimal times, case-insensitively', () => {
      expect(run('500MS -0.5s slidein', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '500MS', origin: 'explicit' },
          { property: 'animationDelay', value: '-0.5s', origin: 'explicit' },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
    });

    it('refuses a third time component', () => {
      expectParseError(run('1s 2s 3s', { output: 'spec' }), /[Tt]oo many time/);
    });
  });

  describe('timing-function slot', () => {
    it('accepts every keyword', () => {
      for (const timing of [
        'ease',
        'ease-in',
        'ease-out',
        'ease-in-out',
        'linear',
        'step-start',
        'step-end',
      ]) {
        expect(run(`1s ${timing}`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            { property: 'animationDuration', value: '1s', origin: 'explicit' },
            {
              property: 'animationTimingFunction',
              value: timing,
              origin: 'explicit',
            },
          ],
        });
      }
    });

    it('accepts timing functions, balanced and verbatim', () => {
      for (const timing of [
        'cubic-bezier(0.1, 0.7, 1, 0.1)',
        'steps(4, end)',
        'linear(0, 0.5 50%, 1)',
        'CUBIC-BEZIER(0, 0, 1, 1)',
      ]) {
        expect(run(`1s ${timing} slidein`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            { property: 'animationDuration', value: '1s', origin: 'explicit' },
            {
              property: 'animationTimingFunction',
              value: timing,
              origin: 'explicit',
            },
            { property: 'animationName', value: 'slidein', origin: 'explicit' },
          ],
        });
      }
    });
  });

  describe('keyword slots', () => {
    it('classifies iteration counts, directions, fill modes, and play states', () => {
      expect(
        run('1s 2.5 alternate-reverse both paused slidein', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          {
            property: 'animationIterationCount',
            value: '2.5',
            origin: 'explicit',
          },
          {
            property: 'animationDirection',
            value: 'alternate-reverse',
            origin: 'explicit',
          },
          { property: 'animationFillMode', value: 'both', origin: 'explicit' },
          {
            property: 'animationPlayState',
            value: 'paused',
            origin: 'explicit',
          },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
    });

    it("accepts 'infinite' and bare non-negative numbers as iteration counts", () => {
      for (const count of ['infinite', '3', '.5']) {
        const result = run(`1s ${count}`, { output: 'minimal' });
        expect(result.type).toEqual('ok');
        if (result.type === 'ok') {
          expect(result.assignments[1]).toEqual({
            property: 'animationIterationCount',
            value: count,
            origin: 'explicit',
          });
        }
      }
    });

    it('refuses negative iteration counts (a number is never a name)', () => {
      expectParseError(
        run('1s -1', { output: 'minimal' }),
        /Unexpected component/,
      );
    });
  });

  describe('name slot', () => {
    it('takes a custom-ident as the last resort, case preserved', () => {
      expect(run('1s slideIn', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          { property: 'animationName', value: 'slideIn', origin: 'explicit' },
        ],
      });
    });

    it('sends slot keywords to their slots before the name', () => {
      // 'reverse' fills direction, so the later ident must be the name.
      expect(run('1s reverse spin', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          {
            property: 'animationDirection',
            value: 'reverse',
            origin: 'explicit',
          },
          { property: 'animationName', value: 'spin', origin: 'explicit' },
        ],
      });
    });

    it('refuses CSS-wide keywords as names', () => {
      for (const keyword of [
        'inherit',
        'initial',
        'unset',
        'revert',
        'revert-layer',
      ]) {
        expectParseError(run(`1s ${keyword}`, { output: 'minimal' }));
      }
    });

    it('refuses quoted strings as names (custom-ident only)', () => {
      expectParseError(
        run('1s "slidein"', { output: 'minimal' }),
        /Unexpected component/,
      );
    });
  });

  describe("the none-name rule (old splitter's 808-813)", () => {
    it("reassigns a bare fill-mode 'none' to the name when the name is open", () => {
      expect(run('none', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '0s', origin: 'defaulted' },
          {
            property: 'animationTimingFunction',
            value: 'ease',
            origin: 'defaulted',
          },
          { property: 'animationDelay', value: '0s', origin: 'defaulted' },
          {
            property: 'animationIterationCount',
            value: '1',
            origin: 'defaulted',
          },
          {
            property: 'animationDirection',
            value: 'normal',
            origin: 'defaulted',
          },
          { property: 'animationFillMode', value: 'none', origin: 'defaulted' },
          {
            property: 'animationPlayState',
            value: 'running',
            origin: 'defaulted',
          },
          { property: 'animationName', value: 'none', origin: 'explicit' },
        ],
      });
    });

    it('relocates the verbatim slice, matched case-insensitively', () => {
      expect(run('1s NONE', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          { property: 'animationName', value: 'NONE', origin: 'explicit' },
        ],
      });
    });

    it("keeps an explicit fill-mode that is not 'none' in place", () => {
      expect(run('1s forwards', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          {
            property: 'animationFillMode',
            value: 'forwards',
            origin: 'explicit',
          },
        ],
      });
    });

    it("keeps 'none' on fill-mode when the name is already taken", () => {
      expect(run('1s none slidein', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          { property: 'animationFillMode', value: 'none', origin: 'explicit' },
          { property: 'animationName', value: 'slidein', origin: 'explicit' },
        ],
      });
    });
  });

  describe('var() placement', () => {
    it('fills the one open slot by elimination', () => {
      expect(
        run('1s ease 2s 3 normal both running var(--n)', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'animationDuration', value: '1s', origin: 'explicit' },
          {
            property: 'animationTimingFunction',
            value: 'ease',
            origin: 'explicit',
          },
          { property: 'animationDelay', value: '2s', origin: 'explicit' },
          {
            property: 'animationIterationCount',
            value: '3',
            origin: 'explicit',
          },
          {
            property: 'animationDirection',
            value: 'normal',
            origin: 'explicit',
          },
          { property: 'animationFillMode', value: 'both', origin: 'explicit' },
          {
            property: 'animationPlayState',
            value: 'running',
            origin: 'explicit',
          },
          { property: 'animationName', value: 'var(--n)', origin: 'explicit' },
        ],
      });
    });

    it('refuses a var() when several slots are open', () => {
      // The boundary reclassifies these parse errors as contains-variable.
      expectParseError(
        run('1s var(--x)', { output: 'minimal' }),
        /slot elimination/,
      );
    });
  });

  describe('multiple layers', () => {
    it('comma-joins every longhand across two layers in spec output', () => {
      expect(run('slidein 3s, fadeout 2s', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'animationDuration',
            value: '3s, 2s',
            origin: 'explicit',
          },
          {
            property: 'animationTimingFunction',
            value: 'ease, ease',
            origin: 'defaulted',
          },
          { property: 'animationDelay', value: '0s, 0s', origin: 'defaulted' },
          {
            property: 'animationIterationCount',
            value: '1, 1',
            origin: 'defaulted',
          },
          {
            property: 'animationDirection',
            value: 'normal, normal',
            origin: 'defaulted',
          },
          {
            property: 'animationFillMode',
            value: 'none, none',
            origin: 'defaulted',
          },
          {
            property: 'animationPlayState',
            value: 'running, running',
            origin: 'defaulted',
          },
          {
            property: 'animationName',
            value: 'slidein, fadeout',
            origin: 'explicit',
          },
        ],
      });
    });

    it('emits symmetric authored slots joined verbatim in minimal output', () => {
      expect(run('slidein 3s, fadeout 2s', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'animationDuration',
            value: '3s, 2s',
            origin: 'explicit',
          },
          {
            property: 'animationName',
            value: 'slidein, fadeout',
            origin: 'explicit',
          },
        ],
      });
      expect(
        run('spin 1s linear infinite, pulse 2s ease-in 3', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'animationDuration',
            value: '1s, 2s',
            origin: 'explicit',
          },
          {
            property: 'animationTimingFunction',
            value: 'linear, ease-in',
            origin: 'explicit',
          },
          {
            property: 'animationIterationCount',
            value: 'infinite, 3',
            origin: 'explicit',
          },
          {
            property: 'animationName',
            value: 'spin, pulse',
            origin: 'explicit',
          },
        ],
      });
    });

    it('splits layers on glued commas (no whitespace)', () => {
      expect(run('slidein,fadeout', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'animationName',
            value: 'slidein, fadeout',
            origin: 'explicit',
          },
        ],
      });
    });

    it('refuses asymmetric authorship in minimal output only', () => {
      // The MDN two-animation example: only the second layer has a delay.
      const value = '3s linear slidein, 3s ease-out 5s slideout';
      expect(run(value, { output: 'minimal' })).toEqual({
        type: 'cannot-expand',
        reason: { kind: 'unsupported-feature', feature: 'asymmetric-layers' },
      });
      const spec = run(value, { output: 'spec' });
      expect(spec.type).toEqual('ok');
      if (spec.type === 'ok') {
        expect(spec.assignments[2]).toEqual({
          property: 'animationDelay',
          value: '0s, 5s',
          origin: 'explicit',
        });
      }
    });

    it('applies the none-name rule per layer', () => {
      // Each layer's bare 'none' relocates to that layer's name slot.
      expect(run('1s none, 2s NONE', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'animationDuration',
            value: '1s, 2s',
            origin: 'explicit',
          },
          {
            property: 'animationName',
            value: 'none, NONE',
            origin: 'explicit',
          },
        ],
      });
      // A layer whose name is already taken keeps its 'none' on
      // fill-mode, exactly like the single-layer rule -- here making
      // fill-mode asymmetric with the second layer, which omits it.
      expect(run('1s none slidein, 2s fadeout', { output: 'minimal' })).toEqual(
        {
          type: 'cannot-expand',
          reason: {
            kind: 'unsupported-feature',
            feature: 'asymmetric-layers',
          },
        },
      );
    });

    it('refuses empty layers (leading, trailing, doubled commas)', () => {
      for (const value of [', slidein 1s', 'slidein 1s,', '1s, , 2s']) {
        expectParseError(run(value, { output: 'spec' }), /Empty animation/);
      }
    });

    it('reports per-layer slot errors', () => {
      expectParseError(
        run('1s 2s 3s, fadeout', { output: 'spec' }),
        /[Tt]oo many time/,
      );
      expectParseError(
        run('slidein 1s, fadeout inherit', { output: 'spec' }),
        /Unexpected component/,
      );
    });

    it('keeps function-nested commas inert', () => {
      expect(
        run('1s cubic-bezier(0.1, 0.7, 1, 0.1)', { output: 'minimal' }).type,
      ).toEqual('ok');
    });
  });

  describe('refusals', () => {
    it('reports a component no open slot accepts', () => {
      expectParseError(
        run('1s slidein fadeout', { output: 'minimal' }),
        /Duplicate name/,
      );
    });

    it('refuses an empty value', () => {
      expectParseError(run('', { output: 'spec' }), /at least one component/);
    });
  });
});
