/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser } from '../token-parser';

export class Time {
  +value: number;
  +unit: 's' | 'ms';
  constructor(value: number, unit: 's' | 'ms') {
    this.value = value;
    this.unit = unit;
  }
  toString(): string {
    // Always use the shortest representation
    if (this.unit === 'ms') {
      return `${this.value / 1000}s`;
    }
    return `${this.value}${this.unit}`;
  }
  static UNITS: $ReadOnlyArray<'s' | 'ms'> = ['s', 'ms'];
  static get parser(): TokenParser<Time> {
    // Unit matching is ASCII case-insensitive like every CSS dimension
    // unit; the parsed value is normalized to lowercase (the Length
    // precedent). Shorthand slots emit verbatim slices regardless.
    return TokenParser.tokens.Dimension.map((v) => {
      const unit = v[4].unit.toLowerCase();
      return unit === 's' || unit === 'ms' ? [v[4].value, unit] : null;
    })
      .where((v) => v != null)
      .map(([v, unit]) => new Time(v, unit));
  }
}
