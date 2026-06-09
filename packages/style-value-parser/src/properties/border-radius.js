/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { LengthPercentage } from '../css-types/length-percentage';
import type { ShorthandDef } from '../shorthands/define';

import { TokenParser } from '../token-parser';
import { Calc } from '../css-types/calc';
import { lengthPercentage } from '../css-types/length-percentage';
import { varFunction } from '../shorthands/css-wide';
import { corners } from '../shorthands/families/corners';

const radiusComponent: TokenParser<unknown> = TokenParser.oneOf(
  lengthPercentage,
  Calc.parser,
  varFunction,
);

/**
 * The shorthand-engine def. It parses independently of the
 * BorderRadiusShorthand class below: the class's constructor defaults
 * omitted corners and the whole vertical list, while the engine's presence
 * model needs the authored counts of BOTH lists to compute origins and the
 * minimal collapse.
 */
export const borderRadiusDef: ShorthandDef = corners({
  canonical: 'border-radius',
  component: radiusComponent,
  slash: true,
  corners: {
    topLeft: 'borderTopLeftRadius',
    topRight: 'borderTopRightRadius',
    bottomRight: 'borderBottomRightRadius',
    bottomLeft: 'borderBottomLeftRadius',
  },
  dialectMap: {
    borderTopLeftRadius: 'borderStartStartRadius',
    borderTopRightRadius: 'borderStartEndRadius',
    borderBottomLeftRadius: 'borderEndStartRadius',
    borderBottomRightRadius: 'borderEndEndRadius',
  },
});

export class BorderRadiusIndividual {
  horizontal: LengthPercentage;
  vertical: LengthPercentage;

  constructor(horizontal: LengthPercentage, vertical?: LengthPercentage) {
    this.horizontal = horizontal;
    this.vertical = vertical ?? horizontal;
  }

  toString(): string {
    const horizontal = this.horizontal.toString();
    const vertical = this.vertical.toString();
    if (horizontal === vertical) {
      return horizontal;
    }
    return `${horizontal} ${vertical}`;
  }

  static get parse(): TokenParser<BorderRadiusIndividual> {
    return TokenParser.oneOf(
      TokenParser.sequence(lengthPercentage, lengthPercentage).separatedBy(
        TokenParser.tokens.Whitespace,
      ),
      lengthPercentage.map((p) => [p, p]),
    ).map(
      ([horizontal, vertical]) =>
        new BorderRadiusIndividual(horizontal, vertical),
    );
  }
}

export class BorderRadiusShorthand {
  horizontalTopLeft: LengthPercentage;
  horizontalTopRight: LengthPercentage;
  horizontalBottomRight: LengthPercentage;
  horizontalBottomLeft: LengthPercentage;

  verticalTopLeft: LengthPercentage;
  verticalTopRight: LengthPercentage;
  verticalBottomRight: LengthPercentage;
  verticalBottomLeft: LengthPercentage;

  constructor(
    horizontalTopLeft: LengthPercentage,
    horizontalTopRight: LengthPercentage = horizontalTopLeft,
    horizontalBottomRight: LengthPercentage = horizontalTopLeft,
    horizontalBottomLeft: LengthPercentage = horizontalTopRight,
    verticalTopLeft: LengthPercentage = horizontalTopLeft,
    verticalTopRight: LengthPercentage = verticalTopLeft,
    verticalBottomRight: LengthPercentage = verticalTopLeft,
    verticalBottomLeft: LengthPercentage = verticalTopRight,
  ) {
    this.horizontalTopLeft = horizontalTopLeft;
    this.horizontalTopRight = horizontalTopRight;
    this.horizontalBottomRight = horizontalBottomRight;
    this.horizontalBottomLeft = horizontalBottomLeft;
    this.verticalTopLeft = verticalTopLeft;
    this.verticalTopRight = verticalTopRight;
    this.verticalBottomRight = verticalBottomRight;
    this.verticalBottomLeft = verticalBottomLeft;
  }

  // The shortest possible version of the border-radius
  toString(): string {
    const horizontalTopLeft = this.horizontalTopLeft.toString();
    const horizontalTopRight = this.horizontalTopRight.toString();
    const horizontalBottomRight = this.horizontalBottomRight.toString();
    const horizontalBottomLeft = this.horizontalBottomLeft.toString();

    let pStr = `${horizontalTopLeft} ${horizontalTopRight} ${horizontalBottomRight} ${horizontalBottomLeft}`;

    // All four are the same
    if (
      horizontalTopLeft === horizontalTopRight &&
      horizontalTopRight === horizontalBottomRight &&
      horizontalBottomRight === horizontalBottomLeft
    ) {
      pStr = horizontalTopLeft;
      // TopLeft === BottomRight && TopRight === BottomLeft
    } else if (
      horizontalTopLeft === horizontalBottomRight &&
      horizontalTopRight === horizontalBottomLeft
    ) {
      pStr = `${horizontalTopLeft} ${horizontalTopRight}`;
      // TopRight === BottomLeft
    } else if (horizontalTopRight === horizontalBottomLeft) {
      pStr = `${horizontalTopLeft} ${horizontalTopRight} ${horizontalBottomRight}`;
    }

    const verticalTopLeft = this.verticalTopLeft.toString();
    const verticalTopRight = this.verticalTopRight.toString();
    const verticalBottomRight = this.verticalBottomRight.toString();
    const verticalBottomLeft = this.verticalBottomLeft.toString();

    let sStr = `${horizontalTopLeft} ${horizontalTopRight} ${horizontalBottomRight} ${horizontalBottomLeft}`;
    // All three are the same
    if (
      verticalTopLeft === verticalTopRight &&
      verticalTopRight === verticalBottomRight &&
      verticalBottomRight === verticalBottomLeft
    ) {
      sStr = verticalTopLeft;
      // TopLeft === BottomRight && TopRight === BottomLeft
    } else if (
      verticalTopLeft === verticalBottomRight &&
      verticalTopRight === verticalBottomLeft
    ) {
      sStr = `${verticalTopLeft} ${verticalTopRight}`;
      // TopRight === BottomLeft
    } else if (verticalTopRight === verticalBottomLeft) {
      sStr = `${verticalTopLeft} ${verticalTopRight} ${verticalBottomRight}`;
    }

    if (pStr === sStr) {
      return pStr;
    }

    return `${pStr} / ${sStr}`;
  }

  static get parse(): TokenParser<BorderRadiusShorthand> {
    const spaceSeparatedRadii = TokenParser.sequence(
      lengthPercentage,
      lengthPercentage.prefix(TokenParser.tokens.Whitespace).optional,
      lengthPercentage.prefix(TokenParser.tokens.Whitespace).optional,
      lengthPercentage.prefix(TokenParser.tokens.Whitespace).optional,
    ).map(
      ([
        topLeft,
        topRight = topLeft,
        bottomRight = topLeft,
        bottomLeft = topRight,
      ]) => [topLeft, topRight, bottomRight, bottomLeft],
    );

    const assymtricBorder = TokenParser.sequence(
      spaceSeparatedRadii,
      spaceSeparatedRadii,
    )
      .separatedBy(
        TokenParser.tokens.Delim.map((delim) => delim[4].value)
          .where((d) => d === '/')
          .surroundedBy(TokenParser.tokens.Whitespace),
      )
      .map(
        ([pRadii, sRadii = pRadii]) =>
          new BorderRadiusShorthand(...pRadii, ...sRadii),
      );

    return TokenParser.oneOf(
      assymtricBorder,
      spaceSeparatedRadii.map(
        (borders) => new BorderRadiusShorthand(...borders),
      ),
    );
  }
}
