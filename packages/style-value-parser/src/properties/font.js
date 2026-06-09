/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../shorthands/define';
import type { Cell } from '../shorthands/types';

import { TokenParser } from '../token-parser';
import { Angle } from '../css-types/angle';
import { lengthPercentage } from '../css-types/length-percentage';
import { mathFunction } from '../css-types/math-function';
import { defineShorthand } from '../shorthands/define';
import { walkComponents } from '../shorthands/families/slots';

/**
 * One parse, tagged by form. 'system' (a sole system-font keyword) and
 * 'oblique-angle' are recognized but refused through the def's
 * unsupported hook: system fonts resolve from UA settings at use time
 * and 'oblique <angle>' has no single-longhand home, so neither can be
 * expanded at compile time. 'value' keeps null for omitted slots so
 * expansion can tell explicit slots from filled-in defaults.
 */
type FontParsed =
  | Readonly<{ form: 'system' }>
  | Readonly<{ form: 'oblique-angle' }>
  | Readonly<{
      form: 'value',
      style: string | null,
      variant: string | null,
      weight: string | null,
      size: string,
      lineHeight: string | null,
      family: string,
    }>;

// Keyword matching is ASCII case-insensitive; emitted slices stay verbatim.
function identKeyword(keywords: ReadonlyArray<string>): TokenParser<string> {
  const set = new Set(keywords);
  return TokenParser.tokens.Ident.map((token): string =>
    token[4].value.toLowerCase(),
  ).where((str): implies str is string => set.has(str));
}

const systemKeyword: TokenParser<string> = identKeyword([
  'caption',
  'icon',
  'menu',
  'message-box',
  'small-caption',
  'status-bar',
]);

const styleKeyword: TokenParser<string> = identKeyword(['italic', 'oblique']);
const variantKeyword: TokenParser<string> = identKeyword(['small-caps']);

// Numeric weights span 100-900 in the shorthand (the old splitter's
// [1-9]00 steps plus the variable-font range between them).
const weightComponent: TokenParser<unknown> = TokenParser.oneOf(
  identKeyword(['bold', 'bolder', 'lighter']),
  TokenParser.tokens.Number.map((token): number => token[4].value).where(
    (value): implies value is number => value >= 100 && value <= 900,
  ),
);

const normalKeyword: TokenParser<string> = identKeyword(['normal']);

const sizeComponent: TokenParser<unknown> = TokenParser.oneOf(
  identKeyword([
    'xx-small',
    'x-small',
    'small',
    'medium',
    'large',
    'x-large',
    'xx-large',
    'xxx-large',
    'smaller',
    'larger',
  ]),
  lengthPercentage,
  mathFunction,
);

const lineHeightComponent: TokenParser<unknown> = TokenParser.oneOf(
  normalKeyword,
  TokenParser.tokens.Number,
  lengthPercentage,
);

const sourcedSystem = TokenParser.sourced(systemKeyword);
const sourcedStyle = TokenParser.sourced(styleKeyword);
const sourcedVariant = TokenParser.sourced(variantKeyword);
const sourcedWeight = TokenParser.sourced(weightComponent);
const sourcedNormal = TokenParser.sourced(normalKeyword);
const sourcedSize = TokenParser.sourced(sizeComponent);
const sourcedLineHeight = TokenParser.sourced(lineHeightComponent);
const sourcedAngle = TokenParser.sourced(Angle.parser);

/**
 * font = [ <style> || <variant> || <weight> ]? <size> [ / <line-height> ]?
 *        <family>
 *
 * The unordered prefix is a slot-elimination walk over the top-level
 * component split (the line-trio idiom); the first component matching
 * the size production ends the prefix. No slash re-split machinery is
 * needed: splitTopLevelComponents already makes a top-level '/' its own
 * component even mid-run ('12px/1.5' is three components), so the
 * line-height is just "the component after a slash component".
 *
 * The family is everything after the size (and line-height): each
 * component slice verbatim, joined with single spaces, never validated
 * -- comma runs like '"Helvetica Neue", serif' relocate byte-for-byte.
 */
const parse: TokenParser<FontParsed> = new TokenParser(
  (input): FontParsed | Error => {
    const { components, matchRange, sliceOf, isSlash, fail, finish } =
      walkComponents(input);
    if (components.length === 0) {
      return fail('Expected at least one component');
    }

    const done = (parsed: FontParsed): FontParsed => {
      finish();
      return parsed;
    };

    if (
      components.length === 1 &&
      matchRange(sourcedSystem, components[0]) != null
    ) {
      return done({ form: 'system' });
    }

    const filled: {
      style: string | null,
      variant: string | null,
      weight: string | null,
    } = { style: null, variant: null, weight: null };
    let size: string | null = null;
    let index = 0;

    while (index < components.length) {
      const component = components[index];

      const sizeMatch = matchRange(sourcedSize, component);
      if (sizeMatch != null) {
        size = sizeMatch.raw;
        index++;
        break;
      }

      const styleMatch =
        filled.style == null ? matchRange(sourcedStyle, component) : null;
      if (styleMatch != null) {
        if (
          styleMatch.value === 'oblique' &&
          index + 1 < components.length &&
          matchRange(sourcedAngle, components[index + 1]) != null
        ) {
          return done({ form: 'oblique-angle' });
        }
        filled.style = styleMatch.raw;
        index++;
        continue;
      }

      const variantMatch =
        filled.variant == null ? matchRange(sourcedVariant, component) : null;
      if (variantMatch != null) {
        filled.variant = variantMatch.raw;
        index++;
        continue;
      }

      const weightMatch =
        filled.weight == null ? matchRange(sourcedWeight, component) : null;
      if (weightMatch != null) {
        filled.weight = weightMatch.raw;
        index++;
        continue;
      }

      const normalMatch = matchRange(sourcedNormal, component);
      if (normalMatch != null) {
        // 'normal' is valid for style, variant, AND weight; like
        // outline's ambiguous 'auto', the slot order resolves the tie:
        // it fills the first unfilled of style -> variant -> weight.
        if (filled.style == null) {
          filled.style = normalMatch.raw;
        } else if (filled.variant == null) {
          filled.variant = normalMatch.raw;
        } else if (filled.weight == null) {
          filled.weight = normalMatch.raw;
        } else {
          return fail(`Duplicate normal component: ${normalMatch.raw}`);
        }
        index++;
        continue;
      }

      const componentText = sliceOf(component);
      if (filled.style != null && matchRange(sourcedStyle, component) != null) {
        return fail(`Duplicate style component: ${componentText}`);
      }
      if (
        filled.variant != null &&
        matchRange(sourcedVariant, component) != null
      ) {
        return fail(`Duplicate variant component: ${componentText}`);
      }
      if (
        filled.weight != null &&
        matchRange(sourcedWeight, component) != null
      ) {
        return fail(`Duplicate weight component: ${componentText}`);
      }
      return fail(
        `Unexpected component before the font-size: ${componentText}`,
      );
    }

    if (size == null) {
      return fail('Expected a font-size');
    }

    let lineHeight: string | null = null;
    if (index < components.length && isSlash(components[index])) {
      index++;
      const lineHeightMatch =
        index < components.length
          ? matchRange(sourcedLineHeight, components[index])
          : null;
      if (lineHeightMatch == null) {
        return fail('Expected a line-height after the slash');
      }
      lineHeight = lineHeightMatch.raw;
      index++;
    }

    if (index >= components.length) {
      return fail('Expected a font-family');
    }
    const family = components.slice(index).map(sliceOf).join(' ');

    return done({
      form: 'value',
      style: filled.style,
      variant: filled.variant,
      weight: filled.weight,
      size,
      lineHeight,
      family,
    });
  },
  'Font',
);

type FontLonghand =
  | 'fontStyle'
  | 'fontVariant'
  | 'fontWeight'
  | 'fontSize'
  | 'lineHeight'
  | 'fontFamily';

const FONT_LONGHANDS: ReadonlyArray<FontLonghand> = [
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontSize',
  'lineHeight',
  'fontFamily',
];

const normalCell = (slice: string | null): Cell =>
  slice != null
    ? { raw: slice, origin: 'explicit' }
    : { raw: 'normal', origin: 'defaulted' };

const expand = (
  parsed: FontParsed,
): Readonly<{ [_k in FontLonghand]: Cell }> => {
  if (parsed.form !== 'value') {
    // Unreachable from CSS input: run() routes these forms through the
    // unsupported hook before any expansion.
    throw new Error(`Cannot expand unsupported font form: ${parsed.form}`);
  }
  return {
    fontStyle: normalCell(parsed.style),
    fontVariant: normalCell(parsed.variant),
    fontWeight: normalCell(parsed.weight),
    fontSize: { raw: parsed.size, origin: 'explicit' },
    lineHeight: normalCell(parsed.lineHeight),
    fontFamily: { raw: parsed.family, origin: 'explicit' },
  };
};

/**
 * Emit order is the spec's longhand order (style, variant, weight, size,
 * line-height, family); the old splitter emitted fontFamily first, a
 * knowing divergence under the deterministic-emit-order invariant.
 * Minimal output is the plain origin filter: authored slots only. No
 * number fast path: a bare number is not a valid font value.
 */
export const fontDef: ShorthandDef = defineShorthand({
  canonical: 'font',
  longhands: FONT_LONGHANDS,
  parse,
  expand,
  unsupported: (parsed) =>
    parsed.form === 'system'
      ? 'system-font'
      : parsed.form === 'oblique-angle'
        ? 'oblique-angle'
        : null,
});
