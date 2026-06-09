/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { Sourced } from '../../token-parser';
import type { ShorthandDef } from '../define';
import type { Cell, Declaration, EmitOptions } from '../types';

import { TokenParser } from '../../token-parser';
import { defineShorthand } from '../define';

/**
 * Factory for two-longhand axis shorthands: 1-2 space-separated components
 * expanding to a first/second pair (margin-block, gap, overflow, ...). A
 * single component replicates to both longhands. There is no dialectMap at
 * this level: the keys carry no physical/logical distinction.
 */
export function axisPair<T>(
  config: Readonly<{
    canonical: string,
    aliases?: ReadonlyArray<string>,
    /** Grammar for ONE component; values are emitted as verbatim slices. */
    component: TokenParser<T>,
    /** The two longhand stylex keys, in spec order. */
    longhands: Readonly<{ first: string, second: string }>,
    /**
     * False disables the minimal-output collapse of two identical values
     * onto the shorthand's own key; the pair is emitted instead. Gap opts
     * out to keep the old splitter's rowGap/columnGap output for
     * 'gap: 10px 10px'.
     */
    collapseIdentical?: boolean,
    /**
     * False disables the bare-number fast path for keyword shorthands
     * (overflow, overscroll-behavior); a numeric input then takes the
     * stringified-grammar route at the boundary.
     */
    acceptsNumber?: boolean,
  }>,
): ShorthandDef {
  const { longhands } = config;
  const collapseIdentical = config.collapseIdentical !== false;

  const component = TokenParser.sourced(config.component);
  const parse: TokenParser<ReadonlyArray<Sourced<T>>> = TokenParser.sequence(
    component,
    component.prefix(TokenParser.tokens.Whitespace).optional,
  ).map(([first, second]) => (second == null ? [first] : [first, second]));

  const expand = (
    values: ReadonlyArray<Sourced<T>>,
  ): Readonly<{ +[string]: Cell }> => {
    const [first, second = first] = values;
    return {
      [longhands.first]: { raw: first.raw, origin: 'explicit' },
      [longhands.second]: {
        raw: second.raw,
        origin: values.length >= 2 ? 'explicit' : 'replicated',
      },
    };
  };

  /**
   * Minimal-output condensation:
   *   - one value: identity, no-op
   *   - two identical values: collapse onto the shorthand's own key
   *     (unless the def opts out), comparing VERBATIM slices
   *   - two distinct values: the two longhands
   */
  const condense = (
    values: ReadonlyArray<Sourced<T>>,
    _options: EmitOptions,
    key: string,
  ): ?ReadonlyArray<Declaration> => {
    const raws = values.map((v) => v.raw);
    if (raws.length === 1) {
      return null;
    }
    if (collapseIdentical && raws[0] === raws[1]) {
      return [{ property: key, value: raws[0], origin: 'explicit' }];
    }
    return [
      { property: longhands.first, value: raws[0], origin: 'explicit' },
      { property: longhands.second, value: raws[1], origin: 'explicit' },
    ];
  };

  const expandNumber = (value: number): Readonly<{ +[string]: Cell }> => ({
    [longhands.first]: { raw: value, origin: 'explicit' },
    [longhands.second]: { raw: value, origin: 'replicated' },
  });

  return defineShorthand({
    canonical: config.canonical,
    aliases: config.aliases,
    longhands: [longhands.first, longhands.second],
    parse,
    expand,
    condense,
    expandNumber: config.acceptsNumber === false ? undefined : expandNumber,
  });
}
