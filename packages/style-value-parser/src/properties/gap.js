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
import { lengthPercentage } from '../css-types/length-percentage';
import { mathFunction } from '../css-types/math-function';
import { varFunction } from '../shorthands/css-wide';
import { axisPair } from '../shorthands/families/axis-pair';

const normal: TokenParser<'normal'> = TokenParser.tokens.Ident.map(
  (v): string => v[4].value.toLowerCase(),
).where<'normal'>((str): str is 'normal' => str === 'normal');

const gapComponent: TokenParser<unknown> = TokenParser.oneOf(
  lengthPercentage,
  mathFunction,
  normal,
  varFunction,
);

export const gapDef: ShorthandDef = axisPair({
  canonical: 'gap',
  aliases: ['grid-gap'],
  component: gapComponent,
  longhands: { first: 'rowGap', second: 'columnGap' },
  // 'gap: 10px 10px' keeps splitting to rowGap/columnGap, matching the
  // old splitter; the generic identical-pair collapse does not apply.
  collapseIdentical: false,
});
