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
import { lineStyle } from '../css-types/line-style';
import { lineTrio } from '../shorthands/families/line-trio';
import { colorSlot, lineWidthSlot } from './border';

// Keyword matching is ASCII case-insensitive; emitted slices stay verbatim.
const autoKeyword: TokenParser<'auto'> = TokenParser.tokens.Ident.map(
  (token): string => token[4].value.toLowerCase(),
).where<'auto'>((str): str is 'auto' => str === 'auto');

/**
 * 'auto' is grammatically ambiguous in outline: it is a legal
 * outline-style (the UA focus-ring style) AND a legal outline-color. With
 * both slots accepting it, the matcher's slot order resolves the tie:
 * 'auto' fills STYLE while style is open and color otherwise, because
 * 'outline: auto' means the UA focus-ring style. The old splitter sent
 * every unrecognized keyword -- including a lone 'auto' -- to color via
 * its fallthrough; that difference is a deliberate divergence. (The
 * style slot also keeps
 * line-style's 'hidden', which outline-style technically excludes,
 * matching the old splitter's keyword set.)
 */
export const outlineDef: ShorthandDef = lineTrio({
  canonical: 'outline',
  slots: {
    width: lineWidthSlot,
    style: TokenParser.oneOf(lineStyle, autoKeyword),
    color: TokenParser.oneOf(colorSlot, autoKeyword),
  },
  longhands: {
    width: 'outlineWidth',
    style: 'outlineStyle',
    color: 'outlineColor',
  },
  defaults: { width: 'medium', style: 'none', color: 'auto' },
});
