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
 * Factory for TRBL shorthands: 1-4 space-separated components expanding to
 * top/right/bottom/left longhands. All key names are caller data because
 * the naming scheme is not uniform across the family (marginTop vs the
 * later borderTopWidth).
 */
export function fourSides<T>(
  config: Readonly<{
    canonical: string,
    aliases?: ReadonlyArray<string>,
    /** Grammar for ONE component; values are emitted as verbatim slices. */
    component: TokenParser<T>,
    /** Physical longhand keys, in spec order. */
    sides: Readonly<{
      top: string,
      right: string,
      bottom: string,
      left: string,
    }>,
    /** Logical pair used by the minimal-output 2-value condensation. */
    condensed: Readonly<{ block: string, inline: string }>,
    /** Physical-to-logical mapping the boundary applies for preferInline. */
    dialectMap: Readonly<{ +[string]: string }>,
  }>,
): ShorthandDef {
  const { sides, condensed } = config;

  const component = TokenParser.sourced(config.component);
  const parse: TokenParser<ReadonlyArray<Sourced<T>>> = TokenParser.sequence(
    component,
    component.prefix(TokenParser.tokens.Whitespace).optional,
    component.prefix(TokenParser.tokens.Whitespace).optional,
    component.prefix(TokenParser.tokens.Whitespace).optional,
  ).map(([top, right, bottom, left]) => {
    const values: Array<Sourced<T>> = [top];
    if (right != null) {
      values.push(right);
    }
    if (bottom != null) {
      values.push(bottom);
    }
    if (left != null) {
      values.push(left);
    }
    return values;
  });

  const expand = (
    values: ReadonlyArray<Sourced<T>>,
  ): Readonly<{ +[string]: Cell }> => {
    const [top, right = top, bottom = top, left = right] = values;
    return {
      [sides.top]: { raw: top.raw, origin: 'explicit' },
      [sides.right]: {
        raw: right.raw,
        origin: values.length >= 2 ? 'explicit' : 'replicated',
      },
      [sides.bottom]: {
        raw: bottom.raw,
        origin: values.length >= 3 ? 'explicit' : 'replicated',
      },
      [sides.left]: {
        raw: left.raw,
        origin: values.length >= 4 ? 'explicit' : 'replicated',
      },
    };
  };

  /**
   * Minimal-output condensation, reproducing the directional transformer
   * the eslint autofix uses:
   *   - one value: identity, no-op
   *   - all values identical (multivalue): collapse onto the shorthand's
   *     own key, so the consumer rewrites 'margin: 10px 10px' to
   *     'margin: 10px'
   *   - two values: block/inline pair
   *   - three/four values: the four physical longhands (left fills from
   *     right on the 3-value form)
   * The identical-collapse compares VERBATIM slices (so '10px 10PX' is not
   * collapsed), matching the old splitter's printed-node comparison.
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
    if (new Set(raws).size === 1) {
      return [{ property: key, value: raws[0], origin: 'explicit' }];
    }
    if (raws.length === 2) {
      return [
        { property: condensed.block, value: raws[0], origin: 'explicit' },
        { property: condensed.inline, value: raws[1], origin: 'explicit' },
      ];
    }
    const [top, right, bottom, left = right] = raws;
    return [
      { property: sides.top, value: top, origin: 'explicit' },
      { property: sides.right, value: right, origin: 'explicit' },
      { property: sides.bottom, value: bottom, origin: 'explicit' },
      {
        property: sides.left,
        value: left,
        origin: raws.length >= 4 ? 'explicit' : 'replicated',
      },
    ];
  };

  const expandNumber = (value: number): Readonly<{ +[string]: Cell }> => ({
    [sides.top]: { raw: value, origin: 'explicit' },
    [sides.right]: { raw: value, origin: 'replicated' },
    [sides.bottom]: { raw: value, origin: 'replicated' },
    [sides.left]: { raw: value, origin: 'replicated' },
  });

  return defineShorthand({
    canonical: config.canonical,
    aliases: config.aliases,
    longhands: [sides.top, sides.right, sides.bottom, sides.left],
    dialectMap: config.dialectMap,
    parse,
    expand,
    condense,
    expandNumber,
  });
}
