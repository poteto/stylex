/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser } from '../token-parser';
import { TokenType } from '@csstools/css-tokenizer';

/**
 * A top-level `var()` consumed as exactly ONE component, fallback included,
 * balanced through the matching close paren. A var holding multiple
 * components (`--x: 1px 2px`) would make this a wrong guess; we accept that
 * documented trust in positional grammars for parity with existing autofix
 * behavior. The parsed value is void on purpose: callers only ever emit the
 * verbatim slice (via TokenParser.sourced), never a normalized form.
 */
export const varFunction: TokenParser<void> = new TokenParser(
  (input): void | Error => {
    const startIndex = input.currentIndex;
    const fail = (message: string): Error => {
      input.setCurrentIndex(startIndex);
      return new Error(message);
    };

    const fn = input.consumeNextToken();
    if (
      fn == null ||
      fn[0] !== TokenType.Function ||
      fn[4].value.toLowerCase() !== 'var'
    ) {
      return fail('Expected var()');
    }

    let token = input.consumeNextToken();
    while (token != null && token[0] === TokenType.Whitespace) {
      token = input.consumeNextToken();
    }
    if (
      token == null ||
      token[0] !== TokenType.Ident ||
      !token[4].value.startsWith('--')
    ) {
      return fail('Expected a custom property name in var()');
    }

    let depth = 1;
    while (depth > 0) {
      const next = input.consumeNextToken();
      if (next == null) {
        return fail('Unbalanced parentheses in var()');
      }
      if (next[0] === TokenType.Function || next[0] === TokenType.OpenParen) {
        depth++;
      } else if (next[0] === TokenType.CloseParen) {
        depth--;
      }
    }
    return undefined;
  },
  'VarFunction',
);
