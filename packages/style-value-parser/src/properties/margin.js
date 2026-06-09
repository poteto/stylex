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
import { axisPair } from '../shorthands/families/axis-pair';
import { fourSides } from '../shorthands/families/four-sides';

const marginComponent: TokenParser<unknown> = TokenParser.oneOf(
  lengthPercentage,
  Calc.parser,
  auto,
  varFunction,
);

export const marginDef: ShorthandDef = fourSides({
  canonical: 'margin',
  component: marginComponent,
  sides: {
    top: 'marginTop',
    right: 'marginRight',
    bottom: 'marginBottom',
    left: 'marginLeft',
  },
  condensed: { block: 'marginBlock', inline: 'marginInline' },
  dialectMap: {
    marginRight: 'marginInlineEnd',
    marginLeft: 'marginInlineStart',
  },
});

export const marginBlockDef: ShorthandDef = axisPair({
  canonical: 'margin-block',
  component: marginComponent,
  longhands: { first: 'marginBlockStart', second: 'marginBlockEnd' },
});

export const marginInlineDef: ShorthandDef = axisPair({
  canonical: 'margin-inline',
  component: marginComponent,
  longhands: { first: 'marginInlineStart', second: 'marginInlineEnd' },
});
