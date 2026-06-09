/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../shorthands/define';
import type { Cell, Declaration, EmitOptions } from '../shorthands/types';

import { TokenParser } from '../token-parser';
import { lengthPercentage } from '../css-types/length-percentage';
import { mathFunction } from '../css-types/math-function';
import { defineShorthand } from '../shorthands/define';

type FlexKeyword = 'none' | 'auto' | 'initial';

/**
 * One parse, tagged by form. 'keyword' is a whole-value keyword that fans
 * out to a defined trio; 'components' keeps the authored flags (null =
 * the author omitted the slot), so expansion can tell explicit slots from
 * filled-in defaults.
 */
type FlexParsed =
  | Readonly<{ form: 'keyword', keyword: FlexKeyword }>
  | Readonly<{
      form: 'components',
      grow: string | null,
      shrink: string | null,
      basis: string | null,
    }>;

// Keyword matching is ASCII case-insensitive; the trio lookup uses the
// lowercased keyword, never the slice.
const flexKeyword: TokenParser<FlexKeyword> = TokenParser.tokens.Ident.map(
  (token): string => token[4].value.toLowerCase(),
).where<FlexKeyword>(
  (str): str is FlexKeyword =>
    str === 'none' || str === 'auto' || str === 'initial',
);

const basisKeyword: TokenParser<string> = TokenParser.tokens.Ident.map(
  (token): string => token[4].value.toLowerCase(),
).where(
  (str): implies str is string =>
    str === 'auto' ||
    str === 'content' ||
    str === 'min-content' ||
    str === 'max-content' ||
    str === 'fit-content',
);

/** fit-content(<length-percentage>); the slice is emitted verbatim. */
const fitContentFunction: TokenParser<void> = TokenParser.sequence(
  TokenParser.tokens.Function.map((token): string =>
    token[4].value.toLowerCase(),
  ).where((name) => name === 'fit-content'),
  lengthPercentage.surroundedBy(TokenParser.tokens.Whitespace.optional),
  TokenParser.tokens.CloseParen,
).map(() => undefined);

/**
 * A <'flex-basis'> component. lengthPercentage admits the unitless zero
 * ('0' parses as a zero length); that is reachable only in the
 * three-component form because the shrink slot's Number parser consumes
 * any bare number first, matching the old splitter's allowUnitlessZero
 * rule. var() is deliberately absent from every slot: a var() anywhere
 * fails the parse and the boundary reclassifies it as contains-variable.
 */
const basisComponent: TokenParser<unknown> = TokenParser.oneOf(
  basisKeyword,
  fitContentFunction,
  mathFunction,
  lengthPercentage,
);

// Any Number token, negatives included, for old-splitter parity (the
// spec wants non-negative <number>s; the old splitter never checked).
const numberComponent: TokenParser<unknown> = TokenParser.tokens.Number;

const sourcedNumber = TokenParser.sourced(numberComponent);
const sourcedBasis = TokenParser.sourced(basisComponent);

/**
 * Number-led forms: n | n n | n b | n n b. The second slot tries Number
 * before basis, so 'n 0' is always grow+shrink; basis-first multivalue
 * forms ('auto 1') are refused like the old splitter, even though the
 * spec's || grammar would allow them.
 */
const numberLedForm: TokenParser<FlexParsed> = TokenParser.sequence(
  sourcedNumber,
  sourcedNumber.prefix(TokenParser.tokens.Whitespace).optional,
  sourcedBasis.prefix(TokenParser.tokens.Whitespace).optional,
).map(([grow, shrink, basis]) => ({
  form: 'components',
  grow: grow.raw,
  shrink: shrink?.raw ?? null,
  basis: basis?.raw ?? null,
}));

const loneBasisForm: TokenParser<FlexParsed> = sourcedBasis.map((basis) => ({
  form: 'components',
  grow: null,
  shrink: null,
  basis: basis.raw,
}));

/**
 * 'flex: initial' only reaches this parser def-level: at the boundary the
 * CSS-wide keyword pre-pass intercepts it first and replicates the
 * keyword itself to the three longhands (spec-equivalent: 0 1 auto ARE
 * their initial values).
 */
const KEYWORD_TRIOS: Readonly<{
  [_k in FlexKeyword]: Readonly<{
    grow: string,
    shrink: string,
    basis: string,
  }>,
}> = {
  auto: { grow: '1', shrink: '1', basis: 'auto' },
  none: { grow: '0', shrink: '0', basis: 'auto' },
  initial: { grow: '0', shrink: '1', basis: 'auto' },
};

const parse: TokenParser<FlexParsed> = TokenParser.oneOf(
  flexKeyword.map((keyword): FlexParsed => ({ form: 'keyword', keyword })),
  numberLedForm,
  loneBasisForm,
);

type FlexLonghand = 'flexGrow' | 'flexShrink' | 'flexBasis';

const FLEX_LONGHANDS: ReadonlyArray<FlexLonghand> = [
  'flexGrow',
  'flexShrink',
  'flexBasis',
];

const expand = (
  parsed: FlexParsed,
): Readonly<{ [_k in FlexLonghand]: Cell }> => {
  if (parsed.form === 'keyword') {
    const trio = KEYWORD_TRIOS[parsed.keyword];
    return {
      flexGrow: { raw: trio.grow, origin: 'replicated' },
      flexShrink: { raw: trio.shrink, origin: 'replicated' },
      flexBasis: { raw: trio.basis, origin: 'replicated' },
    };
  }
  return {
    flexGrow:
      parsed.grow != null
        ? { raw: parsed.grow, origin: 'explicit' }
        : { raw: '1', origin: 'defaulted' },
    flexShrink:
      parsed.shrink != null
        ? { raw: parsed.shrink, origin: 'explicit' }
        : { raw: '1', origin: 'defaulted' },
    flexBasis:
      parsed.basis != null
        ? { raw: parsed.basis, origin: 'explicit' }
        : { raw: '0%', origin: 'defaulted' },
  };
};

/**
 * Minimal output emits the FULL trio for keyword and multivalue input --
 * filled-in defaults included, because they are load-bearing: 'flex: 2 1'
 * pins flexBasis to 0% while the flexBasis longhand's initial value is
 * 'auto', so dropping it would change meaning (the old splitter also
 * emitted all three). Single-component non-keyword input is identity
 * (null -> no-op); the boundary fast path already short-circuits it.
 */
const condense = (
  parsed: FlexParsed,
  _options: EmitOptions,
  _key: string,
): ?ReadonlyArray<Declaration> => {
  if (parsed.form === 'components') {
    const authored = [parsed.grow, parsed.shrink, parsed.basis].filter(
      (slice) => slice != null,
    ).length;
    if (authored <= 1) {
      return null;
    }
  }
  const cells = expand(parsed);
  return FLEX_LONGHANDS.map((property) => ({
    property,
    value: cells[property].raw,
    origin: cells[property].origin,
  }));
};

export const flexDef: ShorthandDef = defineShorthand({
  canonical: 'flex',
  longhands: FLEX_LONGHANDS,
  parse,
  expand,
  condense,
  // 'flex: 4' means grow 4, like the lone-number string form.
  expandNumber: (value: number) => ({
    flexGrow: { raw: value, origin: 'explicit' },
    flexShrink: { raw: '1', origin: 'defaulted' },
    flexBasis: { raw: '0%', origin: 'defaulted' },
  }),
});
