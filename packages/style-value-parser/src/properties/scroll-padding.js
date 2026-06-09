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
import { auto } from '../css-types/common-types';
import { lengthPercentage } from '../css-types/length-percentage';
import { varFunction } from '../shorthands/css-wide';
import { fourSides } from '../shorthands/families/four-sides';

const scrollPaddingComponent: TokenParser<unknown> = TokenParser.oneOf(
  lengthPercentage,
  Calc.parser,
  auto,
  varFunction,
);

export const scrollPaddingDef: ShorthandDef = fourSides({
  canonical: 'scroll-padding',
  component: scrollPaddingComponent,
  sides: {
    top: 'scrollPaddingTop',
    right: 'scrollPaddingRight',
    bottom: 'scrollPaddingBottom',
    left: 'scrollPaddingLeft',
  },
  condensed: { block: 'scrollPaddingBlock', inline: 'scrollPaddingInline' },
  dialectMap: {
    scrollPaddingRight: 'scrollPaddingInlineEnd',
    scrollPaddingLeft: 'scrollPaddingInlineStart',
  },
});
