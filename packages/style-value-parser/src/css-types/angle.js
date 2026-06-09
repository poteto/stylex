/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser } from '../token-parser';

export class Angle {
  +value: number;
  +unit: string;
  constructor(value: number, unit: this['unit']) {
    this.value = value;
    this.unit = unit;
  }
  toString(): string {
    return `${this.value}${this.unit}`;
  }
  static get parser(): TokenParser<Angle> {
    // CSS unit matching is ASCII case-insensitive ('45DEG' is '45deg');
    // the stored unit is normalized to lowercase so toString is
    // canonical (the Length/Time precedent).
    const withUnit = TokenParser.tokens.Dimension.map(
      (v): $ReadOnly<[number, string]> => [v[4].value, v[4].unit.toLowerCase()],
    )
      .where(
        (
          tuple: $ReadOnly<[number, string]>,
        ): implies tuple is $ReadOnly<[number, string]> =>
          tuple[1] === 'deg' ||
          tuple[1] === 'grad' ||
          tuple[1] === 'rad' ||
          tuple[1] === 'turn',
      )
      .map(([value, unit]) => new Angle(value, unit));

    return TokenParser.oneOf(
      withUnit,
      TokenParser.tokens.Number.map((v) =>
        v[4].value === 0 ? new Angle(0, 'deg') : null,
      ).where((v) => v != null),
    );
  }
}
