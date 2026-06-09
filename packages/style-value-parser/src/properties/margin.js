/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { TokenDimension } from '@csstools/css-tokenizer';
import type { ShorthandDef } from '../shorthands/define';

import { TokenParser } from '../token-parser';
import { Calc } from '../css-types/calc';
import { auto } from '../css-types/common-types';
import { Length } from '../css-types/length';
import { lengthPercentage } from '../css-types/length-percentage';
import { varFunction } from '../shorthands/css-wide';
import { fourSides } from '../shorthands/families/four-sides';

// CSS unit matching is ASCII case-insensitive ('10PX' is '10px') but the
// css-types Length parser matches its unit list case-sensitively. Values
// are emitted as verbatim slices, so consuming the token is the whole job.
const anyCaseLength: TokenParser<void> = TokenParser.tokens.Dimension.where(
  (token): implies token is TokenDimension =>
    Length.UNITS.includes(token[4].unit.toLowerCase()),
).map(() => undefined);

const marginComponent: TokenParser<unknown> = TokenParser.oneOf(
  lengthPercentage,
  anyCaseLength,
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
