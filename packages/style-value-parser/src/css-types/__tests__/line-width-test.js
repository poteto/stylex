/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { Length } from '../length';
import { lineWidth } from '../line-width';

describe('Test CSS Type: <line-width>', () => {
  test('parses width keywords', () => {
    expect(lineWidth.parse('thin')).toBe('thin');
    expect(lineWidth.parse('medium')).toBe('medium');
    expect(lineWidth.parse('thick')).toBe('thick');
  });

  test('matches keywords case-insensitively', () => {
    expect(lineWidth.parse('THIN')).toBe('thin');
    expect(lineWidth.parse('Medium')).toBe('medium');
  });

  test('parses lengths', () => {
    expect(lineWidth.parse('1px')).toEqual(new Length(1, 'px'));
    expect(lineWidth.parse('0.5em')).toEqual(new Length(0.5, 'em'));
    expect(lineWidth.parse('0')).toEqual(new Length(0, ''));
  });

  test('rejects other values', () => {
    expect(() => lineWidth.parseToEnd('bold')).toThrow();
    expect(() => lineWidth.parseToEnd('10%')).toThrow();
    expect(() => lineWidth.parseToEnd('5')).toThrow();
  });
});
