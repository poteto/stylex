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
import { Color } from '../css-types/color';
import { varFunction } from '../shorthands/css-wide';
import { fourSides } from '../shorthands/families/four-sides';

const borderColorComponent: TokenParser<unknown> = TokenParser.oneOf(
  Color.parser,
  varFunction,
);

export const borderColorDef: ShorthandDef = fourSides({
  canonical: 'border-color',
  component: borderColorComponent,
  sides: {
    top: 'borderTopColor',
    right: 'borderRightColor',
    bottom: 'borderBottomColor',
    left: 'borderLeftColor',
  },
  condensed: { block: 'borderBlockColor', inline: 'borderInlineColor' },
  dialectMap: {
    borderRightColor: 'borderInlineEndColor',
    borderLeftColor: 'borderInlineStartColor',
  },
  pairOn: 'expanded-quad',
  acceptsNumber: false,
});
