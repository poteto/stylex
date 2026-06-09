/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { lineStyle } from '../line-style';

describe('Test CSS Type: <line-style>', () => {
  test('parses every line-style keyword', () => {
    for (const keyword of [
      'none',
      'hidden',
      'dotted',
      'dashed',
      'solid',
      'double',
      'groove',
      'ridge',
      'inset',
      'outset',
    ]) {
      expect(lineStyle.parse(keyword)).toBe(keyword);
    }
  });

  test('matches keywords case-insensitively', () => {
    expect(lineStyle.parse('SOLID')).toBe('solid');
    expect(lineStyle.parse('Dashed')).toBe('dashed');
  });

  test('rejects other values', () => {
    expect(() => lineStyle.parseToEnd('wavy')).toThrow();
    expect(() => lineStyle.parseToEnd('1px')).toThrow();
    expect(() => lineStyle.parseToEnd('5')).toThrow();
  });
});
