/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenList } from '../../token-types';
import { TokenParser } from '../../token-parser';
import { mathFunction } from '../math-function';

// The parsed value is void on purpose; consumers only ever emit the
// verbatim slice, which `sourced` exposes as `raw`.
const sourced = TokenParser.sourced(mathFunction);

describe('Test CSS Type: math functions', () => {
  test('captures each math function name verbatim', () => {
    expect(sourced.parseToEnd('calc(1px + 2px)').raw).toEqual(
      'calc(1px + 2px)',
    );
    expect(sourced.parseToEnd('min(1px, 2vw)').raw).toEqual('min(1px, 2vw)');
    expect(sourced.parseToEnd('max(10%, 20px)').raw).toEqual('max(10%, 20px)');
    expect(sourced.parseToEnd('clamp(1px,2px,3px)').raw).toEqual(
      'clamp(1px,2px,3px)',
    );
  });

  test('matches function names ASCII case-insensitively, slices verbatim', () => {
    expect(sourced.parseToEnd('CALC(1px + 2px)').raw).toEqual(
      'CALC(1px + 2px)',
    );
    expect(sourced.parseToEnd('Min(1px, 2vw)').raw).toEqual('Min(1px, 2vw)');
    expect(sourced.parseToEnd('CLAMP(1px, 2px, 3px)').raw).toEqual(
      'CLAMP(1px, 2px, 3px)',
    );
  });

  test('captures balanced nested functions and groups', () => {
    expect(sourced.parseToEnd('min(var(--a), 2px)').raw).toEqual(
      'min(var(--a), 2px)',
    );
    expect(
      sourced.parseToEnd('clamp(1rem, calc(1px + 2vw), 3rem)').raw,
    ).toEqual('clamp(1rem, calc(1px + 2vw), 3rem)');
    expect(sourced.parseToEnd('calc((1px + 2px) * 3)').raw).toEqual(
      'calc((1px + 2px) * 3)',
    );
  });

  test('stops at the matching close paren', () => {
    const tokens = new TokenList('min(1px, 2px) 99px');
    const result = sourced.run(tokens);
    expect(result).toEqual({ value: undefined, raw: 'min(1px, 2px)' });
  });

  test('does not validate arguments', () => {
    expect(sourced.parseToEnd('calc()').raw).toEqual('calc()');
    expect(sourced.parseToEnd('min(banana !)').raw).toEqual('min(banana !)');
  });

  test('refuses unknown function names', () => {
    expect(mathFunction.parse('fit-content(1px)')).toBeInstanceOf(Error);
    expect(mathFunction.parse('foo(1px)')).toBeInstanceOf(Error);
    expect(mathFunction.parse('var(--a)')).toBeInstanceOf(Error);
    expect(mathFunction.parse('minmax(1px, 2px)')).toBeInstanceOf(Error);
  });

  test('refuses non-function input', () => {
    expect(mathFunction.parse('calc')).toBeInstanceOf(Error);
    expect(mathFunction.parse('1px')).toBeInstanceOf(Error);
  });

  test('refuses unbalanced parentheses', () => {
    expect(mathFunction.parse('min(1px, (2px)')).toBeInstanceOf(Error);
    expect(mathFunction.parse('calc(var(--a)')).toBeInstanceOf(Error);
  });
});
