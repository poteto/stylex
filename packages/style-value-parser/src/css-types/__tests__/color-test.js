/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser } from '../../token-parser';
import { balancedFunction } from '../../shorthands/families/slots';
import {
  Color,
  NamedColor,
  HashColor,
  Rgb,
  Rgba,
  Lch,
  colorFunctionNames,
} from '../color';
import { Angle } from '../angle';

describe('Test CSS Type: <color>', () => {
  test('parses named colors', () => {
    expect(Color.parser.parse('red')).toEqual(new NamedColor('red'));
    expect(Color.parser.parse('blue')).toEqual(new NamedColor('blue'));
    expect(Color.parser.parse('green')).toEqual(new NamedColor('green'));
    expect(Color.parser.parse('transparent')).toEqual(
      new NamedColor('transparent'),
    );
  });

  test('matches named colors case-insensitively, storing lowercase', () => {
    expect(Color.parser.parse('Red')).toEqual(new NamedColor('red'));
    expect(Color.parser.parse('BLUE')).toEqual(new NamedColor('blue'));
    expect(Color.parser.parse('rebeccaPurple')).toEqual(
      new NamedColor('rebeccapurple'),
    );
    expect(Color.parser.parse('TRANSPARENT')).toEqual(
      new NamedColor('transparent'),
    );
  });

  test('parses currentcolor in any casing, storing lowercase', () => {
    expect(Color.parser.parse('currentcolor')).toEqual(
      new NamedColor('currentcolor'),
    );
    expect(Color.parser.parse('currentColor')).toEqual(
      new NamedColor('currentcolor'),
    );
    expect(Color.parser.parse('CURRENTCOLOR')).toEqual(
      new NamedColor('currentcolor'),
    );
  });

  test('parses CSS Color 4 system colors like the named colors', () => {
    // ASCII case-insensitive, stored lowercase -- the same rule as every
    // other keyword in the list.
    for (const keyword of [
      'AccentColor',
      'AccentColorText',
      'ActiveText',
      'ButtonBorder',
      'ButtonFace',
      'ButtonText',
      'Canvas',
      'CanvasText',
      'Field',
      'FieldText',
      'GrayText',
      'Highlight',
      'HighlightText',
      'LinkText',
      'Mark',
      'MarkText',
      'SelectedItem',
      'SelectedItemText',
      'VisitedText',
    ]) {
      expect(Color.parser.parse(keyword)).toEqual(
        new NamedColor(keyword.toLowerCase()),
      );
      expect(Color.parser.parse(keyword.toUpperCase())).toEqual(
        new NamedColor(keyword.toLowerCase()),
      );
    }
  });

  test('parses hash colors', () => {
    expect(Color.parser.parse('#ff0000')).toEqual(new HashColor('ff0000'));
    expect(Color.parser.parse('#00ff00')).toEqual(new HashColor('00ff00'));
    expect(Color.parser.parse('#0000ff')).toEqual(new HashColor('0000ff'));
    expect(Color.parser.parse('#ffffff')).toEqual(new HashColor('ffffff'));
  });

  test('parses RGB values', () => {
    expect(Color.parser.parse('rgb(255, 0, 0)')).toEqual(new Rgb(255, 0, 0));
    expect(Color.parser.parse('rgb(0, 255, 0)')).toEqual(new Rgb(0, 255, 0));
    expect(Color.parser.parse('rgb(0, 0, 255)')).toEqual(new Rgb(0, 0, 255));
  });

  test('parses space-separated RGB values', () => {
    expect(Color.parser.parse('rgb(255 0 0)')).toEqual(new Rgb(255, 0, 0));
    expect(Color.parser.parse('rgb(0 255 0)')).toEqual(new Rgb(0, 255, 0));
    expect(Color.parser.parse('rgb(0 0 255)')).toEqual(new Rgb(0, 0, 255));
  });

  test('parses RGBA values', () => {
    expect(Color.parser.parse('rgba(255, 0, 0, 0.5)')).toEqual(
      new Rgba(255, 0, 0, 0.5),
    );
    expect(Color.parser.parse('rgba(0, 255, 0, 0.5)')).toEqual(
      new Rgba(0, 255, 0, 0.5),
    );
    expect(Color.parser.parse('rgba(0, 0, 255, 0.5)')).toEqual(
      new Rgba(0, 0, 255, 0.5),
    );
  });

  test('parses space-separated RGBA values', () => {
    expect(Color.parser.parse('rgb(255 0 0 / 0.5)')).toEqual(
      new Rgba(255, 0, 0, 0.5),
    );
    expect(Color.parser.parse('rgb(0 255 0 / 0.5)')).toEqual(
      new Rgba(0, 255, 0, 0.5),
    );
    expect(Color.parser.parse('rgb(0 0 255 / 0.5)')).toEqual(
      new Rgba(0, 0, 255, 0.5),
    );

    expect(Color.parser.parse('rgb(255 0 0 / 50%)')).toEqual(
      new Rgba(255, 0, 0, 0.5),
    );
    expect(Color.parser.parse('rgb(0 255 0 / 50%)')).toEqual(
      new Rgba(0, 255, 0, 0.5),
    );
    expect(Color.parser.parse('rgb(0 0 255 / 50%)')).toEqual(
      new Rgba(0, 0, 255, 0.5),
    );
  });

  test('parses lch values', () => {
    expect(Lch.parser.parse('lch(50% 100 270deg)')).toEqual(
      new Lch(50, 100, new Angle(270, 'deg')),
    );
  });

  test('rejects invalid colors', () => {
    expect(() => Color.parser.parseToEnd('invalid')).toThrow();
    expect(() => Color.parser.parseToEnd('#gggggg')).toThrow();
    expect(() => Color.parser.parseToEnd('rgb(256, 0, 0)')).toThrow();
  });
});

describe('the <color-function> name backstop', () => {
  // The backstop classifies a function as color-valued by NAME alone;
  // arguments relocate verbatim through balanced capture, exactly like
  // the existing entries (modern space-separated forms, color()).
  const sourced = TokenParser.sourced(balancedFunction(colorFunctionNames));

  test('carries the CSS Color 5 mixing functions', () => {
    expect(colorFunctionNames).toContain('color-mix');
    expect(colorFunctionNames).toContain('light-dark');
  });

  test('captures color-mix() and light-dark() verbatim', () => {
    expect(sourced.parseToEnd('color-mix(in srgb, red 40%, blue)').raw).toEqual(
      'color-mix(in srgb, red 40%, blue)',
    );
    expect(sourced.parseToEnd('light-dark(white, black)').raw).toEqual(
      'light-dark(white, black)',
    );
  });

  test('matches the new names ASCII case-insensitively, slices verbatim', () => {
    expect(sourced.parseToEnd('COLOR-MIX(in srgb, red, blue)').raw).toEqual(
      'COLOR-MIX(in srgb, red, blue)',
    );
    expect(sourced.parseToEnd('Light-Dark(#333, #ccc)').raw).toEqual(
      'Light-Dark(#333, #ccc)',
    );
  });

  test('captures balanced nested functions and groups', () => {
    expect(
      sourced.parseToEnd(
        'color-mix(in oklch, light-dark(white, black) 40%, var(--c))',
      ).raw,
    ).toEqual('color-mix(in oklch, light-dark(white, black) 40%, var(--c))');
  });
});
