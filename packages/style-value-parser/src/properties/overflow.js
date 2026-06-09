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

type OverflowKeyword = 'visible' | 'hidden' | 'clip' | 'scroll' | 'auto';

const overflowKeyword: TokenParser<OverflowKeyword> =
  TokenParser.tokens.Ident.map((v): string =>
    v[4].value.toLowerCase(),
  ).where<OverflowKeyword>(
    (str): str is OverflowKeyword =>
      str === 'visible' ||
      str === 'hidden' ||
      str === 'clip' ||
      str === 'scroll' ||
      str === 'auto',
  );

const overflowComponent: TokenParser<unknown> = TokenParser.oneOf(
  overflowKeyword,
  varFunction,
);

export const overflowDef: ShorthandDef = axisPair({
  canonical: 'overflow',
  component: overflowComponent,
  longhands: { first: 'overflowX', second: 'overflowY' },
  acceptsNumber: false,
});
