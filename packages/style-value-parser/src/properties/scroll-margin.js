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
import { Length } from '../css-types/length';
import { mathFunction } from '../css-types/math-function';
import { varFunction } from '../shorthands/css-wide';
import { fourSides } from '../shorthands/families/four-sides';

// Per spec, scroll-margin components are <length> only: no percentage,
// no auto.
const scrollMarginComponent: TokenParser<unknown> = TokenParser.oneOf(
  Length.parser,
  mathFunction,
  varFunction,
);

export const scrollMarginDef: ShorthandDef = fourSides({
  canonical: 'scroll-margin',
  component: scrollMarginComponent,
  sides: {
    top: 'scrollMarginTop',
    right: 'scrollMarginRight',
    bottom: 'scrollMarginBottom',
    left: 'scrollMarginLeft',
  },
  condensed: { block: 'scrollMarginBlock', inline: 'scrollMarginInline' },
  dialectMap: {
    scrollMarginRight: 'scrollMarginInlineEnd',
    scrollMarginLeft: 'scrollMarginInlineStart',
  },
});
