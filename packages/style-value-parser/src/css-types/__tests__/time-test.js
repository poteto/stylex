/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { Time } from '../time';

describe('Test CSS Type: <time>', () => {
  test('parses seconds and milliseconds', () => {
    expect(Time.parser.parseToEnd('1s')).toEqual(new Time(1, 's'));
    expect(Time.parser.parseToEnd('500ms')).toEqual(new Time(500, 'ms'));
    expect(Time.parser.parseToEnd('-0.5s')).toEqual(new Time(-0.5, 's'));
    expect(Time.parser.parseToEnd('.25s')).toEqual(new Time(0.25, 's'));
  });

  test('matches units case-insensitively, normalized to lowercase', () => {
    expect(Time.parser.parseToEnd('500MS')).toEqual(new Time(500, 'ms'));
    expect(Time.parser.parseToEnd('2S')).toEqual(new Time(2, 's'));
    expect(Time.parser.parseToEnd('1Ms')).toEqual(new Time(1, 'ms'));
  });

  test('rejects non-time dimensions and bare numbers', () => {
    expect(() => Time.parser.parseToEnd('1px')).toThrow();
    expect(() => Time.parser.parseToEnd('1')).toThrow();
    expect(() => Time.parser.parseToEnd('1min')).toThrow();
  });
});
