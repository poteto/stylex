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
import { lengthPercentage } from '../css-types/length-percentage';
import { varFunction } from '../shorthands/css-wide';
import { axisPair } from '../shorthands/families/axis-pair';
import { fourSides } from '../shorthands/families/four-sides';

// Unlike margin, padding has no 'auto'.
const paddingComponent: TokenParser<unknown> = TokenParser.oneOf(
  lengthPercentage,
  Calc.parser,
  varFunction,
);

export const paddingDef: ShorthandDef = fourSides({
  canonical: 'padding',
  component: paddingComponent,
  sides: {
    top: 'paddingTop',
    right: 'paddingRight',
    bottom: 'paddingBottom',
    left: 'paddingLeft',
  },
  condensed: { block: 'paddingBlock', inline: 'paddingInline' },
  dialectMap: {
    paddingRight: 'paddingInlineEnd',
    paddingLeft: 'paddingInlineStart',
  },
});

export const paddingBlockDef: ShorthandDef = axisPair({
  canonical: 'padding-block',
  component: paddingComponent,
  longhands: { first: 'paddingBlockStart', second: 'paddingBlockEnd' },
});

export const paddingInlineDef: ShorthandDef = axisPair({
  canonical: 'padding-inline',
  component: paddingComponent,
  longhands: { first: 'paddingInlineStart', second: 'paddingInlineEnd' },
});
