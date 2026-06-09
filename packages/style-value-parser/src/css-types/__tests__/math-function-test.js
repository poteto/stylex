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

  test('captures the CSS Values 4 math function names verbatim', () => {
    // The extended set: stepped-value, sign-related, exponential, and
    // trigonometric functions all classify as ONE math component, with
    // the same unvalidated balanced capture as calc/min/max/clamp.
    for (const input of [
      'round(2.5px)',
      'round(up, 101px, 10px)',
      'mod(18px, 5px)',
      'rem(18px, 5px)',
      'abs(-10px)',
      'sign(-5%)',
      'pow(2, 10)',
      'sqrt(2)',
      'hypot(3em, 4em)',
      'log(8, 2)',
      'exp(1)',
      'sin(45deg)',
      'cos(0.25turn)',
      'tan(1.5rad)',
      'asin(0.5)',
      'acos(0.5)',
      'atan(1)',
      'atan2(1, -1)',
    ]) {
      expect(sourced.parseToEnd(input).raw).toEqual(input);
    }
  });

  test('a rem() FUNCTION token is distinct from the rem unit', () => {
    // 'rem(' lexes as one Function token; '1rem' is a Dimension token
    // whose unit happens to share the name. No ambiguity at the token
    // level, so accepting the function cannot shadow the unit.
    expect(sourced.parseToEnd('rem(10px, 3px)').raw).toEqual('rem(10px, 3px)');
    expect(mathFunction.parse('1rem')).toBeInstanceOf(Error);
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
