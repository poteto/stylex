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
import { varFunction } from '../css-wide';
import { defineShorthand } from '../define';
import { walkComponents } from './slots';

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
 * singleComponentIsIdentity keeps the default (true): a one-component
 * value like 'border: solid' nominally lives on a DIFFERENT key
 * (borderStyle), but the old splitter's single-token early-return
 * accepted such values silently, so the boundary's fast path must keep
 * treating them as identity in minimal output. The grammar still
 * classifies lone components when it runs: spec output (which never
 * consults the fast path) expands them with the omitted-slot defaults.
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
      const { components, matchRange, sliceOf, fail, finish } =
        walkComponents(input);
      if (components.length === 0) {
        return fail('Expected at least one component');
      }

      const filled: {
        width: string | null,
        style: string | null,
        color: string | null,
      } = { width: null, style: null, color: null };
      const variables: Array<string> = [];

      for (const range of components) {
        const varMatch = matchRange(variable, range);
        if (varMatch != null) {
          variables.push(varMatch.raw);
          continue;
        }

        let matched = false;
        for (const slot of SLOT_ORDER) {
          if (filled[slot] != null) {
            continue;
          }
          const match = matchRange(slots[slot], range);
          if (match != null) {
            filled[slot] = match.raw;
            matched = true;
            break;
          }
        }
        if (matched) {
          continue;
        }

        const componentText = sliceOf(range);
        const duplicate = SLOT_ORDER.find(
          (slot) =>
            filled[slot] != null && matchRange(slots[slot], range) != null,
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

      finish();
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
  });
}
