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
import type { Cell, Declaration, EmitOptions, LonghandOrigin } from '../types';

import { TokenParser } from '../../token-parser';
import { defineShorthand } from '../define';

export type CornerKeys = Readonly<{
  topLeft: string,
  topRight: string,
  bottomRight: string,
  bottomLeft: string,
}>;

/**
 * The parsed value: 1-4 components per axis list. `vertical` is null when
 * the author wrote no '/' part; it is NOT defaulted to `horizontal` here
 * because authored counts are the presence model (the public
 * BorderRadiusShorthand class defaults omitted slots in its constructor,
 * which destroys exactly this information).
 */
type CornerLists<T> = Readonly<{
  horizontal: ReadonlyArray<Sourced<T>>,
  vertical: ReadonlyArray<Sourced<T>> | null,
}>;

/**
 * Factory for four-corner shorthands: 1-4 space-separated components,
 * optionally (border-radius) followed by '/' and a second 1-4 component
 * list, expanding to topLeft/topRight/bottomRight/bottomLeft longhands.
 *
 * Corner fill order is TL, TR, BR, BL with the standard replication (2nd
 * corner fills from the 1st, 3rd from the 1st, 4th from the 2nd). The
 * horizontal and vertical lists fill independently; an absent vertical
 * list means vertical = horizontal.
 *
 * Per-corner emitted value: the verbatim horizontal slice, or the
 * '<h> <v>' join when the corner's vertical slice differs verbatim from
 * its horizontal one.
 *
 * Origins: a corner is 'explicit' when its HORIZONTAL position was
 * authored, 'replicated' otherwise. An authored vertical list never
 * changes the longhand set or the origins -- the shorthand always sets all
 * four corners, and vertical radii only alter corner VALUES, which is what
 * drives minimal-output emission.
 */
export function corners<T>(
  config: Readonly<{
    canonical: string,
    aliases?: ReadonlyArray<string>,
    /** Grammar for ONE component; values are emitted as verbatim slices. */
    component: TokenParser<T>,
    /** Physical longhand keys, in spec order TL, TR, BR, BL. */
    corners: CornerKeys,
    /**
     * Keys minimal output emits when the corners differ. Defaults to
     * `corners`; corner-shape overrides this with the key list the old
     * splitter emits (see the def for the parity note).
     */
    minimalCorners?: CornerKeys,
    /** Physical-to-logical mapping the boundary applies for preferInline. */
    dialectMap: Readonly<{ +[string]: string }>,
    /** True enables the '/ <vertical radii>' two-axis form (border-radius). */
    slash?: boolean,
    /**
     * False disables the bare-number fast path for keyword shorthands
     * (corner-shape); a numeric input then takes the stringified-grammar
     * route at the boundary.
     */
    acceptsNumber?: boolean,
  }>,
): ShorthandDef {
  const physical = config.corners;
  const minimal = config.minimalCorners ?? physical;

  const component = TokenParser.sourced(config.component);
  const list: TokenParser<ReadonlyArray<Sourced<T>>> = TokenParser.sequence(
    component,
    component.prefix(TokenParser.tokens.Whitespace).optional,
    component.prefix(TokenParser.tokens.Whitespace).optional,
    component.prefix(TokenParser.tokens.Whitespace).optional,
  ).map(([first, second, third, fourth]) => {
    const values: Array<Sourced<T>> = [first];
    if (second != null) {
      values.push(second);
    }
    if (third != null) {
      values.push(third);
    }
    if (fourth != null) {
      values.push(fourth);
    }
    return values;
  });

  const slashSeparator = TokenParser.tokens.Delim.map((delim) => delim[4].value)
    .where((d) => d === '/')
    .surroundedBy(TokenParser.tokens.Whitespace.optional);

  const parse: TokenParser<CornerLists<T>> =
    config.slash === true
      ? TokenParser.sequence(list, list.prefix(slashSeparator).optional).map(
          ([horizontal, vertical]) => ({
            horizontal,
            vertical: vertical ?? null,
          }),
        )
      : list.map((horizontal) => ({ horizontal, vertical: null }));

  const fillQuad = (
    values: ReadonlyArray<Sourced<T>>,
  ): [string, string, string, string] => {
    const [
      topLeft,
      topRight = topLeft,
      bottomRight = topLeft,
      bottomLeft = topRight,
    ] = values;
    return [topLeft.raw, topRight.raw, bottomRight.raw, bottomLeft.raw];
  };

  /** TL, TR, BR, BL values after the per-corner h/v join. */
  const cornerValues = (
    lists: CornerLists<T>,
  ): [string, string, string, string] => {
    const horizontal = fillQuad(lists.horizontal);
    if (lists.vertical == null) {
      return horizontal;
    }
    const vertical = fillQuad(lists.vertical);
    const joined = horizontal.map((h, index) => {
      const v = vertical[index];
      return h === v ? h : `${h} ${v}`;
    });
    return [joined[0], joined[1], joined[2], joined[3]];
  };

  const cornerOrigins = (
    lists: CornerLists<T>,
  ): [LonghandOrigin, LonghandOrigin, LonghandOrigin, LonghandOrigin] => {
    const authored = lists.horizontal.length;
    return [
      'explicit',
      authored >= 2 ? 'explicit' : 'replicated',
      authored >= 3 ? 'explicit' : 'replicated',
      authored >= 4 ? 'explicit' : 'replicated',
    ];
  };

  const expand = (lists: CornerLists<T>): Readonly<{ +[string]: Cell }> => {
    const values = cornerValues(lists);
    const origins = cornerOrigins(lists);
    return {
      [physical.topLeft]: { raw: values[0], origin: origins[0] },
      [physical.topRight]: { raw: values[1], origin: origins[1] },
      [physical.bottomRight]: { raw: values[2], origin: origins[2] },
      [physical.bottomLeft]: { raw: values[3], origin: origins[3] },
    };
  };

  /**
   * Minimal-output condensation:
   *   - a single one-axis value: identity, no-op
   *   - all four corner values identical (after the h/v join): collapse
   *     onto the shorthand's own key with the canonical minimal form --
   *     the bare slice when each corner's radii are equal, the shortest
   *     '<h> / <v>' serialization when not
   *   - otherwise all four corner longhands; there is no block/inline
   *     style pairing for corners
   * All comparisons are between VERBATIM slices, matching the rest of the
   * engine.
   */
  const condense = (
    lists: CornerLists<T>,
    _options: EmitOptions,
    key: string,
  ): ?ReadonlyArray<Declaration> => {
    const values = cornerValues(lists);
    if (
      values[0] === values[1] &&
      values[1] === values[2] &&
      values[2] === values[3]
    ) {
      if (lists.horizontal.length === 1 && lists.vertical == null) {
        return null;
      }
      const horizontal = lists.horizontal[0].raw;
      const vertical = (lists.vertical ?? lists.horizontal)[0].raw;
      const value =
        horizontal === vertical ? horizontal : `${horizontal} / ${vertical}`;
      return [{ property: key, value, origin: 'explicit' }];
    }
    const origins = cornerOrigins(lists);
    return [
      { property: minimal.topLeft, value: values[0], origin: origins[0] },
      { property: minimal.topRight, value: values[1], origin: origins[1] },
      {
        property: minimal.bottomRight,
        value: values[2],
        origin: origins[2],
      },
      {
        property: minimal.bottomLeft,
        value: values[3],
        origin: origins[3],
      },
    ];
  };

  const expandNumber = (value: number): Readonly<{ +[string]: Cell }> => ({
    [physical.topLeft]: { raw: value, origin: 'explicit' },
    [physical.topRight]: { raw: value, origin: 'replicated' },
    [physical.bottomRight]: { raw: value, origin: 'replicated' },
    [physical.bottomLeft]: { raw: value, origin: 'replicated' },
  });

  return defineShorthand({
    canonical: config.canonical,
    aliases: config.aliases,
    longhands: [
      physical.topLeft,
      physical.topRight,
      physical.bottomRight,
      physical.bottomLeft,
    ],
    dialectMap: config.dialectMap,
    parse,
    expand,
    condense,
    expandNumber: config.acceptsNumber === false ? undefined : expandNumber,
  });
}
