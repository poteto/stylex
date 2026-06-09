/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser, parseError } from '../token-parser';
import { TokenType } from '@csstools/css-tokenizer';

const MATH_FUNCTION_NAMES: ReadonlySet<string> = new Set([
  'calc',
  'min',
  'max',
  'clamp',
  // CSS Values 4 stepped-value, sign-related, exponential, and
  // trigonometric functions. A rem(...) FUNCTION token is lexically
  // distinct from the rem unit (a Dimension token), so the name cannot
  // shadow the unit.
  'round',
  'mod',
  'rem',
  'abs',
  'sign',
  'pow',
  'sqrt',
  'hypot',
  'log',
  'exp',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
]);

/**
 * A math function -- calc | min | max | clamp plus the CSS Values 4
 * names above, ASCII case-insensitive -- consumed as exactly ONE
 * component, balanced through the matching close paren (the same depth
 * walk as varFunction). Arguments are NOT validated: shorthand slots
 * relocate the author's text verbatim, never interpret it, so
 * 'min(var(--a), 2px)' is one length-ish component even though calc's
 * full grammar would refuse the nested var(). calc retains its full
 * argument parser in css-types/calc.js for consumers that need the
 * parsed expression. The parsed value is void on purpose: callers only
 * ever emit the verbatim slice (via TokenParser.sourced).
 */
export const mathFunction: TokenParser<void> = new TokenParser(
  (input): void | Error => {
    const startIndex = input.currentIndex;
    // Probed against every length-ish slot component; failures are hot.
    const fail = (message: string): Error => {
      input.setCurrentIndex(startIndex);
      return parseError(message);
    };

    const fn = input.consumeNextToken();
    if (fn == null || fn[0] !== TokenType.Function) {
      return fail('Expected a math function');
    }
    const name = fn[4].value.toLowerCase();
    if (!MATH_FUNCTION_NAMES.has(name)) {
      return fail(`Expected a math function, got ${fn[4].value}()`);
    }

    let depth = 1;
    while (depth > 0) {
      const next = input.consumeNextToken();
      if (next == null) {
        return fail(`Unbalanced parentheses in ${name}()`);
      }
      if (next[0] === TokenType.Function || next[0] === TokenType.OpenParen) {
        depth++;
      } else if (next[0] === TokenType.CloseParen) {
        depth--;
      }
    }
    return undefined;
  },
  'MathFunction',
);
