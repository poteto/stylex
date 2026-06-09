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
import { varFunction } from '../shorthands/css-wide';
import { axisPair } from '../shorthands/families/axis-pair';

type OverscrollBehaviorKeyword = 'auto' | 'contain' | 'none';

const overscrollBehaviorKeyword: TokenParser<OverscrollBehaviorKeyword> =
  TokenParser.tokens.Ident.map((v): string =>
    v[4].value.toLowerCase(),
  ).where<OverscrollBehaviorKeyword>(
    (str): str is OverscrollBehaviorKeyword =>
      str === 'auto' || str === 'contain' || str === 'none',
  );

const overscrollBehaviorComponent: TokenParser<unknown> = TokenParser.oneOf(
  overscrollBehaviorKeyword,
  varFunction,
);

export const overscrollBehaviorDef: ShorthandDef = axisPair({
  canonical: 'overscroll-behavior',
  component: overscrollBehaviorComponent,
  longhands: { first: 'overscrollBehaviorX', second: 'overscrollBehaviorY' },
  acceptsNumber: false,
});
