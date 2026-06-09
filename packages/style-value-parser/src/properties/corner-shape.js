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
import { mathFunction } from '../css-types/math-function';
import { varFunction } from '../shorthands/css-wide';
import { corners } from '../shorthands/families/corners';
import { identKeyword } from '../shorthands/families/slots';

type CornerShapeKeyword =
  | 'round'
  | 'scoop'
  | 'bevel'
  | 'notch'
  | 'square'
  | 'squircle';

const cornerShapeKeyword: TokenParser<CornerShapeKeyword> =
  TokenParser.tokens.Ident.map((token): string =>
    token[4].value.toLowerCase(),
  ).where<CornerShapeKeyword>(
    (str): str is CornerShapeKeyword =>
      str === 'round' ||
      str === 'scoop' ||
      str === 'bevel' ||
      str === 'notch' ||
      str === 'square' ||
      str === 'squircle',
  );

/**
 * superellipse(<number>): the only functional corner-shape value. The
 * argument is a <number>, which per CSS Values is a bare number, a math
 * function (calc and friends), or the math-constant keywords `infinity`
 * / `-infinity` that the WPT suite and Chromium accept here. The slice
 * is emitted verbatim, so the parsed value carries no payload.
 */
const superellipseArgument: TokenParser<unknown> = TokenParser.oneOf(
  TokenParser.tokens.Number,
  identKeyword(['infinity', '-infinity']),
  mathFunction,
);

const superellipseFunction: TokenParser<void> = TokenParser.sequence(
  TokenParser.tokens.Function.map((token): string =>
    token[4].value.toLowerCase(),
  ).where((name) => name === 'superellipse'),
  superellipseArgument.surroundedBy(TokenParser.tokens.Whitespace.optional),
  TokenParser.tokens.CloseParen,
).map(() => undefined);

const cornerShapeComponent: TokenParser<unknown> = TokenParser.oneOf(
  cornerShapeKeyword,
  superellipseFunction,
  varFunction,
);

/**
 * corner-shape has no two-axis '/' form, hence no `slash` here.
 *
 * Old-splitter divergence, fixed deliberately: splitShorthands.js emitted
 * the LOGICAL corner-*-shape keys even without preferInline, with a
 * pairing MIRRORED from its own CORNER_SHAPE_MAP (the BR quad slot landed
 * on cornerEndStartShape and BL on cornerEndEndShape), and under
 * preferInline it always returned CANNOT_FIX because it fed those logical
 * keys back into the physical-to-logical map. This def emits the PHYSICAL
 * keys in minimal output like every other corner def; the dialectMap
 * below (the CORNER_SHAPE_MAP pairing: bottom-left -> end-start,
 * bottom-right -> end-end, LTR/horizontal-tb assumption) applies at the
 * boundary when the caller asks for preferInline.
 */
export const cornerShapeDef: ShorthandDef = corners({
  canonical: 'corner-shape',
  component: cornerShapeComponent,
  corners: {
    topLeft: 'cornerTopLeftShape',
    topRight: 'cornerTopRightShape',
    bottomRight: 'cornerBottomRightShape',
    bottomLeft: 'cornerBottomLeftShape',
  },
  dialectMap: {
    cornerTopLeftShape: 'cornerStartStartShape',
    cornerTopRightShape: 'cornerStartEndShape',
    cornerBottomLeftShape: 'cornerEndStartShape',
    cornerBottomRightShape: 'cornerEndEndShape',
  },
  acceptsNumber: false,
});
