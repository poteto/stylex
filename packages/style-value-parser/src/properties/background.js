/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ComponentRange } from '../shorthands/css-wide';
import type { ShorthandDef } from '../shorthands/define';
import type { Cell } from '../shorthands/types';
import type { ComponentWalk } from '../shorthands/families/slots';

import { TokenParser } from '../token-parser';
import { lengthPercentage } from '../css-types/length-percentage';
import { mathFunction } from '../css-types/math-function';
import { varFunction } from '../shorthands/css-wide';
import { defineShorthand } from '../shorthands/define';
import {
  balancedFunction,
  identKeyword,
  splitOnCommas,
  walkComponents,
} from '../shorthands/families/slots';
import { colorSlot } from './border';

/**
 * One parse, tagged by form. 'box-keyword' (a <box> origin/clip keyword
 * in any layer) is recognized but refused through the def's typed hook:
 * this def deliberately covers only the SIX longhands the old splitter
 * knew -- backgroundOrigin and backgroundClip are not among them, so a
 * value that sets them cannot be expanded faithfully. 'value' holds one
 * slot record per comma-separated layer, with null for a layer's
 * omitted slots so expansion can tell explicit slots from filled-in
 * defaults.
 */
type BackgroundLayer = Readonly<{
  color: string | null,
  image: string | null,
  repeat: string | null,
  attachment: string | null,
  position: string | null,
  size: string | null,
}>;

type BackgroundParsed =
  | Readonly<{ form: 'box-keyword' }>
  | Readonly<{ form: 'value', layers: ReadonlyArray<BackgroundLayer> }>;

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

// Two-value repeat forms draw only from this subset per the grammar
// `repeat-x | repeat-y | [ repeat | space | round | no-repeat ]{1,2}`;
// repeat-x and repeat-y are single-only.
const repeatPairComponent: TokenParser<string> = identKeyword([
  'repeat',
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

// The origin/clip <box> keywords, including the newer CSS Backgrounds 4
// clip values `border-area` and `text`. Recognizing the full set keeps a
// box value routed through the typed background-box-values refusal (the
// def emits no origin/clip longhand) instead of falling through to a
// stray "unexpected component" parse error.
const boxComponent: TokenParser<string> = identKeyword([
  'border-box',
  'padding-box',
  'content-box',
  'border-area',
  'text',
]);

const sourcedImage = TokenParser.sourced(imageComponent);
const sourcedRepeat = TokenParser.sourced(repeatComponent);
const sourcedRepeatPair = TokenParser.sourced(repeatPairComponent);
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
 * <bg-layer> = <image> || <repeat> || <attachment> || <color> ||
 *              <position>{1,2} [ / <size>{1,2} ]?
 *
 * A slot-elimination walk over ONE layer's component ranges (the
 * line-trio idiom). The position slot takes 1-2 ADJACENT components via
 * a greedy pair lookahead (the font oblique-angle precedent); per spec
 * the pair is one production, so non-adjacent position components are a
 * parse error where the old splitter silently reordered them. The size
 * follows the same pair rule after a top-level '/', which per spec
 * requires a preceding position. 'none' classifies as the image only:
 * the old splitter's unknown-ident fallthrough to color is replaced by
 * a refusal. Returns 'box-keyword' when a <box> component appears
 * (refused at the def level) and a walk-rewinding Error on failure.
 */
const parseLayer = (
  walk: ComponentWalk,
  components: ReadonlyArray<ComponentRange>,
): BackgroundLayer | 'box-keyword' | Error => {
  const { matchRange, sliceOf, isSlash, fail } = walk;

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
      return 'box-keyword';
    }

    let matched = false;
    for (const slot of SINGLE_SLOTS) {
      if (filled[slot] != null) {
        continue;
      }
      const match = matchRange(SINGLE_SLOT_PARSERS[slot], component);
      if (match != null) {
        filled[slot] = match.raw;
        // <repeat-style> admits a second adjacent keyword (position-pair
        // precedent); repeat-x/repeat-y fail the pair parser and stay single.
        if (
          slot === 'repeat' &&
          matchRange(sourcedRepeatPair, component) != null &&
          index + 1 < components.length
        ) {
          const second = matchRange(sourcedRepeatPair, components[index + 1]);
          if (second != null) {
            filled.repeat = `${match.raw} ${second.raw}`;
            index += 1;
          }
        }
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

  return {
    color: filled.color,
    image: filled.image,
    repeat: filled.repeat,
    attachment: filled.attachment,
    position,
    size,
  };
};

/**
 * background = <bg-layer># , <final-bg-layer>
 *
 * Top-level commas split the walked span into layers; each layer runs
 * the single-layer matcher above. Empty layers (leading, trailing, or
 * doubled commas) are a parse error, and so is a color in a non-final
 * layer: background-color is not a layered property, so CSS Backgrounds
 * 3 only allows it in the last layer.
 */
const parse: TokenParser<BackgroundParsed> = new TokenParser(
  (input): BackgroundParsed | Error => {
    const walk = walkComponents(input);
    const { components, fail, finish } = walk;
    if (components.length === 0) {
      return fail('Expected at least one component');
    }

    const groups = splitOnCommas(walk);
    const layers: Array<BackgroundLayer> = [];
    for (let index = 0; index < groups.length; index++) {
      const group = groups[index];
      if (group.length === 0) {
        return fail('Empty background layer');
      }
      const layer = parseLayer(walk, group);
      if (layer instanceof Error) {
        return layer;
      }
      if (layer === 'box-keyword') {
        finish();
        return { form: 'box-keyword' };
      }
      if (index < groups.length - 1 && layer.color != null) {
        return fail(
          `A background color outside the final layer: ${layer.color}`,
        );
      }
      layers.push(layer);
    }

    finish();
    return { form: 'value', layers };
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

/**
 * One layered longhand's cell: each layer contributes its authored
 * slice or that layer's default, comma-joined in layer order so every
 * joined value carries one entry per layer. The declaration is
 * 'explicit' when ANY layer authored the slot, 'defaulted' only when
 * none did. A single layer degenerates to the plain cell.
 */
const joinedCell = (
  layers: ReadonlyArray<BackgroundLayer>,
  select: (layer: BackgroundLayer) => string | null,
  initial: string,
): Cell => ({
  raw: layers.map((layer) => select(layer) ?? initial).join(', '),
  origin: layers.some((layer) => select(layer) != null)
    ? 'explicit'
    : 'defaulted',
});

/** Layered slots only: color is per-value, not per-layer (see expand). */
const LAYERED_SELECTORS: ReadonlyArray<
  (layer: BackgroundLayer) => string | null,
> = [
  (layer) => layer.image,
  (layer) => layer.repeat,
  (layer) => layer.attachment,
  (layer) => layer.position,
  (layer) => layer.size,
];

/**
 * True when some layers author a slot that other layers omit. A minimal
 * autofix must never invent values the author didn't write, and joining
 * an asymmetric slot would have to fill the omitting layers' defaults
 * inside the list -- so minimal output refuses these (spec output fills
 * defaults by definition and expands them fine). Color is exempt: it is
 * only ever authored in the final layer and emits un-joined.
 */
const hasAsymmetricLayers = (layers: ReadonlyArray<BackgroundLayer>): boolean =>
  layers.length > 1 &&
  LAYERED_SELECTORS.some((select) => {
    const authored = layers.filter((layer) => select(layer) != null).length;
    return authored > 0 && authored < layers.length;
  });

const expand = (
  parsed: BackgroundParsed,
): Readonly<{ [_k in BackgroundLonghand]: Cell }> => {
  if (parsed.form !== 'value') {
    // Unreachable from CSS input: run() routes this form through the
    // unsupported hook before any expansion.
    throw new Error(`Cannot expand background form: ${parsed.form}`);
  }
  const { layers } = parsed;
  return {
    // backgroundColor is a single value, never comma-joined: only the
    // final layer may author it, and 'transparent' is the whole
    // property's initial value, not a per-layer default.
    backgroundColor: cell(layers[layers.length - 1].color, 'transparent'),
    backgroundImage: joinedCell(layers, (layer) => layer.image, 'none'),
    backgroundRepeat: joinedCell(layers, (layer) => layer.repeat, 'repeat'),
    backgroundAttachment: joinedCell(
      layers,
      (layer) => layer.attachment,
      'scroll',
    ),
    backgroundPosition: joinedCell(layers, (layer) => layer.position, '0% 0%'),
    backgroundSize: joinedCell(layers, (layer) => layer.size, 'auto'),
  };
};

/**
 * Emit order is the old splitter's emit order (color, image, repeat,
 * attachment, position, size). Spec defaults fill the omitted slots,
 * per layer for the comma-joined longhands; the deliberate subset means
 * backgroundOrigin/backgroundClip are neither emitted nor reset (box
 * keywords refuse instead). Minimal output is the plain origin filter:
 * authored slots only ('background: red' single stays unreported via
 * the boundary fast path), with asymmetric layer authorship refused
 * through the unsupported hook so the filter never emits a joined list
 * holding invented defaults. No number fast path: a bare number is not
 * a valid background value.
 */
export const backgroundDef: ShorthandDef = defineShorthand({
  canonical: 'background',
  longhands: BACKGROUND_LONGHANDS,
  parse,
  expand,
  unsupported: (parsed, options) => {
    if (parsed.form === 'box-keyword') {
      return 'background-box-values';
    }
    if (options.output === 'minimal' && hasAsymmetricLayers(parsed.layers)) {
      return 'asymmetric-layers';
    }
    return null;
  },
});
