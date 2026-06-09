/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser } from '../token-parser';

export type LineStyle =
  | 'none'
  | 'hidden'
  | 'dotted'
  | 'dashed'
  | 'solid'
  | 'double'
  | 'groove'
  | 'ridge'
  | 'inset'
  | 'outset';

// Keyword matching is ASCII case-insensitive like every CSS identifier;
// the parsed value is normalized to lowercase.
export const lineStyle: TokenParser<LineStyle> = TokenParser.tokens.Ident.map(
  (v): string => v[4].value.toLowerCase(),
).where<LineStyle>(
  (str): str is LineStyle =>
    str === 'none' ||
    str === 'hidden' ||
    str === 'dotted' ||
    str === 'dashed' ||
    str === 'solid' ||
    str === 'double' ||
    str === 'groove' ||
    str === 'ridge' ||
    str === 'inset' ||
    str === 'outset',
);
