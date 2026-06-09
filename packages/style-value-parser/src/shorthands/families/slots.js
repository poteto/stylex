/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { CSSToken } from '@csstools/css-tokenizer';
import type { Sourced, TokenParser } from '../../token-parser';
import type { TokenList } from '../../token-types';
import type { ComponentRange } from '../css-wide';

import { TokenType } from '@csstools/css-tokenizer';
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
    return new Error(message);
  };

  const finish = (): void => {
    input.setCurrentIndex(endIndex);
  };

  return { tokens, components, matchRange, sliceOf, isSlash, fail, finish };
}
