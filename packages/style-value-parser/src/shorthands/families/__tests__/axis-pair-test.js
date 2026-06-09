/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../../define';
import type { EmitOptions } from '../../types';

import { TokenList } from '../../../token-types';
import { marginBlockDef, marginInlineDef } from '../../../properties/margin';
import { paddingBlockDef, paddingInlineDef } from '../../../properties/padding';
import { insetBlockDef, insetInlineDef } from '../../../properties/inset';
import { gapDef } from '../../../properties/gap';
import { overflowDef } from '../../../properties/overflow';
import { overscrollBehaviorDef } from '../../../properties/overscroll-behavior';

function run(def: ShorthandDef, value: string, options: EmitOptions) {
  return def.run(new TokenList(value), options);
}

describe('axis-pair family', () => {
  describe('def metadata', () => {
    it('exposes spec-ordered longhands per def', () => {
      expect(marginBlockDef.longhands).toEqual([
        'marginBlockStart',
        'marginBlockEnd',
      ]);
      expect(marginInlineDef.longhands).toEqual([
        'marginInlineStart',
        'marginInlineEnd',
      ]);
      expect(paddingBlockDef.longhands).toEqual([
        'paddingBlockStart',
        'paddingBlockEnd',
      ]);
      expect(paddingInlineDef.longhands).toEqual([
        'paddingInlineStart',
        'paddingInlineEnd',
      ]);
      expect(insetBlockDef.longhands).toEqual([
        'insetBlockStart',
        'insetBlockEnd',
      ]);
      expect(insetInlineDef.longhands).toEqual([
        'insetInlineStart',
        'insetInlineEnd',
      ]);
      expect(gapDef.longhands).toEqual(['rowGap', 'columnGap']);
      expect(overflowDef.longhands).toEqual(['overflowX', 'overflowY']);
      expect(overscrollBehaviorDef.longhands).toEqual([
        'overscrollBehaviorX',
        'overscrollBehaviorY',
      ]);
    });

    it('registers the gridGap legacy alias on gap', () => {
      expect(gapDef.aliases).toEqual(['grid-gap']);
    });

    it('has no physical/logical dialect at this level', () => {
      for (const def of [
        marginBlockDef,
        marginInlineDef,
        paddingBlockDef,
        paddingInlineDef,
        insetBlockDef,
        insetInlineDef,
        gapDef,
        overflowDef,
        overscrollBehaviorDef,
      ]) {
        expect(def.dialectMap).toEqual({});
      }
    });
  });

  describe('spec output', () => {
    it('replicates a single value onto both longhands', () => {
      expect(run(marginBlockDef, '10px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlockStart', value: '10px', origin: 'explicit' },
          { property: 'marginBlockEnd', value: '10px', origin: 'replicated' },
        ],
      });
    });

    it('marks both values explicit when authored', () => {
      expect(run(gapDef, '10px 20px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'rowGap', value: '10px', origin: 'explicit' },
          { property: 'columnGap', value: '20px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('minimal output', () => {
    it('treats a single value as a no-op', () => {
      expect(run(paddingBlockDef, '10px', { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });

    it('collapses two identical values onto the shorthand key', () => {
      expect(run(marginBlockDef, '10px 10px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: '10px', origin: 'explicit' },
        ],
      });
      expect(run(insetInlineDef, 'auto auto', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'insetInline', value: 'auto', origin: 'explicit' },
        ],
      });
    });

    it('emits both longhands for two distinct values', () => {
      expect(run(paddingInlineDef, '1px 2px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'paddingInlineStart', value: '1px', origin: 'explicit' },
          { property: 'paddingInlineEnd', value: '2px', origin: 'explicit' },
        ],
      });
    });

    it('gap never collapses: identical values still split to row/column', () => {
      expect(run(gapDef, '10px 10px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'rowGap', value: '10px', origin: 'explicit' },
          { property: 'columnGap', value: '10px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('gap components', () => {
    it('accepts the normal keyword and percentages', () => {
      expect(run(gapDef, '10% normal', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'rowGap', value: '10%', origin: 'explicit' },
          { property: 'columnGap', value: 'normal', origin: 'explicit' },
        ],
      });
    });

    it('refuses non-gap values', () => {
      expect(run(gapDef, 'red 10px', { output: 'minimal' }).type).toEqual(
        'cannot-expand',
      );
    });

    it('refuses a third component', () => {
      expect(run(gapDef, '1px 2px 3px', { output: 'spec' }).type).toEqual(
        'cannot-expand',
      );
    });
  });

  describe('overflow and overscroll-behavior', () => {
    it('maps the first value to X and the second to Y', () => {
      expect(run(overflowDef, 'hidden scroll', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'overflowX', value: 'hidden', origin: 'explicit' },
          { property: 'overflowY', value: 'scroll', origin: 'explicit' },
        ],
      });
      expect(
        run(overscrollBehaviorDef, 'contain none', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'overscrollBehaviorX',
            value: 'contain',
            origin: 'explicit',
          },
          {
            property: 'overscrollBehaviorY',
            value: 'none',
            origin: 'explicit',
          },
        ],
      });
    });

    it('replicates a single keyword onto both axes in spec output', () => {
      expect(run(overflowDef, 'auto', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'overflowX', value: 'auto', origin: 'explicit' },
          { property: 'overflowY', value: 'auto', origin: 'replicated' },
        ],
      });
    });

    it('refuses keywords outside the grammar', () => {
      expect(
        run(overflowDef, 'visible dotted', { output: 'minimal' }).type,
      ).toEqual('cannot-expand');
      expect(
        run(overscrollBehaviorDef, 'auto wat', { output: 'spec' }).type,
      ).toEqual('cannot-expand');
    });
  });

  describe('numeric values', () => {
    it('expands numbers onto both longhands in spec output', () => {
      expect(gapDef.runNumber?.(4, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'rowGap', value: 4, origin: 'explicit' },
          { property: 'columnGap', value: 4, origin: 'replicated' },
        ],
      });
      expect(marginBlockDef.runNumber?.(0, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlockStart', value: 0, origin: 'explicit' },
          { property: 'marginBlockEnd', value: 0, origin: 'replicated' },
        ],
      });
    });

    it('treats numbers as a no-op in minimal output', () => {
      expect(gapDef.runNumber?.(4, { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });

    it('has no number fast path for keyword shorthands', () => {
      expect(overflowDef.runNumber).toBe(null);
      expect(overscrollBehaviorDef.runNumber).toBe(null);
    });
  });

  describe('verbatim value slices', () => {
    it('passes top-level var() and calc() through as components', () => {
      expect(
        run(marginInlineDef, 'var(--x, 1px) calc( 2px + 5% )', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginInlineStart',
            value: 'var(--x, 1px)',
            origin: 'explicit',
          },
          {
            property: 'marginInlineEnd',
            value: 'calc( 2px + 5% )',
            origin: 'explicit',
          },
        ],
      });
    });
  });
});
