/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../../shorthands/define';
import type { EmitOptions, ExpandResult } from '../../shorthands/types';

import { TokenList } from '../../token-types';
import { gridAreaDef, gridColumnDef, gridRowDef } from '../grid-lines';

function runWith(
  def: ShorthandDef,
  value: string,
  options: EmitOptions,
): ExpandResult {
  return def.run(new TokenList(value), options);
}

function expectParseError(result: ExpandResult, message?: RegExp) {
  expect(result.type).toEqual('cannot-expand');
  if (result.type === 'cannot-expand') {
    expect(result.reason.kind).toEqual('parse-error');
    if (message != null && result.reason.kind === 'parse-error') {
      expect(result.reason.message).toMatch(message);
    }
  }
}

describe('grid-row and grid-column defs', () => {
  const run = (value: string, options: EmitOptions) =>
    runWith(gridRowDef, value, options);

  describe('def metadata', () => {
    it('declares start/end longhands in spec order', () => {
      expect(gridRowDef.key).toEqual('gridRow');
      expect(gridRowDef.longhands).toEqual(['gridRowStart', 'gridRowEnd']);
      expect(gridColumnDef.key).toEqual('gridColumn');
      expect(gridColumnDef.longhands).toEqual([
        'gridColumnStart',
        'gridColumnEnd',
      ]);
      expect(gridRowDef.runNumber).toBe(null);
      expect(gridRowDef.singleComponentIsIdentity).toBe(true);
      expect(gridColumnDef.singleComponentIsIdentity).toBe(true);
    });
  });

  describe('two slash groups', () => {
    it('relocates each group verbatim, joined with single spaces', () => {
      expect(run('span   2 / 3', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'span 2', origin: 'explicit' },
          { property: 'gridRowEnd', value: '3', origin: 'explicit' },
        ],
      });
      expect(runWith(gridColumnDef, '1 / -1', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridColumnStart', value: '1', origin: 'explicit' },
          { property: 'gridColumnEnd', value: '-1', origin: 'explicit' },
        ],
      });
    });

    it('keeps keyword case verbatim (matching is case-insensitive)', () => {
      expect(run('SPAN 2 / AUTO', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'SPAN 2', origin: 'explicit' },
          { property: 'gridRowEnd', value: 'AUTO', origin: 'explicit' },
        ],
      });
    });
  });

  describe('one group', () => {
    it('is a no-op in minimal output regardless of component count', () => {
      for (const value of ['main', '2', 'span 2', 'auto', 'span 2 main']) {
        expect(run(value, { output: 'minimal' })).toEqual({ type: 'no-op' });
      }
    });

    it('copies a lone custom-ident to the end in spec output', () => {
      expect(run('main', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'main', origin: 'explicit' },
          { property: 'gridRowEnd', value: 'main', origin: 'replicated' },
        ],
      });
    });

    it('defaults the end to auto for non-ident groups in spec output', () => {
      expect(run('span 2', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'span 2', origin: 'explicit' },
          { property: 'gridRowEnd', value: 'auto', origin: 'defaulted' },
        ],
      });
      expect(run('2', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '2', origin: 'explicit' },
          { property: 'gridRowEnd', value: 'auto', origin: 'defaulted' },
        ],
      });
    });
  });

  describe('shallow grid-line validation', () => {
    it('refuses components that cannot be part of any grid line', () => {
      expectParseError(
        run('1.5 / 2', { output: 'spec' }),
        /Unexpected component: 1\.5/,
      );
      expectParseError(
        run('calc(1 + 1) / 2', { output: 'spec' }),
        /Unexpected component/,
      );
      expectParseError(
        run('"a" / 2', { output: 'spec' }),
        /Unexpected component/,
      );
    });

    it('refuses the excluded keywords and span-prefixed idents as names', () => {
      expectParseError(run('none / 2', { output: 'spec' }));
      expectParseError(run('span-2 / 2', { output: 'spec' }));
    });

    it("requires 'span' to combine with a following integer or name", () => {
      expectParseError(run('span / 2', { output: 'spec' }), /span/);
      expectParseError(run('2 span / 3', { output: 'spec' }), /span/);
      expect(run('span foo / 3', { output: 'spec' }).type).toEqual('ok');
    });

    it('refuses var() components (the boundary reports contains-variable)', () => {
      expectParseError(run('var(--line) / 2', { output: 'spec' }));
    });
  });

  describe('slash structure', () => {
    it('refuses empty groups and more than two groups', () => {
      expectParseError(run('1 /', { output: 'spec' }), /grid line/);
      expectParseError(run('/ 2', { output: 'spec' }), /grid line/);
      expectParseError(run('1 / 2 / 3', { output: 'spec' }), /grid line/);
    });

    it('refuses an empty value', () => {
      expectParseError(run('', { output: 'spec' }), /at least one component/);
    });
  });
});

describe('grid-area def', () => {
  const run = (value: string, options: EmitOptions) =>
    runWith(gridAreaDef, value, options);

  describe('def metadata', () => {
    it('declares the four longhands in spec order, escaping the fast path', () => {
      expect(gridAreaDef.key).toEqual('gridArea');
      expect(gridAreaDef.longhands).toEqual([
        'gridRowStart',
        'gridColumnStart',
        'gridRowEnd',
        'gridColumnEnd',
      ]);
      expect(gridAreaDef.runNumber).toBe(null);
      // 'grid-area: header' is one component, but its minimal form lives
      // on the four line longhands, so it must reach def.run.
      expect(gridAreaDef.singleComponentIsIdentity).toBe(false);
    });
  });

  describe('a single lone custom-ident group', () => {
    it('replicates the ident to all four longhands in spec output', () => {
      expect(run('header', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'header', origin: 'explicit' },
          {
            property: 'gridColumnStart',
            value: 'header',
            origin: 'replicated',
          },
          { property: 'gridRowEnd', value: 'header', origin: 'replicated' },
          { property: 'gridColumnEnd', value: 'header', origin: 'replicated' },
        ],
      });
    });

    it('expands in minimal output too (the old splitter reported it)', () => {
      expect(run('header', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'header', origin: 'explicit' },
          {
            property: 'gridColumnStart',
            value: 'header',
            origin: 'replicated',
          },
          { property: 'gridRowEnd', value: 'header', origin: 'replicated' },
          { property: 'gridColumnEnd', value: 'header', origin: 'replicated' },
        ],
      });
    });
  });

  describe('a single non-ident group', () => {
    it('is a no-op in minimal output (old: stays on gridArea, unreported)', () => {
      for (const value of ['2', 'span 2', 'auto']) {
        expect(run(value, { output: 'minimal' })).toEqual({ type: 'no-op' });
      }
    });

    it('fills the other three longhands with auto in spec output', () => {
      expect(run('span 2', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'span 2', origin: 'explicit' },
          { property: 'gridColumnStart', value: 'auto', origin: 'defaulted' },
          { property: 'gridRowEnd', value: 'auto', origin: 'defaulted' },
          { property: 'gridColumnEnd', value: 'auto', origin: 'defaulted' },
        ],
      });
    });
  });

  describe('multi-group replication (spec == old logic)', () => {
    it('copies ident starts to their ends when groups are omitted', () => {
      expect(run('rowname / colname', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: 'rowname', origin: 'explicit' },
          {
            property: 'gridColumnStart',
            value: 'colname',
            origin: 'explicit',
          },
          { property: 'gridRowEnd', value: 'rowname', origin: 'replicated' },
          {
            property: 'gridColumnEnd',
            value: 'colname',
            origin: 'replicated',
          },
        ],
      });
    });

    it('copies an ident column-start to the omitted column-end', () => {
      expect(run('1 / col2 / 3', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '1', origin: 'explicit' },
          { property: 'gridColumnStart', value: 'col2', origin: 'explicit' },
          { property: 'gridRowEnd', value: '3', origin: 'explicit' },
          { property: 'gridColumnEnd', value: 'col2', origin: 'replicated' },
        ],
      });
    });

    it('defaults omitted ends to auto for non-ident starts', () => {
      expect(run('1 / 2', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '1', origin: 'explicit' },
          { property: 'gridColumnStart', value: '2', origin: 'explicit' },
          { property: 'gridRowEnd', value: 'auto', origin: 'defaulted' },
          { property: 'gridColumnEnd', value: 'auto', origin: 'defaulted' },
        ],
      });
    });

    it('emits authored and replicated cells only in minimal output', () => {
      expect(run('1 / 2', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '1', origin: 'explicit' },
          { property: 'gridColumnStart', value: '2', origin: 'explicit' },
        ],
      });
      expect(run('1 / col2 / 3', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '1', origin: 'explicit' },
          { property: 'gridColumnStart', value: 'col2', origin: 'explicit' },
          { property: 'gridRowEnd', value: '3', origin: 'explicit' },
          { property: 'gridColumnEnd', value: 'col2', origin: 'replicated' },
        ],
      });
    });

    it('takes all four groups explicitly', () => {
      expect(run('1 / 2 / 3 / 4', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'gridRowStart', value: '1', origin: 'explicit' },
          { property: 'gridColumnStart', value: '2', origin: 'explicit' },
          { property: 'gridRowEnd', value: '3', origin: 'explicit' },
          { property: 'gridColumnEnd', value: '4', origin: 'explicit' },
        ],
      });
    });
  });

  describe('refusals', () => {
    it('refuses more than four groups, empty groups, and bad components', () => {
      expectParseError(run('1 / 2 / 3 / 4 / 5', { output: 'spec' }));
      expectParseError(run('1 / / 3', { output: 'spec' }), /grid line/);
      expectParseError(
        run('header footer 1.5', { output: 'spec' }),
        /Unexpected component: 1\.5/,
      );
    });
  });
});
