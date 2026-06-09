/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { Sourced } from '../../token-parser';
import type { ShorthandDef } from '../define';
import type { Cell } from '../types';

import { TokenParser } from '../../token-parser';
import { splitTopLevelComponents, varFunction } from '../css-wide';
import { defineShorthand } from '../define';

type SlotName = 'width' | 'style' | 'color';

/** Classification order; emission always follows `longhands` order. */
const SLOT_ORDER: ReadonlyArray<SlotName> = ['width', 'style', 'color'];

type SlotRecord<T> = Readonly<{ width: T, style: T, color: T }>;

/** Verbatim slices per slot; null means the author omitted the slot. */
type LineTrio = SlotRecord<string | null>;

/**
 * Factory for `<line-width> || <line-style> || <color>` shorthands
 * (border, border sides, outline): 1-3 space-separated components in ANY
 * order, each slot at most once.
 *
 * The matcher is a hand-rolled slot-elimination pass over the top-level
 * component split, not a permutation-backtracking `setOf`: each component
 * tries the UNFILLED slots' parsers in SLOT_ORDER and must consume its
 * entire component range; a component matching nothing is a parse error,
 * and one matching only an already-filled slot is a parse error naming
 * the duplicate slot. Top-level var() components are collected without
 * being assigned; after classification, exactly one var() may fill
 * exactly one remaining open slot ('border: 1px solid var(--c)' works,
 * 'border: var(--w) solid' refuses). The boundary reclassifies those
 * refusals as contains-variable.
 *
 * Spec output defaults omitted slots per `defaults` (origin 'defaulted');
 * minimal output is the plain origin-filter -- present components only,
 * no collapse concept and no block/inline pairing for trios.
 *
 * singleComponentIsIdentity is false: a one-component value like
 * 'border: solid' minimally lives on a DIFFERENT key (borderStyle), so
 * the boundary's single-component fast path must not swallow it. (The
 * old splitter required all three slots and reported single components
 * CANNOT_FIX; expanding them is a knowing improvement.)
 */
export function lineTrio(
  config: Readonly<{
    canonical: string,
    aliases?: ReadonlyArray<string>,
    /**
     * Grammar for ONE component of each slot; matches are emitted as
     * verbatim slices. Slot parsers must not accept var(): top-level
     * variables are placed by elimination at the matcher level.
     */
    slots: SlotRecord<TokenParser<unknown>>,
    /** The three longhand stylex keys, in spec order width/style/color. */
    longhands: SlotRecord<string>,
    /** Spec-output values for omitted slots (origin 'defaulted'). */
    defaults: SlotRecord<string>,
  }>,
): ShorthandDef {
  const { longhands, defaults } = config;
  const slots: SlotRecord<TokenParser<Sourced<unknown>>> = {
    width: TokenParser.sourced(config.slots.width),
    style: TokenParser.sourced(config.slots.style),
    color: TokenParser.sourced(config.slots.color),
  };
  const variable = TokenParser.sourced(varFunction);

  const parse: TokenParser<LineTrio> = new TokenParser(
    (input): LineTrio | Error => {
      const startIndex = input.currentIndex;
      const fail = (message: string): Error => {
        input.setCurrentIndex(startIndex);
        return new Error(message);
      };

      // Materialize the rest of the input so components can be sliced by
      // range; slot parsers then re-run over exact [start, end) windows.
      let drained = input.consumeNextToken();
      while (drained != null) {
        drained = input.consumeNextToken();
      }
      const endIndex = input.currentIndex;
      const tokens = input.slice(startIndex, endIndex);
      const components = splitTopLevelComponents(tokens);
      if (components.length === 0) {
        return fail('Expected at least one component');
      }

      /** The verbatim slice when `parser` consumes EXACTLY [start, end). */
      const matchRange = (
        parser: TokenParser<Sourced<unknown>>,
        start: number,
        end: number,
      ): string | null => {
        input.setCurrentIndex(start);
        const result = parser.run(input);
        if (result instanceof Error || input.currentIndex !== end) {
          return null;
        }
        return result.raw;
      };

      const filled: {
        width: string | null,
        style: string | null,
        color: string | null,
      } = { width: null, style: null, color: null };
      const variables: Array<string> = [];

      for (const range of components) {
        const start = startIndex + range.start;
        const end = startIndex + range.end;

        const varSlice = matchRange(variable, start, end);
        if (varSlice != null) {
          variables.push(varSlice);
          continue;
        }

        let matched = false;
        for (const slot of SLOT_ORDER) {
          if (filled[slot] != null) {
            continue;
          }
          const slice = matchRange(slots[slot], start, end);
          if (slice != null) {
            filled[slot] = slice;
            matched = true;
            break;
          }
        }
        if (matched) {
          continue;
        }

        const componentText = tokens
          .slice(range.start, range.end)
          .map((token) => token[1])
          .join('');
        const duplicate = SLOT_ORDER.find(
          (slot) =>
            filled[slot] != null && matchRange(slots[slot], start, end) != null,
        );
        if (duplicate != null) {
          return fail(`Duplicate ${duplicate} component: ${componentText}`);
        }
        return fail(`Unexpected component: ${componentText}`);
      }

      if (variables.length > 0) {
        const open = SLOT_ORDER.filter((slot) => filled[slot] == null);
        if (variables.length !== 1 || open.length !== 1) {
          return fail('Cannot place var() components by slot elimination');
        }
        filled[open[0]] = variables[0];
      }

      input.setCurrentIndex(endIndex);
      return { width: filled.width, style: filled.style, color: filled.color };
    },
    `LineTrio<${config.canonical}>`,
  );

  const expand = (trio: LineTrio): Readonly<{ +[string]: Cell }> => {
    const cells: { [string]: Cell } = {};
    for (const slot of SLOT_ORDER) {
      const value = trio[slot];
      cells[longhands[slot]] =
        value != null
          ? { raw: value, origin: 'explicit' }
          : { raw: defaults[slot], origin: 'defaulted' };
    }
    return cells;
  };

  return defineShorthand({
    canonical: config.canonical,
    aliases: config.aliases,
    longhands: [longhands.width, longhands.style, longhands.color],
    parse,
    expand,
    singleComponentIsIdentity: false,
  });
}
