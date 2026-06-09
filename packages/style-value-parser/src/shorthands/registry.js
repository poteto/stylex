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
import {
  borderBottomDef,
  borderDef,
  borderLeftDef,
  borderRightDef,
  borderTopDef,
} from '../properties/border';
import { animationDef } from '../properties/animation';
import { backgroundDef } from '../properties/background';
import { borderColorDef } from '../properties/border-color';
import { borderRadiusDef } from '../properties/border-radius';
import { borderStyleDef } from '../properties/border-style';
import { borderWidthDef } from '../properties/border-width';
import { cornerShapeDef } from '../properties/corner-shape';
import { flexDef } from '../properties/flex';
import { fontDef } from '../properties/font';
import { gapDef } from '../properties/gap';
import {
  gridAreaDef,
  gridColumnDef,
  gridRowDef,
} from '../properties/grid-lines';
import { gridTemplateDef } from '../properties/grid-template';
import { insetBlockDef, insetDef, insetInlineDef } from '../properties/inset';
import {
  marginBlockDef,
  marginDef,
  marginInlineDef,
} from '../properties/margin';
import { outlineDef } from '../properties/outline';
import { overflowDef } from '../properties/overflow';
import { overscrollBehaviorDef } from '../properties/overscroll-behavior';
import {
  paddingBlockDef,
  paddingDef,
  paddingInlineDef,
} from '../properties/padding';
import { scrollMarginDef } from '../properties/scroll-margin';
import { scrollPaddingDef } from '../properties/scroll-padding';

/**
 * THE registry: one frozen object keyed by stylex camelCase key. Adding
 * shorthand N+1 is one def module plus one line here; every lookup below
 * derives from this object at module init and is never synced by hand.
 */
export const registry: Readonly<{ +[string]: ShorthandDef }> = Object.freeze({
  animation: animationDef,
  background: backgroundDef,
  border: borderDef,
  borderBottom: borderBottomDef,
  borderColor: borderColorDef,
  borderLeft: borderLeftDef,
  borderRadius: borderRadiusDef,
  borderRight: borderRightDef,
  borderStyle: borderStyleDef,
  borderTop: borderTopDef,
  borderWidth: borderWidthDef,
  cornerShape: cornerShapeDef,
  flex: flexDef,
  font: fontDef,
  gap: gapDef,
  gridArea: gridAreaDef,
  gridColumn: gridColumnDef,
  gridRow: gridRowDef,
  gridTemplate: gridTemplateDef,
  inset: insetDef,
  insetBlock: insetBlockDef,
  insetInline: insetInlineDef,
  margin: marginDef,
  marginBlock: marginBlockDef,
  marginInline: marginInlineDef,
  outline: outlineDef,
  overflow: overflowDef,
  overscrollBehavior: overscrollBehaviorDef,
  padding: paddingDef,
  paddingBlock: paddingBlockDef,
  paddingInline: paddingInlineDef,
  scrollMargin: scrollMarginDef,
  scrollPadding: scrollPaddingDef,
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
