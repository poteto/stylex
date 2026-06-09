/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * Where a longhand's value came from. THE load-bearing invariant: presence
 * survives parsing, so emission modes are projections, not re-parses.
 *
 *  - 'explicit':   the author wrote this component.
 *  - 'replicated': implied by an authored component (TRBL fill, css-wide
 *                  keyword fan-out, vertical radius defaulting to horizontal).
 *  - 'defaulted':  the shorthand's defined default for an omitted slot
 *                  (usually the longhand's initial value). Spec output emits
 *                  these; minimal output never does.
 */
export type LonghandOrigin = 'explicit' | 'replicated' | 'defaulted';

/**
 * One emitted longhand declaration.
 * `property` is the stylex camelCase key (what both consumers write).
 * `value` is a verbatim source slice for explicit/replicated origins (an
 * autofix relocates the author's text, never rewrites it) and a canonical
 * initial-value string for defaulted origins. Numbers stay numbers.
 */
export type Declaration = Readonly<{
  property: string,
  value: string | number,
  origin: LonghandOrigin,
}>;

export type EmitOptions = Readonly<{
  /**
   * 'spec':    every longhand, omitted slots reset to defaults (compiler).
   * 'minimal': authored content only, condensed to the fewest stylex keys
   *            (lint autofix). Documented divergence from spec resets.
   */
  output: 'spec' | 'minimal',
  /** Gate for `!important` passthrough; mirrors the lint rule option. */
  allowImportant?: boolean,
  /** Map physical sides/corners to logical on 3-4 value forms (lint option). */
  preferInline?: boolean,
}>;

/** Structured, renderable refusal. Never a throw across the boundary. */
export type CannotExpandReason =
  | Readonly<{ kind: 'parse-error', message: string }>
  | Readonly<{ kind: 'contains-variable' }>
  | Readonly<{ kind: 'multiple-layers' }>
  | Readonly<{ kind: 'important-disallowed' }>
  | Readonly<{ kind: 'unsupported-feature', feature: string }>;

/**
 * The four-way boundary result. Exhaustive switch at every call site:
 *  - ok:            write/replace with `assignments`.
 *  - not-shorthand: property unknown to the registry; pass the pair through.
 *  - no-op:         expansion would be identity (single-component value in
 *                   minimal output, incl. lone `var()`/css-wide keyword);
 *                   lint reports nothing.
 *  - cannot-expand: genuine shorthand we refuse to split; lint reports
 *                   without a fixer, compiler routes through
 *                   propertyValidationMode.
 */
export type ExpandResult =
  | Readonly<{
      type: 'ok',
      assignments: ReadonlyArray<Declaration>,
      important: boolean,
    }>
  | Readonly<{ type: 'not-shorthand' }>
  | Readonly<{ type: 'no-op' }>
  | Readonly<{ type: 'cannot-expand', reason: CannotExpandReason }>;

/** Internal expansion cell, pre key-mapping and !important suffixing. */
export type Cell = Readonly<{
  raw: string | number,
  origin: LonghandOrigin,
}>;
