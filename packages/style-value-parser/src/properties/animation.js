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
import { Time } from '../css-types/time';
import { hasTopLevelComma, varFunction } from '../shorthands/css-wide';
import { defineShorthand } from '../shorthands/define';
import {
  balancedFunction,
  identKeyword,
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
 * One parse, tagged by form. 'multiple-layers' (a top-level comma) is
 * recognized but refused through the def's typed hook: per-layer
 * distribution cannot merge atomically. 'value' keeps null for omitted
 * slots so expansion can tell explicit slots from filled-in defaults.
 */
type AnimationParsed =
  | Readonly<{ form: 'multiple-layers' }>
  | Readonly<{ form: 'value', slots: Readonly<SlotRecord> }>;

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
 * animation = <time>{1,2} || <easing-function> ||
 *             <single-animation-iteration-count> ||
 *             <single-animation-direction> || <single-animation-fill-mode>
 *             || <single-animation-play-state> || <keyframes-name>
 *             (single layer)
 *
 * A slot-elimination walk over the top-level component split (the
 * line-trio idiom). The slots are heavily keyword-discriminated, so a
 * single top-level var() still places by elimination when exactly one
 * slot remains open.
 */
const parse: TokenParser<AnimationParsed> = new TokenParser(
  (input): AnimationParsed | Error => {
    const { tokens, components, matchRange, sliceOf, fail, finish } =
      walkComponents(input);
    if (components.length === 0) {
      return fail('Expected at least one component');
    }

    if (hasTopLevelComma(tokens)) {
      finish();
      return { form: 'multiple-layers' };
    }

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

    // The old splitter's none-name rule: a bare 'none' is ambiguous
    // between fill-mode and name, and classification sends it to
    // fill-mode first. Since 'none' is fill-mode's initial value, a walk
    // that ends with the name unfilled relocates that 'none' (verbatim)
    // to animationName. Runs after var() elimination, so a var() placed
    // on the name keeps an authored 'none' on fill-mode.
    if (
      filled.name == null &&
      filled.fillMode != null &&
      filled.fillMode.toLowerCase() === 'none'
    ) {
      filled.name = filled.fillMode;
      filled.fillMode = null;
    }

    finish();
    return { form: 'value', slots: { ...filled } };
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

const cell = (slice: string | null, initial: string): Cell =>
  slice != null
    ? { raw: slice, origin: 'explicit' }
    : { raw: initial, origin: 'defaulted' };

const expand = (
  parsed: AnimationParsed,
): Readonly<{ [_k in AnimationLonghand]: Cell }> => {
  if (parsed.form !== 'value') {
    // Unreachable from CSS input: run() routes this form through the
    // multipleLayers hook before any expansion.
    throw new Error(`Cannot expand animation form: ${parsed.form}`);
  }
  const { slots } = parsed;
  return {
    animationDuration: cell(slots.duration, '0s'),
    animationTimingFunction: cell(slots.timingFunction, 'ease'),
    animationDelay: cell(slots.delay, '0s'),
    animationIterationCount: cell(slots.iterationCount, '1'),
    animationDirection: cell(slots.direction, 'normal'),
    animationFillMode: cell(slots.fillMode, 'none'),
    animationPlayState: cell(slots.playState, 'running'),
    animationName: cell(slots.name, 'none'),
  };
};

/**
 * Emit order is the old splitter's emit order (duration, timing, delay,
 * iteration, direction, fill, play, name), which also matches the slot
 * list above. Minimal output is the plain origin filter: authored slots
 * only ('animation: spin' single stays unreported via the boundary fast
 * path). No number fast path: a bare number is not a valid animation
 * value (the name production refuses numbers, so the stringified
 * fallback lands in the grammar and refuses it).
 */
export const animationDef: ShorthandDef = defineShorthand({
  canonical: 'animation',
  longhands: ANIMATION_LONGHANDS,
  parse,
  expand,
  multipleLayers: (parsed) => parsed.form === 'multiple-layers',
});
