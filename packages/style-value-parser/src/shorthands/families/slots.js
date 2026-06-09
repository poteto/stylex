/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { CSSToken } from '@csstools/css-tokenizer';
import type { Sourced } from '../../token-parser';
import type { TokenList } from '../../token-types';
import type { ComponentRange } from '../css-wide';

import { TokenType } from '@csstools/css-tokenizer';
import { TokenParser, parseError } from '../../token-parser';
import { splitTopLevelComponents } from '../css-wide';

/**
 * The component-walk idiom shared by every slot grammar (line-trio, font,
 * background, animation, grid lines): the rest of the input materialized
 * into top-level component ranges, with exact-window matching and
 * verbatim slicing over them.
 */
export type ComponentWalk = Readonly<{
  /**
   * The walked span's raw tokens (already materialized), for whole-value
   * pre-checks that are not per-component: a def-level top-level-comma
   * scan, grid-template's areas-string detection.
   */
  tokens: ReadonlyArray<CSSToken>,
  /** Top-level component ranges, relative to the walked span. */
  components: ReadonlyArray<ComponentRange>,
  /** The parser's match when it consumes EXACTLY the component range. */
  matchRange: <T>(
    parser: TokenParser<Sourced<T>>,
    component: ComponentRange,
  ) => Sourced<T> | null,
  /** The component's verbatim source slice. */
  sliceOf: (component: ComponentRange) => string,
  /** True for the single-token top-level '/' component. */
  isSlash: (component: ComponentRange) => boolean,
  /** Parse failure: rewinds the input to the walk's start. */
  fail: (message: string) => Error,
  /** Parse success: leaves the input past the walked span. */
  finish: () => void,
}>;

/**
 * Materializes the rest of `input` so components can be sliced by range;
 * production parsers then re-run over exact [start, end) windows via
 * `matchRange`. A grammar built on the walk must end every path in
 * either `fail` (input rewound for the caller) or `finish` (the whole
 * span was consumed).
 */
export function walkComponents(input: TokenList): ComponentWalk {
  const startIndex = input.currentIndex;
  let drained = input.consumeNextToken();
  while (drained != null) {
    drained = input.consumeNextToken();
  }
  const endIndex = input.currentIndex;
  const tokens = input.slice(startIndex, endIndex);
  const components = splitTopLevelComponents(tokens);

  const matchRange = <T>(
    parser: TokenParser<Sourced<T>>,
    component: ComponentRange,
  ): Sourced<T> | null => {
    input.setCurrentIndex(startIndex + component.start);
    const result = parser.run(input);
    if (
      result instanceof Error ||
      input.currentIndex !== startIndex + component.end
    ) {
      return null;
    }
    return result;
  };

  const sliceOf = (component: ComponentRange): string =>
    tokens
      .slice(component.start, component.end)
      .map((token) => token[1])
      .join('');

  const isSlash = (component: ComponentRange): boolean => {
    const token = tokens[component.start];
    return (
      component.end - component.start === 1 &&
      token[0] === TokenType.Delim &&
      token[1] === '/'
    );
  };

  const fail = (message: string): Error => {
    input.setCurrentIndex(startIndex);
    return parseError(message);
  };

  const finish = (): void => {
    input.setCurrentIndex(endIndex);
  };

  return { tokens, components, matchRange, sliceOf, isSlash, fail, finish };
}

/**
 * The walk's components split into groups on top-level slash components;
 * the slashes themselves belong to no group. Empty groups (leading,
 * trailing, or doubled slashes) are preserved so grammars can refuse
 * them. A slashless walk is one group.
 */
export function splitOnSlashes(
  walk: ComponentWalk,
): ReadonlyArray<ReadonlyArray<ComponentRange>> {
  const groups: Array<Array<ComponentRange>> = [[]];
  for (const component of walk.components) {
    if (walk.isSlash(component)) {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(component);
    }
  }
  return groups;
}

/**
 * The walk's span split into comma-separated layer groups (background,
 * animation). Top-level commas partition the TOKEN span -- a glued comma
 * ('url(a),url(b)') sits inside a single component run, so this is not a
 * partition of `walk.components` -- and each group's component ranges
 * are computed over its own slice, shifted back to walk-relative
 * positions so matchRange/sliceOf/isSlash work unchanged. Commas nested
 * in functions or brackets are inert (the same depth rules
 * splitTopLevelComponents uses). Empty groups (leading, trailing, or
 * doubled commas) are preserved so grammars can refuse them. A commaless
 * walk is one group.
 */
export function splitOnCommas(
  walk: ComponentWalk,
): ReadonlyArray<ReadonlyArray<ComponentRange>> {
  const { tokens } = walk;
  const groups: Array<ReadonlyArray<ComponentRange>> = [];
  let groupStart = 0;
  let depth = 0;
  const endGroup = (end: number): void => {
    groups.push(
      splitTopLevelComponents(tokens.slice(groupStart, end)).map((range) => ({
        start: range.start + groupStart,
        end: range.end + groupStart,
      })),
    );
  };
  for (let index = 0; index < tokens.length; index++) {
    const type = tokens[index][0];
    if (depth === 0 && type === TokenType.Comma) {
      endGroup(index);
      groupStart = index + 1;
    } else if (
      type === TokenType.Function ||
      type === TokenType.OpenParen ||
      type === TokenType.OpenSquare ||
      type === TokenType.OpenCurly
    ) {
      depth++;
    } else if (
      type === TokenType.CloseParen ||
      type === TokenType.CloseSquare ||
      type === TokenType.CloseCurly
    ) {
      depth = Math.max(0, depth - 1);
    }
  }
  endGroup(tokens.length);
  return groups;
}

/**
 * One keyword out of `keywords`, ASCII case-insensitive. The parsed value
 * is the lowercased keyword for grammar-level decisions; emitted slices
 * stay verbatim (via TokenParser.sourced).
 */
export function identKeyword(
  keywords: ReadonlyArray<string>,
): TokenParser<string> {
  const set = new Set(keywords);
  return TokenParser.tokens.Ident.map((token): string =>
    token[4].value.toLowerCase(),
  ).where((str): implies str is string => set.has(str));
}

/**
 * A function whose name is in `names` (ASCII case-insensitive), consumed
 * as exactly ONE component, balanced through the matching close paren --
 * the mathFunction idiom generalized to a caller-supplied name set.
 * Arguments are NOT validated: slot grammars relocate the author's text
 * verbatim, never interpret it, so nested commas and var() stay inert.
 * The parsed value is void on purpose: callers only ever emit the
 * verbatim slice (via TokenParser.sourced).
 */
export function balancedFunction(
  names: ReadonlyArray<string>,
): TokenParser<void> {
  const set = new Set(names);
  const label = `Function<${names.join('|')}>`;
  return new TokenParser((input): void | Error => {
    const startIndex = input.currentIndex;
    // Probed per component during slot elimination; failures are hot.
    const fail = (message: string): Error => {
      input.setCurrentIndex(startIndex);
      return parseError(message);
    };

    const fn = input.consumeNextToken();
    if (fn == null || fn[0] !== TokenType.Function) {
      return fail(`Expected a ${label}`);
    }
    const name = fn[4].value.toLowerCase();
    if (!set.has(name)) {
      return fail(`Expected a ${label}, got ${fn[4].value}()`);
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
  }, label);
}
