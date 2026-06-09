/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { CSSToken } from '@csstools/css-tokenizer';

import { TokenParser } from '../token-parser';
import { TokenType } from '@csstools/css-tokenizer';

/**
 * Detection set for the boundary pre-pass. Includes 'revert-layer' even
 * though stylex does not support it as a value: detection is about
 * classifying the input, not endorsing it.
 */
const CSS_WIDE_KEYWORDS: ReadonlySet<string> = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

/**
 * The verbatim keyword when the (already trimmed) value is exactly one
 * CSS-wide keyword, else null. These keywords are valid for EVERY property
 * and are not part of any property grammar, hence a single shared pre-pass.
 */
export function cssWideKeyword(tokens: ReadonlyArray<CSSToken>): string | null {
  if (
    tokens.length === 1 &&
    tokens[0][0] === TokenType.Ident &&
    CSS_WIDE_KEYWORDS.has(tokens[0][4].value.toLowerCase())
  ) {
    return tokens[0][1];
  }
  return null;
}

export type ImportantSplit = Readonly<{
  important: boolean,
  /** Tokens [0, endIndex) form the value; the rest is the !important tail. */
  endIndex: number,
}>;

/** Splits a trailing `!important` (case-insensitive, whitespace tolerant). */
export function splitImportant(
  tokens: ReadonlyArray<CSSToken>,
): ImportantSplit {
  let i = tokens.length - 1;
  while (i >= 0 && tokens[i][0] === TokenType.Whitespace) {
    i--;
  }
  if (
    i >= 1 &&
    tokens[i][0] === TokenType.Ident &&
    tokens[i][4].value.toLowerCase() === 'important'
  ) {
    let j = i - 1;
    while (j >= 0 && tokens[j][0] === TokenType.Whitespace) {
      j--;
    }
    if (j >= 0 && tokens[j][0] === TokenType.Delim && tokens[j][1] === '!') {
      return { important: true, endIndex: j };
    }
  }
  return { important: false, endIndex: tokens.length };
}

function isOpen(type: string): boolean {
  return (
    type === TokenType.Function ||
    type === TokenType.OpenParen ||
    type === TokenType.OpenSquare ||
    type === TokenType.OpenCurly
  );
}

function isClose(type: string): boolean {
  return (
    type === TokenType.CloseParen ||
    type === TokenType.CloseSquare ||
    type === TokenType.CloseCurly
  );
}

/**
 * Counts maximal runs of non-whitespace tokens at nesting depth 0: the
 * cheap pre-parse that lets minimal output short-circuit the dominant
 * already-valid single-component case before any grammar runs. A calc() is
 * countable as one component; a var() counts as one too, but only as a
 * documented trust -- the substituted value may hold several components
 * (calc is countable; var is not).
 */
export function countTopLevelComponents(
  tokens: ReadonlyArray<CSSToken>,
): number {
  let depth = 0;
  let count = 0;
  let inRun = false;
  for (const token of tokens) {
    const type = token[0];
    if (type === TokenType.Whitespace || type === TokenType.Comment) {
      if (depth === 0) {
        inRun = false;
      }
      continue;
    }
    if (depth === 0 && !inRun) {
      count++;
      inRun = true;
    }
    if (isOpen(type)) {
      depth++;
    } else if (isClose(type)) {
      depth = Math.max(0, depth - 1);
    }
  }
  return count;
}

/** True when a `var()` appears at nesting depth 0 (nested vars are inert). */
export function hasTopLevelVar(tokens: ReadonlyArray<CSSToken>): boolean {
  let depth = 0;
  for (const token of tokens) {
    if (token[0] === TokenType.Function) {
      if (depth === 0 && token[4].value.toLowerCase() === 'var') {
        return true;
      }
      depth++;
    } else if (isOpen(token[0])) {
      depth++;
    } else if (isClose(token[0])) {
      depth = Math.max(0, depth - 1);
    }
  }
  return false;
}

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
