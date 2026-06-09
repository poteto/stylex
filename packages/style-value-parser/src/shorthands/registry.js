/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from './define';

import { camelize } from './define';
import { marginDef } from '../properties/margin';

/**
 * THE registry: one frozen object keyed by stylex camelCase key. Adding
 * shorthand N+1 is one def module plus one line here; every lookup below
 * derives from this object at module init and is never synced by hand.
 */
export const registry: Readonly<{ +[string]: ShorthandDef }> = Object.freeze({
  margin: marginDef,
});

const byAlias: Map<string, ShorthandDef> = new Map();
for (const key of Object.keys(registry)) {
  const def = registry[key];
  byAlias.set(def.key, def);
  byAlias.set(def.canonical, def);
  for (const alias of def.aliases) {
    byAlias.set(alias, def);
    byAlias.set(camelize(alias), def);
  }
}

/** stylex camelCase | canonical kebab | legacy alias -> registry key. */
export function normalizeKey(property: string): string {
  return byAlias.get(property)?.key ?? property;
}

export function lookupShorthand(property: string): ShorthandDef | null {
  return byAlias.get(property) ?? null;
}

/** Lint predicate: is this key a shorthand the engine can expand? */
export function isShorthand(property: string): boolean {
  return byAlias.has(property);
}
