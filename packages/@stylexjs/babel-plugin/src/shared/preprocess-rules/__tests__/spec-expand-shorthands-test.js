/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { NullPreRule, PreRule } from '../PreRule';
import { flattenRawStyleObject } from '../flatten-raw-style-obj';
import flatMapExpandedShorthands from '../index';

const options = {
  classNamePrefix: 'x',
  debug: false,
  dev: false,
  propertyValidationMode: 'throw',
  styleResolution: 'spec-expand-shorthands',
  test: false,
} as const;

describe('spec-expand-shorthands style resolution', () => {
  describe('static shorthand values', () => {
    test('expands margin to the four physical longhands', () => {
      expect(
        flatMapExpandedShorthands(['margin', '10px 20px'], options),
      ).toEqual([
        ['marginTop', '10px'],
        ['marginRight', '20px'],
        ['marginBottom', '10px'],
        ['marginLeft', '20px'],
      ]);
    });

    test('preserves numeric values as numbers', () => {
      expect(flatMapExpandedShorthands(['margin', 8], options)).toEqual([
        ['marginTop', 8],
        ['marginRight', 8],
        ['marginBottom', 8],
        ['marginLeft', 8],
      ]);
    });

    test('emits spec resets for omitted background longhands', () => {
      expect(
        flatMapExpandedShorthands(['background', 'url(x.png)'], options),
      ).toEqual([
        ['backgroundColor', 'transparent'],
        ['backgroundImage', 'url(x.png)'],
        ['backgroundRepeat', 'repeat'],
        ['backgroundAttachment', 'scroll'],
        ['backgroundPosition', '0% 0%'],
        ['backgroundSize', 'auto'],
      ]);
    });

    test('emits the defaulted currentcolor for border', () => {
      expect(
        flatMapExpandedShorthands(['border', '1px solid'], options),
      ).toEqual([
        ['borderWidth', '1px'],
        ['borderStyle', 'solid'],
        ['borderColor', 'currentcolor'],
      ]);
    });

    test('replicates a single grid-area line to all four longhands', () => {
      expect(
        flatMapExpandedShorthands(['gridArea', 'header'], options),
      ).toEqual([
        ['gridRowStart', 'header'],
        ['gridColumnStart', 'header'],
        ['gridRowEnd', 'header'],
        ['gridColumnEnd', 'header'],
      ]);
    });

    test('fans a CSS-wide keyword out to every longhand', () => {
      expect(
        flatMapExpandedShorthands(['overflow', 'inherit'], options),
      ).toEqual([
        ['overflowX', 'inherit'],
        ['overflowY', 'inherit'],
      ]);
    });
  });

  describe('values that pass through unchanged', () => {
    test('leaves non-shorthand properties alone', () => {
      expect(flatMapExpandedShorthands(['marginTop', '10px'], options)).toEqual(
        [['marginTop', '10px']],
      );
      expect(flatMapExpandedShorthands(['color', 'red'], options)).toEqual([
        ['color', 'red'],
      ]);
    });

    test('leaves values referencing var() alone', () => {
      expect(
        flatMapExpandedShorthands(['margin', 'var(--spacing)'], options),
      ).toEqual([['margin', 'var(--spacing)']]);
      expect(
        flatMapExpandedShorthands(['margin', 'var(--x) 10px'], options),
      ).toEqual([['margin', 'var(--x) 10px']]);
      expect(
        flatMapExpandedShorthands(['margin', 'calc(var(--x) + 2px)'], options),
      ).toEqual([['margin', 'calc(var(--x) + 2px)']]);
    });

    test('leaves null values alone', () => {
      expect(flatMapExpandedShorthands(['margin', null], options)).toEqual([
        ['margin', null],
      ]);
    });

    test('keeps the default mode alias remaps', () => {
      expect(
        flatMapExpandedShorthands(['blockSize', '100px'], options),
      ).toEqual([['height', '100px']]);
      expect(
        flatMapExpandedShorthands(['marginStart', '10px'], options),
      ).toEqual([['marginInlineStart', '10px']]);
    });
  });

  describe('values that cannot be expanded', () => {
    test('throws through the property validation channel', () => {
      expect(() =>
        flatMapExpandedShorthands(['margin', '1px 2px 3px 4px 5px'], options),
      ).toThrow(
        "Cannot expand the shorthand property 'margin' with value '1px 2px 3px 4px 5px': Unexpected trailing input: 5px",
      );
      expect(() =>
        flatMapExpandedShorthands(['animation', 'spin 1s, fade 2s'], options),
      ).toThrow(
        "Cannot expand the shorthand property 'animation' with value 'spin 1s, fade 2s': comma-separated layers cannot be expanded to single longhand values",
      );
    });

    test('drops the property in silent mode', () => {
      expect(
        flatMapExpandedShorthands(['margin', '1px 2px 3px 4px 5px'], {
          ...options,
          propertyValidationMode: 'silent',
        }),
      ).toEqual([]);
    });

    test('keeps the default mode bans for unsupported shorthands', () => {
      expect(() =>
        flatMapExpandedShorthands(['borderInline', '1px solid red'], options),
      ).toThrow('borderInline is not supported');
      // A banned shorthand stays banned even when the value cannot be
      // statically parsed.
      expect(() =>
        flatMapExpandedShorthands(['borderTop', 'var(--x)'], options),
      ).toThrow('borderTop is not supported');
    });
  });

  describe('within flattenRawStyleObject', () => {
    test('expands conditional values per condition', () => {
      const result = flattenRawStyleObject(
        { padding: { default: '1px 2px', ':hover': '3px' } },
        options,
      );
      expect(result.map(([key]) => key)).toEqual([
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
      ]);
    });

    test('keeps fallback arrays on the authored shorthand key', () => {
      expect(
        flattenRawStyleObject({ margin: ['10dvh 1px', '10vh 1px'] }, options),
      ).toEqual([
        [
          'margin',
          new PreRule('margin', ['10dvh 1px', '10vh 1px'], ['margin']),
        ],
      ]);
    });

    test('passes dynamic style placeholders through unchanged', () => {
      // Dynamic values reach this layer as lone var() references; the
      // authored key must survive so the inline-style wiring stays intact.
      expect(
        flattenRawStyleObject({ margin: 'var(--x-margin)' }, options),
      ).toEqual([
        ['margin', new PreRule('margin', 'var(--x-margin)', ['margin'])],
      ]);
    });

    test('expands null-valued shorthands like the default mode', () => {
      expect(flattenRawStyleObject({ margin: null }, options)).toEqual([
        ['margin', new NullPreRule()],
      ]);
    });
  });
});
