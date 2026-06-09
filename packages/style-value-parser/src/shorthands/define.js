/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { TokenParser } from '../token-parser';
import type { TokenList } from '../token-types';
import type { Cell, Declaration, EmitOptions, ExpandResult } from './types';

import { TokenType } from '@csstools/css-tokenizer';

export function camelize(cssName: string): string {
  return cssName.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

/**
 * Monomorphic registry entry. The grammar's value type T is hidden: `run`
 * closes over parse+expand+condense, so a def's pieces can never be
 * mismatched and the registry needs no generics.
 */
export type ShorthandDef = Readonly<{
  /** Canonical CSS name, kebab-case: 'border-top'. */
  canonical: string,
  /** Primary stylex key, camelCase: 'borderTop' (derived from canonical). */
  key: string,
  /** Extra accepted keys mapping to this def: e.g. 'gridGap' on gap. */
  aliases: ReadonlyArray<string>,
  /** Spec-ordered longhand stylex keys. THE list; everything else derives. */
  longhands: ReadonlyArray<string>,
  /**
   * Physical-to-logical key table applied at the boundary when the caller
   * asks for `preferInline`. Registry data, not family logic, because the
   * key naming is not uniform across shorthands (marginLeft vs
   * borderLeftWidth).
   */
  dialectMap: Readonly<{ +[string]: string }>,
  /**
   * Parse (already-tokenized, !important/css-wide/var pre-passes done) and
   * emit declarations per EmitOptions. Implements:
   *   spec    -> expand(T): every longhand, in `longhands` order
   *   minimal -> condense(T) if provided, else origin-filter of expand(T)
   * `important` is always false here; the boundary owns !important.
   */
  run: (tokens: TokenList, options: EmitOptions) => ExpandResult,
  /**
   * Numeric fast path: a number is single-component by construction, so
   * minimal output is always a no-op and spec output fans the number out
   * with numeric identity preserved. Null when the shorthand has no
   * meaningful single-number form.
   */
  runNumber: ?(value: number, options: EmitOptions) => ExpandResult,
  /**
   * Minimal-mode fast-path gate. True (the default) means a
   * single-component value is treated as already minimal, so the
   * boundary may no-op before any grammar runs (quads, pairs, corners,
   * line trios). grid-area sets false: 'grid-area: header' is one
   * component but its minimal form lives on four different keys, so it
   * must reach def.run even in minimal output.
   */
  singleComponentIsIdentity: boolean,
}>;

/**
 * Builds a ShorthandDef from typed pieces.
 *
 * Exhaustiveness: K is the union of the literal strings in `longhands`;
 * the mapped return type of `expand` forces a Cell for EVERY longhand --
 * forgetting one is a Flow error at the def site, not a runtime surprise.
 * (Family factories that compute keys at runtime infer K = string and give
 * up that check; defs written with literal keys keep it.)
 *
 * `parse` is evaluated ONCE at module load and held -- unlike the
 * `static get parse` idiom which rebuilds the combinator graph per access.
 */
export function defineShorthand<T, K: string>(
  config: Readonly<{
    canonical: string,
    longhands: ReadonlyArray<K>,
    aliases?: ReadonlyArray<string>,
    dialectMap?: Readonly<{ +[string]: string }>,
    parse: TokenParser<T>,
    expand: (parsed: T) => Readonly<{ [_k in K]: Cell }>,
    /**
     * Typed non-parse refusal for values the grammar recognizes but the
     * engine cannot expand (font's system keywords, oblique <angle>).
     * Checked after a successful parse and before any expansion; a
     * non-null feature name becomes a cannot-expand result with reason
     * unsupported-feature.
     */
    unsupported?: (parsed: T) => ?string,
    /**
     * Typed refusal for comma-separated layer lists (background,
     * animation): the grammar tags the multi-layer form on a per-def
     * top-level comma scan -- never boundary-global, since font's
     * comma-bearing family lists are not layers. Per-layer distribution
     * cannot merge atomically, so a true here becomes a cannot-expand
     * result with reason multiple-layers. Checked before `unsupported`.
     */
    multipleLayers?: (parsed: T) => boolean,
    /**
     * Optional minimal-output override where the smallest representation
     * uses intermediate stylex keys the plain origin-filter cannot produce
     * (marginBlock/marginInline pairing; grid-area's single custom-ident;
     * the all-identical collapse onto the shorthand's own key, received
     * here as `key`). Returning null signals that expansion would be
     * identity (no-op).
     */
    condense?: (
      parsed: T,
      options: EmitOptions,
      key: string,
    ) => ?ReadonlyArray<Declaration>,
    /** Spec-output cells for a single numeric component. */
    expandNumber?: (value: number) => Readonly<{ [_k in K]: Cell }>,
    /** See ShorthandDef.singleComponentIsIdentity; defaults to true. */
    singleComponentIsIdentity?: boolean,
  }>,
): ShorthandDef {
  const {
    canonical,
    longhands,
    parse,
    expand,
    condense,
    expandNumber,
    unsupported,
    multipleLayers,
  } = config;
  const key = camelize(canonical);

  const project = (
    cells: Readonly<{ [_k in K]: Cell }>,
  ): ReadonlyArray<Declaration> =>
    longhands.map((property) => {
      const cell = cells[property];
      return { property, value: cell.raw, origin: cell.origin };
    });

  const run = (tokens: TokenList, options: EmitOptions): ExpandResult => {
    const parsed = parse.run(tokens);
    if (parsed instanceof Error) {
      return {
        type: 'cannot-expand',
        reason: { kind: 'parse-error', message: parsed.message },
      };
    }
    let trailing = tokens.peek();
    while (trailing != null && trailing[0] === TokenType.Whitespace) {
      tokens.consumeNextToken();
      trailing = tokens.peek();
    }
    if (trailing != null && trailing[0] !== TokenType.EOF) {
      return {
        type: 'cannot-expand',
        reason: {
          kind: 'parse-error',
          message: `Unexpected trailing input: ${trailing[1]}`,
        },
      };
    }

    if (multipleLayers != null && multipleLayers(parsed)) {
      return {
        type: 'cannot-expand',
        reason: { kind: 'multiple-layers' },
      };
    }

    const feature = unsupported != null ? unsupported(parsed) : null;
    if (feature != null) {
      return {
        type: 'cannot-expand',
        reason: { kind: 'unsupported-feature', feature },
      };
    }

    if (options.output === 'spec') {
      return {
        type: 'ok',
        assignments: project(expand(parsed)),
        important: false,
      };
    }
    const assignments =
      condense != null
        ? condense(parsed, options, key)
        : project(expand(parsed)).filter((d) => d.origin !== 'defaulted');
    if (assignments == null) {
      return { type: 'no-op' };
    }
    return { type: 'ok', assignments, important: false };
  };

  const runNumber =
    expandNumber == null
      ? null
      : (value: number, options: EmitOptions): ExpandResult => {
          if (options.output === 'minimal') {
            return { type: 'no-op' };
          }
          return {
            type: 'ok',
            assignments: project(expandNumber(value)),
            important: false,
          };
        };

  return {
    canonical,
    key,
    aliases: config.aliases ?? [],
    longhands,
    dialectMap: config.dialectMap ?? {},
    run,
    runNumber,
    singleComponentIsIdentity: config.singleComponentIsIdentity !== false,
  };
}
