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
import { lineWidth } from '../css-types/line-width';
import { varFunction } from '../shorthands/css-wide';
import { fourSides } from '../shorthands/families/four-sides';

const borderWidthComponent: TokenParser<unknown> = TokenParser.oneOf(
  lineWidth,
  Calc.parser,
  varFunction,
);

export const borderWidthDef: ShorthandDef = fourSides({
  canonical: 'border-width',
  component: borderWidthComponent,
  sides: {
    top: 'borderTopWidth',
    right: 'borderRightWidth',
    bottom: 'borderBottomWidth',
    left: 'borderLeftWidth',
  },
  condensed: { block: 'borderBlockWidth', inline: 'borderInlineWidth' },
  dialectMap: {
    borderRightWidth: 'borderInlineEndWidth',
    borderLeftWidth: 'borderInlineStartWidth',
  },
  pairOn: 'expanded-quad',
});
