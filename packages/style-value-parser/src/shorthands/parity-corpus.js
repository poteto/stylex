/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * The shorthand parity corpus: every distinct shorthand declaration the
 * eslint rule's fixture suite exercises (valid single-component forms,
 * autofixed multi-component forms, CANNOT_FIX forms, and the
 * allowImportant/preferInline option variants), plus MDN-derived extras
 * for registry defs the rule never covered.
 *
 * This is a NON-test module on purpose: the build excludes __tests__,
 * and the corpus is consumed both by the corpus-runner test (structural
 * invariants + snapshot) and by scripts/shorthand-parity-diff.mjs (which
 * imports the BUILT lib to compare engines), so it must ship in lib/.
 *
 * `source` tags provenance: 'rule-fixture' entries are lifted from
 * eslint-plugin/__tests__/stylex-valid-shorthands-test.js; 'mdn' entries
 * are spec-example forms (MDN property pages) that widen coverage.
 */

export type ParityCase = Readonly<{
  property: string,
  value: string | number,
  allowImportant?: boolean,
  preferInline?: boolean,
  source: 'rule-fixture' | 'mdn',
}>;

const rule = (
  property: string,
  value: string | number,
  options?: Readonly<{ allowImportant?: boolean, preferInline?: boolean }>,
): ParityCase => ({ property, value, ...options, source: 'rule-fixture' });

const mdn = (
  property: string,
  value: string | number,
  options?: Readonly<{ allowImportant?: boolean, preferInline?: boolean }>,
): ParityCase => ({ property, value, ...options, source: 'mdn' });

export const PARITY_CORPUS: ReadonlyArray<ParityCase> = [
  // margin / padding quads (directional transformer territory)
  rule('margin', 10),
  rule('margin', '0px'),
  rule('margin', '10px 12px'),
  rule('margin', '10em 1em'),
  rule('margin', '10px 10px 10px'),
  rule('margin', '10px 12px 13px 14px'),
  rule('margin', '10px 12px 13px 14px !important'),
  rule('margin', '10px 12px 13px 14px !important', { allowImportant: true }),
  rule('margin', '10em 1em 5em 2em', { preferInline: true }),
  rule('padding', 'calc(0.5 * 100px)'),
  rule('padding', '10em 1em'),
  rule('padding', '5px 10px'),
  rule('padding', '20px 20px 20px 20px'),
  mdn('margin', 'var(--a) 10px'),
  mdn('margin', 'auto'),
  mdn('margin', '1px 2px 3px'),
  mdn('margin', 'round(2.5px) 10px'),
  mdn('padding', '1px 2px 3px 4px !important'),
  // !important without allowImportant: the old splitter mis-split the
  // bang into a longhand value; the engine refuses instead.
  mdn('margin', '10px 12px !important'),

  // margin/padding axis pairs
  rule('marginInline', 0),
  rule('marginInline', '15px 15px'),
  rule('marginInline', '10em 1em'),
  rule('marginBlock', 10),
  rule('marginBlock', '10em 1em'),
  rule('paddingInline', 0),
  rule('paddingBlock', 10),
  rule('paddingBlock', '10em 1em'),
  mdn('paddingInline', '1rem 2rem'),
  mdn('marginBlock', 'var(--x) 1em'),

  // inset family (no rule coverage)
  mdn('inset', '10px'),
  mdn('inset', '4px 8px'),
  mdn('inset', '2.4em 3em 3em 3em'),
  mdn('inset', '0 auto'),
  mdn('inset', '10% 20% 30% 40%', { preferInline: true }),
  mdn('insetBlock', '10px 20px'),
  mdn('insetInline', '5% 10%'),
  mdn('insetInline', 'auto auto'),

  // scroll-margin / scroll-padding (no rule coverage)
  mdn('scrollMargin', '1em'),
  mdn('scrollMargin', '10px 20px 30px 40px'),
  mdn('scrollPadding', '10% 20%'),
  mdn('scrollPadding', 'auto'),

  // overflow / overscroll-behavior axis pairs (no rule coverage)
  mdn('overflow', 'hidden'),
  mdn('overflow', 'hidden scroll'),
  mdn('overflow', 'visible clip'),
  mdn('overscrollBehavior', 'contain'),
  mdn('overscrollBehavior', 'contain auto'),
  mdn('overscrollBehavior', 'none contain'),

  // gap (+ the gridGap legacy alias)
  rule('gap', '10px'),
  rule('gap', 10),
  rule('gap', 0),
  rule('gap', 'var(--spacing)'),
  rule('gap', 'calc(10px + 1rem)'),
  rule('gap', '10px 20px'),
  rule('gap', 'calc(10px + 1rem) calc(20px + 2rem)'),
  rule('gap', '0px 0px'),
  rule('gap', '10px 20px !important', { allowImportant: true }),
  rule('gap', '10px, 20px'),
  rule('gap', '10px / 20px'),
  rule('gap', '10px 20px 30px'),
  rule('gridGap', '10px'),
  rule('gridGap', 10),
  rule('gridGap', '10px 20px'),

  // border-width/style/color quads
  rule('borderWidth', '1px'),
  rule('borderWidth', 'var(--border-width, 10)'),
  rule('borderWidth', '1px 2px 3px 4px'),
  rule('borderWidth', '4px 5px 6px 7px'),
  rule('borderWidth', '4px 5px 6px 7px', { preferInline: true }),
  rule(
    'borderWidth',
    'var(--vertical-border-width, 10) var(--horizontal-border-width, 15)',
  ),
  rule('borderWidth', 'calc(100% - 20px) calc(90% - 20px)'),
  rule('borderStyle', 'solid'),
  rule('borderStyle', 'solid dashed dotted double'),
  rule('borderStyle', 'solid dashed dotted double', { preferInline: true }),
  rule('borderColor', 'black'),
  rule('borderColor', 'rgb(0, 0, 0)'),
  rule('borderColor', 'oklch(0.928 0.006 264.531)'),
  rule('borderColor', 'oklab(0.9 -0.003 -0.003)'),
  rule('borderColor', 'lch(50% 20 240)'),
  rule('borderColor', 'lab(50% -20 -20)'),
  rule('borderColor', 'color(display-p3 1 0.5 0)'),
  rule('borderColor', 'hwb(240 100% 50%)'),
  rule('borderColor', 'rgb(255 0 0 / 0.5)'),
  rule('borderColor', 'hsl(220 3% 15% / 10%)'),
  rule('borderColor', 'hsb(220 3% 15% / 10%)'),
  rule('borderColor', 'oklch(0.7 0.15 180 / 0.8)'),
  rule('borderColor', 'red green blue yellow'),
  rule('borderColor', 'red green blue yellow', { preferInline: true }),
  rule('borderColor', 'hsl(220 3% 15%) hsl(240 3% 20%)'),
  rule('borderColor', 'oklch(0.7 0.15 180) rgb(255 0 0)'),
  rule(
    'borderColor',
    'var(--fds-gray-10) var(--fds-gray-20) var(--fds-gray-30) var(--fds-gray-40)',
  ),
  rule(
    'borderColor',
    'var(--test-color, #ccc) linear-gradient(to right, #ff7e5f, #feb47b)',
  ),
  mdn('borderWidth', 'thin thick'),
  mdn('borderWidth', 'medium'),
  mdn('borderStyle', 'none'),
  mdn('borderColor', 'Canvas CanvasText'),
  mdn('borderColor', 'light-dark(#333, #ccc)'),

  // border + sides (line trios)
  rule('border', 'none'),
  rule('border', 'solid'),
  rule('border', 0),
  rule('border', '1px solid'),
  rule('border', '1px solid red'),
  rule('border', '2px dashed blue'),
  rule('border', '1px solid rgba(0, 0, 0, 0.5)'),
  rule('border', '1px solid red !important', { allowImportant: true }),
  rule('borderTop', '2px solid red'),
  rule('borderRight', '3px dashed green'),
  rule('borderRight', '4px solid var(--fds-gray-10)'),
  rule('borderBottom', '4px dotted blue'),
  rule('borderLeft', '5px double yellow'),
  mdn('border', 'solid red'),
  mdn('border', 'thick double'),
  mdn('border', '1px solid var(--c)'),
  mdn('border', 'var(--a) var(--b) solid'),
  mdn('border', '1px solid color-mix(in srgb, red 40%, blue)'),
  mdn('outline', 'dashed'),
  mdn('outline', '1px solid var(--focus-ring)'),
  mdn('outline', '2px solid ButtonText'),

  // outline
  rule('outline', '2px dashed red'),

  // border-radius / corner-shape corners
  rule('borderRadius', 5),
  rule('borderRadius', '10px 15px 20px 25px'),
  rule('borderRadius', '10px 15px 20px 25px', { preferInline: true }),
  rule('borderRadius', '10px 20px 30px 40px'),
  rule('cornerShape', 'squircle'),
  rule('cornerShape', 'scoop notch'),
  mdn('borderRadius', '10px / 20px'),
  mdn('borderRadius', '10px 20px / 30px 40px'),
  mdn('borderRadius', '1em 2em 3em 4em / 0.5em'),
  mdn('borderRadius', '2em 1em 4em / 0.5em 3em', { preferInline: true }),
  mdn('cornerShape', 'round bevel notch squircle'),
  mdn('cornerShape', 'superellipse(3) squircle'),
  mdn('cornerShape', 'scoop notch', { preferInline: true }),

  // background
  rule(
    'background',
    '#ff0 url("image.jpg") no-repeat fixed center / cover !important',
  ),
  rule(
    'background',
    '#ff0 url("image.jpg") no-repeat fixed center / cover !important',
    { allowImportant: true },
  ),
  rule(
    'background',
    'no-repeat center/cover, linear-gradient(to right, #ff7e5f, #feb47b)',
  ),
  mdn('background', 'green'),
  mdn('background', 'no-repeat url("../../media/examples/lizard.png")'),
  mdn('background', 'left 5% / 15% 60% repeat-x url("star.png")'),

  // font
  rule('font', 'italic small-caps bold 16px/1.5 "Helvetica Neue"'),
  mdn('font', '1.2em "Fira Sans", sans-serif'),
  mdn('font', 'italic bold 12px/30px Georgia, serif'),
  mdn('font', 'small-caps bold 24px/1 sans-serif'),
  mdn('font', 'oblique 45deg 12px serif'),
  mdn('font', 'oblique 45DEG 12px serif'),
  mdn('font', 'caption'),

  // animation
  rule('animation', 'slidein 3s'),
  rule('animation', 'slidein 3s ease-in'),
  rule('animation', 'slidein 3s 1s'),
  rule('animation', '3s ease-in 1s 2 reverse both paused slidein'),
  rule('animation', 'slidein 300ms cubic-bezier(0.4, 0, 0.2, 1)'),
  rule('animation', 'spin 1s linear infinite'),
  rule('animation', 'slidein 2s ease !important', { allowImportant: true }),
  rule('animation', 'slidein 3s, fadeout 2s'),
  rule('animation', '2 3s slidein'),
  rule('animation', '1s none'),
  rule('animation', 'fadein 1s none'),
  rule('animation', 'bounce 1s alternate-reverse'),
  mdn('animation', '3s linear 1s slidein'),
  mdn('animation', 'none'),

  // flex
  rule('flex', 1),
  rule('flex', '2'),
  rule('flex', 'auto'),
  rule('flex', 'none'),
  rule('flex', 'initial'),
  rule('flex', '100px'),
  rule('flex', '1 0'),
  rule('flex', '1 30px'),
  rule('flex', '2 2 10%'),
  rule('flex', '1 0 auto !important', { allowImportant: true }),
  rule('flex', '1 1 calc(100% - 20px)'),
  mdn('flex', '0 1 auto'),
  mdn('flex', '1 1 0'),
  mdn('flex', 'min-content'),
  mdn('flex', '1 var(--b)'),

  // grid lines
  rule('gridRow', 1),
  rule('gridRow', 'span 2'),
  rule('gridRow', '1 / 3'),
  rule('gridRow', 'header-start / content-end'),
  rule('gridRow', '1 / span 2'),
  rule('gridColumn', '1'),
  rule('gridColumn', 'auto'),
  rule('gridColumn', 'span 3'),
  rule('gridColumn', 'calc(100%/3)'),
  rule('gridColumn', '2 / 4'),
  rule('gridArea', 'auto'),
  rule('gridArea', 'span 2'),
  rule('gridArea', '1'),
  rule('gridArea', 'header'),
  rule('gridArea', 'header / sidebar'),
  rule('gridArea', 'span 2 / span 3'),
  rule('gridArea', '1 / 2 / 3'),
  rule('gridArea', '1 / 2 / 3 / 4'),
  rule('gridArea', 'header / 2'),
  rule('gridArea', '1 / sidebar'),
  rule('gridArea', '1 / sidebar / 3'),
  mdn('gridRow', 'var(--line) / 2'),
  mdn('gridRow', 'span 2 / 4'),
  mdn('gridColumn', 'var(--start) / var(--end)'),
  mdn('gridArea', 'a / b / c / d'),
  mdn('gridArea', 'var(--area)'),

  // grid-template
  rule('gridTemplate', 'none'),
  rule('gridTemplate', '1fr 2fr / 100px 1fr'),
  rule('gridTemplate', 'auto auto / repeat(3, 1fr)'),
  mdn('gridTemplate', 'minmax(20px, auto) 1fr / repeat(2, 100px)'),
  mdn('gridTemplate', '"a a a" "b b b" / 1fr 2fr'),

  // properties the rule rewrites by NAME only; the engine treats them as
  // not-shorthand (legacy renames stay the adapter's job)
  rule('marginHorizontal', '10px'),
  rule('borderStart', '1px solid red'),
  rule('gridColumnGap', '10px'),
  rule('gridRowStart', 1),
];
