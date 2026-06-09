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
import { auto } from '../css-types/common-types';
import { lengthPercentage } from '../css-types/length-percentage';
import { mathFunction } from '../css-types/math-function';
import { varFunction } from '../shorthands/css-wide';
import { axisPair } from '../shorthands/families/axis-pair';
import { fourSides } from '../shorthands/families/four-sides';

const insetComponent: TokenParser<unknown> = TokenParser.oneOf(
  lengthPercentage,
  mathFunction,
  auto,
  varFunction,
);

// The CSS longhands of inset ARE top/right/bottom/left.
export const insetDef: ShorthandDef = fourSides({
  canonical: 'inset',
  component: insetComponent,
  sides: {
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    left: 'left',
  },
  condensed: { block: 'insetBlock', inline: 'insetInline' },
  dialectMap: {
    right: 'insetInlineEnd',
    left: 'insetInlineStart',
  },
});

export const insetBlockDef: ShorthandDef = axisPair({
  canonical: 'inset-block',
  component: insetComponent,
  longhands: { first: 'insetBlockStart', second: 'insetBlockEnd' },
});

export const insetInlineDef: ShorthandDef = axisPair({
  canonical: 'inset-inline',
  component: insetComponent,
  longhands: { first: 'insetInlineStart', second: 'insetInlineEnd' },
});
