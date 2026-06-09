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
import { Color, colorFunctionNames } from '../css-types/color';
import { lineStyle } from '../css-types/line-style';
import { lineWidth } from '../css-types/line-width';
import { mathFunction } from '../css-types/math-function';
import { balancedFunction } from '../shorthands/families/slots';
import { lineTrio } from '../shorthands/families/line-trio';

// Slot grammars; var() is handled at the matcher level, not per slot.
// The width and color slots are exported for the other defs embedding
// the same productions (outline, border-color, background's color).
// The color slot backstops the typed Color parser with name-classified
// balanced capture: any <color-function> name is a color component even
// where the typed parser does not model its argument syntax (modern
// space-separated forms, color()) -- arguments relocate verbatim.
export const lineWidthSlot: TokenParser<unknown> = TokenParser.oneOf(
  lineWidth,
  mathFunction,
);
export const colorSlot: TokenParser<unknown> = TokenParser.oneOf(
  Color.parser,
  balancedFunction(colorFunctionNames),
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
