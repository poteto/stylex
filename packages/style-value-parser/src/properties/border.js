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
const widthSlot: TokenParser<unknown> = TokenParser.oneOf(
  lineWidth,
  Calc.parser,
);
const styleSlot: TokenParser<unknown> = lineStyle;
const colorSlot: TokenParser<unknown> = TokenParser.oneOf(
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
  slots: { width: widthSlot, style: styleSlot, color: colorSlot },
  longhands: {
    width: 'borderWidth',
    style: 'borderStyle',
    color: 'borderColor',
  },
  defaults: { width: 'medium', style: 'none', color: 'currentcolor' },
});
