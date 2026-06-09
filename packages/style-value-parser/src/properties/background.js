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
import { lengthPercentage } from '../css-types/length-percentage';
import { mathFunction } from '../css-types/math-function';
import { hasTopLevelComma, varFunction } from '../shorthands/css-wide';
import { defineShorthand } from '../shorthands/define';
import {
  balancedFunction,
  identKeyword,
  walkComponents,
} from '../shorthands/families/slots';
import { colorSlot } from './border';

/**
 * One parse, tagged by form. 'multiple-layers' (a top-level comma) and
 * 'box-keyword' (a <box> origin/clip keyword) are recognized but refused
 * through the def's typed hooks: per-layer distribution cannot merge
 * atomically, and this def deliberately covers only the SIX longhands
 * the old splitter knew -- backgroundOrigin and backgroundClip are not
 * among them, so a value that sets them cannot be expanded faithfully.
 * 'value' keeps null for omitted slots so expansion can tell explicit
 * slots from filled-in defaults.
 */
type BackgroundParsed =
  | Readonly<{ form: 'multiple-layers' }>
  | Readonly<{ form: 'box-keyword' }>
  | Readonly<{
      form: 'value',
      color: string | null,
      image: string | null,
      repeat: string | null,
      attachment: string | null,
      position: string | null,
      size: string | null,
    }>;

const imageComponent: TokenParser<unknown> = TokenParser.oneOf(
  identKeyword(['none']),
  // url(a.png) lexes as one URL token; url("a.png") as a url() Function.
  TokenParser.tokens.URL,
  balancedFunction([
    'url',
    'image-set',
    'linear-gradient',
    'radial-gradient',
    'conic-gradient',
    'repeating-linear-gradient',
    'repeating-radial-gradient',
    'repeating-conic-gradient',
    'cross-fade',
    'element',
  ]),
);

const repeatComponent: TokenParser<string> = identKeyword([
  'repeat',
  'repeat-x',
  'repeat-y',
  'no-repeat',
  'space',
  'round',
]);

const attachmentComponent: TokenParser<string> = identKeyword([
  'scroll',
  'fixed',
  'local',
]);

const positionComponent: TokenParser<unknown> = TokenParser.oneOf(
  identKeyword(['left', 'right', 'top', 'bottom', 'center']),
  lengthPercentage,
  mathFunction,
);

const sizeComponent: TokenParser<unknown> = TokenParser.oneOf(
  identKeyword(['auto', 'cover', 'contain']),
  lengthPercentage,
  mathFunction,
);

const boxComponent: TokenParser<string> = identKeyword([
  'border-box',
  'padding-box',
  'content-box',
]);

const sourcedImage = TokenParser.sourced(imageComponent);
const sourcedRepeat = TokenParser.sourced(repeatComponent);
const sourcedAttachment = TokenParser.sourced(attachmentComponent);
const sourcedColor = TokenParser.sourced(colorSlot);
const sourcedPosition = TokenParser.sourced(positionComponent);
const sourcedSize = TokenParser.sourced(sizeComponent);
const sourcedBox = TokenParser.sourced(boxComponent);
const sourcedVar = TokenParser.sourced(varFunction);

type SingleSlot = 'image' | 'repeat' | 'attachment' | 'color';

/** Classification order: the old splitter's fallthrough, spec-grounded. */
const SINGLE_SLOTS: ReadonlyArray<SingleSlot> = [
  'image',
  'repeat',
  'attachment',
  'color',
];

const SINGLE_SLOT_PARSERS = {
  image: sourcedImage,
  repeat: sourcedRepeat,
  attachment: sourcedAttachment,
  color: sourcedColor,
};

/**
 * background = <image> || <repeat> || <attachment> || <color> ||
 *              <position>{1,2} [ / <size>{1,2} ]?     (single layer)
 *
 * A slot-elimination walk over the top-level component split (the
 * line-trio idiom). The position slot takes 1-2 ADJACENT components via
 * a greedy pair lookahead (the font oblique-angle precedent); per spec
 * the pair is one production, so non-adjacent position components are a
 * parse error where the old splitter silently reordered them. The size
 * follows the same pair rule after a top-level '/', which per spec
 * requires a preceding position. 'none' classifies as the image only:
 * the old splitter's unknown-ident fallthrough to color is replaced by
 * a refusal.
 */
const parse: TokenParser<BackgroundParsed> = new TokenParser(
  (input): BackgroundParsed | Error => {
    const { tokens, components, matchRange, sliceOf, isSlash, fail, finish } =
      walkComponents(input);
    if (components.length === 0) {
      return fail('Expected at least one component');
    }

    const done = (parsed: BackgroundParsed): BackgroundParsed => {
      finish();
      return parsed;
    };

    if (hasTopLevelComma(tokens)) {
      return done({ form: 'multiple-layers' });
    }

    const filled: {
      image: string | null,
      repeat: string | null,
      attachment: string | null,
      color: string | null,
    } = { image: null, repeat: null, attachment: null, color: null };
    let position: string | null = null;
    let size: string | null = null;
    const variables: Array<string> = [];

    let index = 0;
    while (index < components.length) {
      const component = components[index];

      if (isSlash(component)) {
        if (position == null) {
          return fail('A background-size slash requires a preceding position');
        }
        if (size != null) {
          return fail('Duplicate background-size slash');
        }
        index++;
        const first =
          index < components.length
            ? matchRange(sourcedSize, components[index])
            : null;
        if (first == null) {
          return fail('Expected a background-size after the slash');
        }
        index++;
        const second =
          index < components.length
            ? matchRange(sourcedSize, components[index])
            : null;
        if (second != null) {
          size = `${first.raw} ${second.raw}`;
          index++;
        } else {
          size = first.raw;
        }
        continue;
      }

      const varMatch = matchRange(sourcedVar, component);
      if (varMatch != null) {
        variables.push(varMatch.raw);
        index++;
        continue;
      }

      if (matchRange(sourcedBox, component) != null) {
        return done({ form: 'box-keyword' });
      }

      let matched = false;
      for (const slot of SINGLE_SLOTS) {
        if (filled[slot] != null) {
          continue;
        }
        const match = matchRange(SINGLE_SLOT_PARSERS[slot], component);
        if (match != null) {
          filled[slot] = match.raw;
          matched = true;
          break;
        }
      }
      if (matched) {
        index++;
        continue;
      }

      if (position == null) {
        const first = matchRange(sourcedPosition, component);
        if (first != null) {
          const second =
            index + 1 < components.length
              ? matchRange(sourcedPosition, components[index + 1])
              : null;
          if (second != null) {
            position = `${first.raw} ${second.raw}`;
            index += 2;
          } else {
            position = first.raw;
            index += 1;
          }
          continue;
        }
      }

      const componentText = sliceOf(component);
      const duplicate = SINGLE_SLOTS.find(
        (slot) =>
          filled[slot] != null &&
          matchRange(SINGLE_SLOT_PARSERS[slot], component) != null,
      );
      if (duplicate != null) {
        return fail(`Duplicate ${duplicate} component: ${componentText}`);
      }
      if (position != null && matchRange(sourcedPosition, component) != null) {
        return fail(`Duplicate position component: ${componentText}`);
      }
      return fail(`Unexpected component: ${componentText}`);
    }

    if (variables.length > 0) {
      // Elimination considers the single-component slots only. The
      // position and size slots never take a var() by elimination: they
      // hold 1-2 components, so "exactly one open slot" could not tell a
      // var() substituting 'left top' from a one-component position --
      // the guess the elimination rule exists to avoid.
      const open = SINGLE_SLOTS.filter((slot) => filled[slot] == null);
      if (variables.length !== 1 || open.length !== 1) {
        return fail('Cannot place var() components by slot elimination');
      }
      filled[open[0]] = variables[0];
    }

    finish();
    return {
      form: 'value',
      color: filled.color,
      image: filled.image,
      repeat: filled.repeat,
      attachment: filled.attachment,
      position,
      size,
    };
  },
  'Background',
);

type BackgroundLonghand =
  | 'backgroundColor'
  | 'backgroundImage'
  | 'backgroundRepeat'
  | 'backgroundAttachment'
  | 'backgroundPosition'
  | 'backgroundSize';

const BACKGROUND_LONGHANDS: ReadonlyArray<BackgroundLonghand> = [
  'backgroundColor',
  'backgroundImage',
  'backgroundRepeat',
  'backgroundAttachment',
  'backgroundPosition',
  'backgroundSize',
];

const cell = (slice: string | null, initial: string): Cell =>
  slice != null
    ? { raw: slice, origin: 'explicit' }
    : { raw: initial, origin: 'defaulted' };

const expand = (
  parsed: BackgroundParsed,
): Readonly<{ [_k in BackgroundLonghand]: Cell }> => {
  if (parsed.form !== 'value') {
    // Unreachable from CSS input: run() routes these forms through the
    // multipleLayers/unsupported hooks before any expansion.
    throw new Error(`Cannot expand background form: ${parsed.form}`);
  }
  return {
    backgroundColor: cell(parsed.color, 'transparent'),
    backgroundImage: cell(parsed.image, 'none'),
    backgroundRepeat: cell(parsed.repeat, 'repeat'),
    backgroundAttachment: cell(parsed.attachment, 'scroll'),
    backgroundPosition: cell(parsed.position, '0% 0%'),
    backgroundSize: cell(parsed.size, 'auto'),
  };
};

/**
 * Emit order is the old splitter's emit order (color, image, repeat,
 * attachment, position, size). Spec defaults fill the omitted slots; the
 * deliberate subset means backgroundOrigin/backgroundClip are neither
 * emitted nor reset (box keywords refuse instead). Minimal output is the
 * plain origin filter: authored slots only ('background: red' single
 * stays unreported via the boundary fast path). No number fast path: a
 * bare number is not a valid background value.
 */
export const backgroundDef: ShorthandDef = defineShorthand({
  canonical: 'background',
  longhands: BACKGROUND_LONGHANDS,
  parse,
  expand,
  multipleLayers: (parsed) => parsed.form === 'multiple-layers',
  unsupported: (parsed) =>
    parsed.form === 'box-keyword' ? 'background-box-values' : null,
});
