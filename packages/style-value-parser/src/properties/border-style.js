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
import { varFunction } from '../shorthands/css-wide';
import { fourSides } from '../shorthands/families/four-sides';

const borderStyleComponent: TokenParser<unknown> = TokenParser.oneOf(
  lineStyle,
  varFunction,
);

export const borderStyleDef: ShorthandDef = fourSides({
  canonical: 'border-style',
  component: borderStyleComponent,
  sides: {
    top: 'borderTopStyle',
    right: 'borderRightStyle',
    bottom: 'borderBottomStyle',
    left: 'borderLeftStyle',
  },
  condensed: { block: 'borderBlockStyle', inline: 'borderInlineStyle' },
  dialectMap: {
    borderRightStyle: 'borderInlineEndStyle',
    borderLeftStyle: 'borderInlineStartStyle',
  },
  pairOn: 'expanded-quad',
  acceptsNumber: false,
});
