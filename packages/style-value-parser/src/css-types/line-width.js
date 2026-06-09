/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser } from '../token-parser';
import { Length } from './length';

export type LineWidthKeyword = 'thin' | 'medium' | 'thick';

export type LineWidth = Length | LineWidthKeyword;

// Keyword matching is ASCII case-insensitive like every CSS identifier;
// the parsed value is normalized to lowercase.
export const lineWidth: TokenParser<LineWidth> = TokenParser.oneOf(
  Length.parser,
  TokenParser.tokens.Ident.map((v): string =>
    v[4].value.toLowerCase(),
  ).where<LineWidthKeyword>(
    (str): str is LineWidthKeyword =>
      str === 'thin' || str === 'medium' || str === 'thick',
  ),
);
