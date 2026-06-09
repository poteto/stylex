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
import { flexDef } from '../flex';

function run(value: string, options: EmitOptions): ExpandResult {
  return flexDef.run(new TokenList(value), options);
}

function expectParseError(result: ExpandResult) {
  expect(result.type).toEqual('cannot-expand');
  if (result.type === 'cannot-expand') {
    expect(result.reason.kind).toEqual('parse-error');
  }
}

describe('flex def', () => {
  describe('def metadata', () => {
    it('declares the grow/shrink/basis longhands', () => {
      expect(flexDef.key).toEqual('flex');
      expect(flexDef.canonical).toEqual('flex');
      expect(flexDef.longhands).toEqual([
        'flexGrow',
        'flexShrink',
        'flexBasis',
      ]);
      expect(flexDef.dialectMap).toEqual({});
    });

    it('keeps the single-component fast path and the number fast path', () => {
      expect(flexDef.singleComponentIsIdentity).toBe(true);
      expect(flexDef.runNumber).not.toBe(null);
    });
  });

  describe('keyword forms', () => {
    it("expands 'auto' to 1 1 auto, all replicated", () => {
      expect(run('auto', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '1', origin: 'replicated' },
          { property: 'flexShrink', value: '1', origin: 'replicated' },
          { property: 'flexBasis', value: 'auto', origin: 'replicated' },
        ],
      });
    });

    it("expands 'none' to 0 0 auto, all replicated", () => {
      expect(run('none', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '0', origin: 'replicated' },
          { property: 'flexShrink', value: '0', origin: 'replicated' },
          { property: 'flexBasis', value: 'auto', origin: 'replicated' },
        ],
      });
    });

    it("expands 'initial' to 0 1 auto, all replicated", () => {
      // Def-level only: the boundary's CSS-wide keyword pre-pass
      // intercepts 'flex: initial' before def.run and fans the keyword
      // itself out to the three longhands (spec-equivalent: their
      // initial values ARE 0 1 auto).
      expect(run('initial', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '0', origin: 'replicated' },
          { property: 'flexShrink', value: '1', origin: 'replicated' },
          { property: 'flexBasis', value: 'auto', origin: 'replicated' },
        ],
      });
    });

    it('matches keywords case-insensitively', () => {
      expect(run('AUTO', { output: 'spec' })).toEqual(
        run('auto', { output: 'spec' }),
      );
      expect(run('None', { output: 'spec' })).toEqual(
        run('none', { output: 'spec' }),
      );
    });

    it('emits the full trio for a keyword even in minimal output', () => {
      // The boundary fast-path no-ops single components in minimal mode,
      // so this is only reachable def-level; the keyword still means all
      // three longhands.
      expect(run('none', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '0', origin: 'replicated' },
          { property: 'flexShrink', value: '0', origin: 'replicated' },
          { property: 'flexBasis', value: 'auto', origin: 'replicated' },
        ],
      });
    });
  });

  describe('single-component forms', () => {
    it('expands a lone number to n 1 0%', () => {
      expect(run('2', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
      expect(run('0.5', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '0.5', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
    });

    it('sends a lone zero to grow, not basis', () => {
      expect(run('0', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '0', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
    });

    it('expands a lone basis to 1 1 b', () => {
      expect(run('30%', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '1', origin: 'defaulted' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: '30%', origin: 'explicit' },
        ],
      });
      expect(run('min-content', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '1', origin: 'defaulted' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: 'min-content', origin: 'explicit' },
        ],
      });
    });

    it('accepts fit-content() and math functions as a basis', () => {
      expect(run('fit-content(10px)', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '1', origin: 'defaulted' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          {
            property: 'flexBasis',
            value: 'fit-content(10px)',
            origin: 'explicit',
          },
        ],
      });
      expect(run('min(10px, 5%)', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '1', origin: 'defaulted' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: 'min(10px, 5%)', origin: 'explicit' },
        ],
      });
    });

    it('treats single non-keyword components as identity in minimal output', () => {
      expect(run('2', { output: 'minimal' })).toEqual({ type: 'no-op' });
      expect(run('30%', { output: 'minimal' })).toEqual({ type: 'no-op' });
    });
  });

  describe('two-component forms', () => {
    it('expands <number> <number> to grow shrink 0%', () => {
      expect(run('2 3', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '3', origin: 'explicit' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
    });

    it('expands <number> <basis> to grow 1 basis', () => {
      expect(run('2 30px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: '30px', origin: 'explicit' },
        ],
      });
      expect(run('2 auto', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: 'auto', origin: 'explicit' },
        ],
      });
    });

    it('sends a second zero to shrink, not basis', () => {
      expect(run('1 0', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '1', origin: 'explicit' },
          { property: 'flexShrink', value: '0', origin: 'explicit' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
    });

    it('emits the full trio in minimal output (the filled basis is load-bearing)', () => {
      expect(run('2 3', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '3', origin: 'explicit' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
    });
  });

  describe('three-component form', () => {
    it('expands <number> <number> <basis>, all explicit', () => {
      expect(run('2 1 10%', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'explicit' },
          { property: 'flexBasis', value: '10%', origin: 'explicit' },
        ],
      });
    });

    it('allows a unitless zero basis only here', () => {
      expect(run('2 1 0', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'explicit' },
          { property: 'flexBasis', value: '0', origin: 'explicit' },
        ],
      });
    });

    it('emits all three in minimal output', () => {
      expect(run('2 1 0%', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2', origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'explicit' },
          { property: 'flexBasis', value: '0%', origin: 'explicit' },
        ],
      });
    });

    it('keeps authored slices verbatim', () => {
      expect(run('2.0 1.50 30PX', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: '2.0', origin: 'explicit' },
          { property: 'flexShrink', value: '1.50', origin: 'explicit' },
          { property: 'flexBasis', value: '30PX', origin: 'explicit' },
        ],
      });
    });
  });

  describe('number fast path', () => {
    it('expands a number to n 1 0% in spec output', () => {
      const runNumber = flexDef.runNumber;
      if (runNumber == null) {
        throw new Error('expected flex to keep a number fast path');
      }
      expect(runNumber(2, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'flexGrow', value: 2, origin: 'explicit' },
          { property: 'flexShrink', value: '1', origin: 'defaulted' },
          { property: 'flexBasis', value: '0%', origin: 'defaulted' },
        ],
      });
      expect(runNumber(2, { output: 'minimal' })).toEqual({ type: 'no-op' });
    });
  });

  describe('refusals', () => {
    it('refuses a unitless non-zero basis', () => {
      expectParseError(run('2 1 1', { output: 'spec' }));
    });

    it('refuses basis-first multi-component forms like the old splitter', () => {
      expectParseError(run('auto 1', { output: 'spec' }));
      expectParseError(run('30px 1', { output: 'spec' }));
    });

    it('refuses more than three components', () => {
      expectParseError(run('1 2 0% 0%', { output: 'spec' }));
    });

    it('refuses var() in any slot as a plain parse error', () => {
      // The boundary reclassifies these as contains-variable when it sees
      // the top-level var(); the def itself has no var slot.
      expectParseError(run('var(--a) 1', { output: 'spec' }));
      expectParseError(run('1 var(--b)', { output: 'minimal' }));
      expectParseError(run('1 1 var(--c)', { output: 'spec' }));
    });

    it('refuses a fit-content() argument that is not a length-percentage', () => {
      expectParseError(run('fit-content(banana)', { output: 'spec' }));
    });

    it('refuses non-flex keywords and empty values', () => {
      expectParseError(run('stretch', { output: 'spec' }));
      expectParseError(run('', { output: 'spec' }));
    });
  });
});
