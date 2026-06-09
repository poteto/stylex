/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { CSSToken } from '@csstools/css-tokenizer';

import { TokenList } from '../../token-types';
import {
  countTopLevelComponents,
  hasTopLevelComma,
  splitTopLevelComponents,
} from '../css-wide';

function tokensOf(css: string): ReadonlyArray<CSSToken> {
  return new TokenList(css).getAllTokens();
}

/** The verbatim text of each component range, for readable assertions. */
function componentTexts(css: string): ReadonlyArray<string> {
  const tokens = tokensOf(css);
  return splitTopLevelComponents(tokens).map(({ start, end }) =>
    tokens
      .slice(start, end)
      .map((token) => token[1])
      .join(''),
  );
}

describe('splitTopLevelComponents', () => {
  it('splits maximal non-whitespace runs at depth 0', () => {
    expect(componentTexts('10px')).toEqual(['10px']);
    expect(componentTexts('10px   20px')).toEqual(['10px', '20px']);
    expect(componentTexts('  1px 2px 3px 4px ')).toEqual([
      '1px',
      '2px',
      '3px',
      '4px',
    ]);
  });

  it('treats a top-level slash as a boundary and its own component', () => {
    expect(componentTexts('10px/20px')).toEqual(['10px', '/', '20px']);
    expect(componentTexts('10px / 20px')).toEqual(['10px', '/', '20px']);
    expect(componentTexts('1px 2px/3px')).toEqual(['1px', '2px', '/', '3px']);
  });

  it('keeps function interiors (whitespace, slashes) in one component', () => {
    expect(componentTexts('calc( 1px / 2 )')).toEqual(['calc( 1px / 2 )']);
    expect(componentTexts('var(--a, 1px 2px) solid')).toEqual([
      'var(--a, 1px 2px)',
      'solid',
    ]);
  });

  it('does not treat commas as boundaries (they stay inside runs)', () => {
    expect(componentTexts('a, b')).toEqual(['a,', 'b']);
  });

  it('treats comments like whitespace at depth 0', () => {
    expect(componentTexts('10px/* note */20px')).toEqual(['10px', '20px']);
  });

  it('returns no components for empty or whitespace-only input', () => {
    expect(componentTexts('')).toEqual([]);
    expect(componentTexts('   ')).toEqual([]);
  });
});

describe('hasTopLevelComma', () => {
  it('detects a comma at nesting depth 0', () => {
    expect(hasTopLevelComma(tokensOf('url(a.png), url(b.png)'))).toBe(true);
    expect(hasTopLevelComma(tokensOf('a,b'))).toBe(true);
    expect(hasTopLevelComma(tokensOf('slidein, 3s'))).toBe(true);
  });

  it('ignores commas nested inside functions', () => {
    expect(hasTopLevelComma(tokensOf('rgb(0, 0, 0)'))).toBe(false);
    expect(hasTopLevelComma(tokensOf('var(--a, red)'))).toBe(false);
    expect(hasTopLevelComma(tokensOf('cubic-bezier(0.1, 0.7, 1, 0.1)'))).toBe(
      false,
    );
  });

  it('returns false when there is no comma at all', () => {
    expect(hasTopLevelComma(tokensOf('url(a.png) no-repeat'))).toBe(false);
    expect(hasTopLevelComma(tokensOf(''))).toBe(false);
  });
});

describe('countTopLevelComponents', () => {
  it('derives from the component split', () => {
    for (const css of ['10px', '10px 20px', '10px/20px', 'calc(1px + 2%)']) {
      expect(countTopLevelComponents(tokensOf(css))).toEqual(
        splitTopLevelComponents(tokensOf(css)).length,
      );
    }
  });

  it('counts a no-whitespace slash form as three components', () => {
    // The load-bearing case: the minimal-mode fast path must not swallow
    // 'border-radius: 10px/20px' as a single component.
    expect(countTopLevelComponents(tokensOf('10px/20px'))).toEqual(3);
  });
});
