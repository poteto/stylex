/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../shorthands/define';

import { TokenParser } from '../token-parser';
import { Calc } from '../css-types/calc';
import { Color } from '../css-types/color';
import { lineStyle } from '../css-types/line-style';
import { lineWidth } from '../css-types/line-width';
import { lineTrio } from '../shorthands/families/line-trio';

/**
 * currentcolor is a valid <color> (and border's defaulted color) but not
 * a <named-color>, so Color.parser does not recognize it; the color slot
 * composes it explicitly. Keyword matching is ASCII case-insensitive; the
 * emitted slice stays verbatim.
 */
const currentColorKeyword: TokenParser<'currentcolor'> =
  TokenParser.tokens.Ident.map((token): string =>
    token[4].value.toLowerCase(),
  ).where<'currentcolor'>(
    (str): str is 'currentcolor' => str === 'currentcolor',
  );

// Slot grammars; var() is handled at the matcher level, not per slot.
// The width and color slots are exported for the outline def, whose
// outline-width and outline-color embed the same productions.
export const lineWidthSlot: TokenParser<unknown> = TokenParser.oneOf(
  lineWidth,
  Calc.parser,
);
export const colorSlot: TokenParser<unknown> = TokenParser.oneOf(
  Color.parser,
  currentColorKeyword,
);

/**
 * border expands ONE level, to borderWidth/borderStyle/borderColor --
 * matching both the spec's shorthand nesting and the old splitter. Those
 * longhands are themselves shorthands in this registry, and that is fine:
 * consumers re-enter the registry per emitted key. No dialectMap (border
 * sets all four sides; there is nothing to map) and no number fast path
 * (a bare number is not a valid border value, so the boundary's
 * stringified fallback lands in the grammar and refuses it).
 */
export const borderDef: ShorthandDef = lineTrio({
  canonical: 'border',
  slots: { width: lineWidthSlot, style: lineStyle, color: colorSlot },
  longhands: {
    width: 'borderWidth',
    style: 'borderStyle',
    color: 'borderColor',
  },
  defaults: { width: 'medium', style: 'none', color: 'currentcolor' },
});

/**
 * The four physical sides share border's slots and defaults and expand to
 * their true longhands. No dialectMap: the old splitter applies no
 * preferInline mapping for physical sides (borderLeft stays borderLeft*);
 * kept for parity.
 */
function borderSideDef(
  side: 'top' | 'right' | 'bottom' | 'left',
): ShorthandDef {
  const sideKey = side[0].toUpperCase() + side.slice(1);
  return lineTrio({
    canonical: `border-${side}`,
    slots: { width: lineWidthSlot, style: lineStyle, color: colorSlot },
    longhands: {
      width: `border${sideKey}Width`,
      style: `border${sideKey}Style`,
      color: `border${sideKey}Color`,
    },
    defaults: { width: 'medium', style: 'none', color: 'currentcolor' },
  });
}

export const borderTopDef: ShorthandDef = borderSideDef('top');
export const borderRightDef: ShorthandDef = borderSideDef('right');
export const borderBottomDef: ShorthandDef = borderSideDef('bottom');
export const borderLeftDef: ShorthandDef = borderSideDef('left');
