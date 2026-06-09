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
import { Time } from '../css-types/time';
import { varFunction } from '../shorthands/css-wide';
import { defineShorthand } from '../shorthands/define';
import {
  balancedFunction,
  identKeyword,
  splitOnCommas,
  walkComponents,
} from '../shorthands/families/slots';

type SlotName =
  | 'duration'
  | 'timingFunction'
  | 'delay'
  | 'iterationCount'
  | 'direction'
  | 'fillMode'
  | 'playState'
  | 'name';

type SlotRecord = {
  duration: string | null,
  timingFunction: string | null,
  delay: string | null,
  iterationCount: string | null,
  direction: string | null,
  fillMode: string | null,
  playState: string | null,
  name: string | null,
};

/**
 * One slot record per comma-separated layer, in authored order. A
 * layer's omitted slots keep null so expansion can tell explicit slots
 * from filled-in defaults.
 */
type AnimationParsed = Readonly<{
  layers: ReadonlyArray<Readonly<SlotRecord>>,
}>;

const timingComponent: TokenParser<unknown> = TokenParser.oneOf(
  identKeyword([
    'ease',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'linear',
    'step-start',
    'step-end',
  ]),
  balancedFunction(['cubic-bezier', 'steps', 'linear']),
);

const directionComponent: TokenParser<string> = identKeyword([
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
]);

const fillModeComponent: TokenParser<string> = identKeyword([
  'none',
  'forwards',
  'backwards',
  'both',
]);

const playStateComponent: TokenParser<string> = identKeyword([
  'running',
  'paused',
]);

const iterationCountComponent: TokenParser<unknown> = TokenParser.oneOf(
  identKeyword(['infinite']),
  TokenParser.tokens.Number.map((token): number => token[4].value).where(
    (value): implies value is number => value >= 0,
  ),
);

/**
 * A <keyframes-name> custom-ident: 'none' is excluded (it only reaches
 * animationName through the none-name rule below) along with the
 * CSS-wide keywords, mirroring the grid splitter's non-custom-ident
 * guard. Quoted-string keyframes names are not accepted: the slot
 * grammars deal in idents, and the old splitter's anything-goes name
 * fallback accepted garbage this refusal now surfaces.
 */
const NON_NAME_KEYWORDS: ReadonlySet<string> = new Set([
  'none',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

const nameComponent: TokenParser<string> = TokenParser.tokens.Ident.map(
  (token): string => token[4].value,
).where(
  (str): implies str is string => !NON_NAME_KEYWORDS.has(str.toLowerCase()),
);

const sourcedTime = TokenParser.sourced(Time.parser);
const sourcedTiming = TokenParser.sourced(timingComponent);
const sourcedDirection = TokenParser.sourced(directionComponent);
const sourcedFillMode = TokenParser.sourced(fillModeComponent);
const sourcedPlayState = TokenParser.sourced(playStateComponent);
const sourcedIterationCount = TokenParser.sourced(iterationCountComponent);
const sourcedName = TokenParser.sourced(nameComponent);
const sourcedVar = TokenParser.sourced(varFunction);

type KeywordSlot = Exclude<SlotName, 'duration' | 'delay'>;

/**
 * Classification order: the old splitter's fallthrough. Time components
 * are positional and tried first (per spec the first <time> is the
 * duration, the second the delay); the name is the last resort.
 */
const KEYWORD_SLOT_ORDER: ReadonlyArray<KeywordSlot> = [
  'timingFunction',
  'direction',
  'fillMode',
  'playState',
  'iterationCount',
  'name',
];

const KEYWORD_SLOT_PARSERS = {
  timingFunction: sourcedTiming,
  direction: sourcedDirection,
  fillMode: sourcedFillMode,
  playState: sourcedPlayState,
  iterationCount: sourcedIterationCount,
  name: sourcedName,
};

/** Emission and var-elimination order; also the def's longhand order. */
const ALL_SLOTS: ReadonlyArray<SlotName> = [
  'duration',
  'timingFunction',
  'delay',
  'iterationCount',
  'direction',
  'fillMode',
  'playState',
  'name',
];

/**
 * <single-animation> = <time>{1,2} || <easing-function> ||
 *             <single-animation-iteration-count> ||
 *             <single-animation-direction> || <single-animation-fill-mode>
 *             || <single-animation-play-state> || <keyframes-name>
 *
 * A slot-elimination walk over ONE layer's component ranges (the
 * line-trio idiom). The slots are heavily keyword-discriminated, so a
 * single top-level var() still places by elimination when exactly one
 * slot remains open. Returns a walk-rewinding Error on failure.
 */
const parseLayer = (
  walk: ComponentWalk,
  components: ReadonlyArray<ComponentRange>,
): SlotRecord | Error => {
  const { matchRange, sliceOf, fail } = walk;

  const filled: SlotRecord = {
    duration: null,
    timingFunction: null,
    delay: null,
    iterationCount: null,
    direction: null,
    fillMode: null,
    playState: null,
    name: null,
  };
  const variables: Array<string> = [];

  for (const component of components) {
    const varMatch = matchRange(sourcedVar, component);
    if (varMatch != null) {
      variables.push(varMatch.raw);
      continue;
    }

    const timeMatch = matchRange(sourcedTime, component);
    if (timeMatch != null) {
      if (filled.duration == null) {
        filled.duration = timeMatch.raw;
        continue;
      }
      if (filled.delay == null) {
        filled.delay = timeMatch.raw;
        continue;
      }
      return fail(`Too many time components: ${timeMatch.raw}`);
    }

    let matched = false;
    for (const slot of KEYWORD_SLOT_ORDER) {
      if (filled[slot] != null) {
        continue;
      }
      const match = matchRange(KEYWORD_SLOT_PARSERS[slot], component);
      if (match != null) {
        filled[slot] = match.raw;
        matched = true;
        break;
      }
    }
    if (matched) {
      continue;
    }

    const componentText = sliceOf(component);
    const duplicate = KEYWORD_SLOT_ORDER.find(
      (slot) =>
        filled[slot] != null &&
        matchRange(KEYWORD_SLOT_PARSERS[slot], component) != null,
    );
    if (duplicate != null) {
      return fail(`Duplicate ${duplicate} component: ${componentText}`);
    }
    return fail(`Unexpected component: ${componentText}`);
  }

  if (variables.length > 0) {
    const open = ALL_SLOTS.filter((slot) => filled[slot] == null);
    if (variables.length !== 1 || open.length !== 1) {
      return fail('Cannot place var() components by slot elimination');
    }
    filled[open[0]] = variables[0];
  }

  // The old splitter's none-name rule, applied PER LAYER like every
  // other slot decision: a bare 'none' is ambiguous between fill-mode
  // and name, and classification sends it to fill-mode first. Since
  // 'none' is fill-mode's initial value, a layer walk that ends with
  // the name unfilled relocates that 'none' (verbatim) to the layer's
  // animationName. Runs after var() elimination, so a var() placed on
  // the name keeps an authored 'none' on fill-mode.
  if (
    filled.name == null &&
    filled.fillMode != null &&
    filled.fillMode.toLowerCase() === 'none'
  ) {
    filled.name = filled.fillMode;
    filled.fillMode = null;
  }

  return { ...filled };
};

/**
 * animation = <single-animation>#
 *
 * Top-level commas split the walked span into layers; each layer runs
 * the single-layer matcher above. Empty layers (leading, trailing, or
 * doubled commas) are a parse error. Unlike background, no slot is
 * restricted to the final layer: every animation longhand is layered.
 */
const parse: TokenParser<AnimationParsed> = new TokenParser(
  (input): AnimationParsed | Error => {
    const walk = walkComponents(input);
    const { components, fail, finish } = walk;
    if (components.length === 0) {
      return fail('Expected at least one component');
    }

    const layers: Array<SlotRecord> = [];
    for (const group of splitOnCommas(walk)) {
      if (group.length === 0) {
        return fail('Empty animation layer');
      }
      const layer = parseLayer(walk, group);
      if (layer instanceof Error) {
        return layer;
      }
      layers.push(layer);
    }

    finish();
    return { layers };
  },
  'Animation',
);

type AnimationLonghand =
  | 'animationDuration'
  | 'animationTimingFunction'
  | 'animationDelay'
  | 'animationIterationCount'
  | 'animationDirection'
  | 'animationFillMode'
  | 'animationPlayState'
  | 'animationName';

const ANIMATION_LONGHANDS: ReadonlyArray<AnimationLonghand> = [
  'animationDuration',
  'animationTimingFunction',
  'animationDelay',
  'animationIterationCount',
  'animationDirection',
  'animationFillMode',
  'animationPlayState',
  'animationName',
];

/**
 * One longhand's cell: each layer contributes its authored slice or
 * that layer's default, comma-joined in layer order so every joined
 * value carries one entry per layer. The declaration is 'explicit' when
 * ANY layer authored the slot, 'defaulted' only when none did. A single
 * layer degenerates to the plain explicit-or-default cell.
 */
const joinedCell = (
  layers: ReadonlyArray<Readonly<SlotRecord>>,
  slot: SlotName,
  initial: string,
): Cell => ({
  raw: layers.map((layer) => layer[slot] ?? initial).join(', '),
  origin: layers.some((layer) => layer[slot] != null)
    ? 'explicit'
    : 'defaulted',
});

/**
 * True when some layers author a slot that other layers omit. A minimal
 * autofix must never invent values the author didn't write, and joining
 * an asymmetric slot would have to fill the omitting layers' defaults
 * inside the list -- so minimal output refuses these (spec output fills
 * defaults by definition and expands them fine).
 */
const hasAsymmetricLayers = (
  layers: ReadonlyArray<Readonly<SlotRecord>>,
): boolean =>
  layers.length > 1 &&
  ALL_SLOTS.some((slot) => {
    const authored = layers.filter((layer) => layer[slot] != null).length;
    return authored > 0 && authored < layers.length;
  });

const expand = (
  parsed: AnimationParsed,
): Readonly<{ [_k in AnimationLonghand]: Cell }> => {
  const { layers } = parsed;
  return {
    animationDuration: joinedCell(layers, 'duration', '0s'),
    animationTimingFunction: joinedCell(layers, 'timingFunction', 'ease'),
    animationDelay: joinedCell(layers, 'delay', '0s'),
    animationIterationCount: joinedCell(layers, 'iterationCount', '1'),
    animationDirection: joinedCell(layers, 'direction', 'normal'),
    animationFillMode: joinedCell(layers, 'fillMode', 'none'),
    animationPlayState: joinedCell(layers, 'playState', 'running'),
    animationName: joinedCell(layers, 'name', 'none'),
  };
};

/**
 * Emit order is the old splitter's emit order (duration, timing, delay,
 * iteration, direction, fill, play, name), which also matches the slot
 * list above. Spec defaults fill the omitted slots, per layer for the
 * comma-joined longhands. Minimal output is the plain origin filter:
 * authored slots only ('animation: spin' single stays unreported via
 * the boundary fast path), with asymmetric layer authorship refused
 * through the unsupported hook so the filter never emits a joined list
 * holding invented defaults. No number fast path: a bare number is not
 * a valid animation value (the name production refuses numbers, so the
 * stringified fallback lands in the grammar and refuses it).
 */
export const animationDef: ShorthandDef = defineShorthand({
  canonical: 'animation',
  longhands: ANIMATION_LONGHANDS,
  parse,
  expand,
  unsupported: (parsed, options) =>
    options.output === 'minimal' && hasAsymmetricLayers(parsed.layers)
      ? 'asymmetric-layers'
      : null,
});
