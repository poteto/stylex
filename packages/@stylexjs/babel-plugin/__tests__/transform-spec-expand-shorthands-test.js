/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

jest.autoMockOff();

import { transformSync } from '@babel/core';
import stylexPlugin from '../src/index';

function transform(source, opts = {}) {
  const { code, metadata } = transformSync(source, {
    filename: opts.filename,
    parserOpts: {
      flow: 'all',
    },
    babelrc: false,
    plugins: [[stylexPlugin, { ...opts }]],
  });

  return { code, metadata };
}

const options = {
  runtimeInjection: false,
  styleResolution: 'spec-expand-shorthands',
};

describe('@stylexjs/babel-plugin', () => {
  describe('[transform] styleResolution: "spec-expand-shorthands"', () => {
    // Expansion moves declarations from the shorthand priority tiers
    // (1000/2000) to the longhand tiers (3000/4000). The two tests below pin
    // that semantic difference: the same margin declaration produces a single
    // priority-1000 rule by default and four longhand-priority rules when
    // expanded.
    test('margin stays a single priority-1000 rule in the default mode', () => {
      const { metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            margin: '10px 20px',
          },
        });
      `,
        { runtimeInjection: false },
      );
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "xymmreb",
              {
                "ltr": ".xymmreb{margin:10px 20px}",
                "rtl": null,
              },
              1000,
            ],
          ],
        }
      `);
    });

    test('margin expands to four longhand-priority rules', () => {
      const { code, metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            margin: '10px 20px',
          },
        });
      `,
        options,
      );
      expect(code).toMatchInlineSnapshot(`
        "import * as stylex from '@stylexjs/stylex';
        export const styles = {
          root: {
            keoZOQ: "x1anpbxc",
            km5ZXQ: "x1wh8b8d",
            k1K539: "xyorhqc",
            koQZXg: "x400o59",
            $$css: true
          }
        };"
      `);
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "x1anpbxc",
              {
                "ltr": ".x1anpbxc{margin-top:10px}",
                "rtl": null,
              },
              4000,
            ],
            [
              "x1wh8b8d",
              {
                "ltr": ".x1wh8b8d{margin-right:20px}",
                "rtl": null,
              },
              4000,
            ],
            [
              "xyorhqc",
              {
                "ltr": ".xyorhqc{margin-bottom:10px}",
                "rtl": null,
              },
              4000,
            ],
            [
              "x400o59",
              {
                "ltr": ".x400o59{margin-left:20px}",
                "rtl": null,
              },
              4000,
            ],
          ],
        }
      `);
    });

    test('numeric shorthand values stay numeric', () => {
      const { metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            margin: 8,
          },
        });
      `,
        options,
      );
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "x1xmf6yo",
              {
                "ltr": ".x1xmf6yo{margin-top:8px}",
                "rtl": null,
              },
              4000,
            ],
            [
              "x1db2dqx",
              {
                "ltr": ".x1db2dqx{margin-right:8px}",
                "rtl": null,
              },
              4000,
            ],
            [
              "x1e56ztr",
              {
                "ltr": ".x1e56ztr{margin-bottom:8px}",
                "rtl": null,
              },
              4000,
            ],
            [
              "xet2fuk",
              {
                "ltr": ".xet2fuk{margin-left:8px}",
                "rtl": null,
              },
              4000,
            ],
          ],
        }
      `);
    });

    test('background expands with the spec resets for omitted longhands', () => {
      const { metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            background: 'url(x.png)',
          },
        });
      `,
        options,
      );
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "xjbqb8w",
              {
                "ltr": ".xjbqb8w{background-color:transparent}",
                "rtl": null,
              },
              3000,
            ],
            [
              "x1yw5z5w",
              {
                "ltr": ".x1yw5z5w{background-image:url(x.png)}",
                "rtl": null,
              },
              3000,
            ],
            [
              "x182nak8",
              {
                "ltr": ".x182nak8{background-repeat:repeat}",
                "rtl": null,
              },
              3000,
            ],
            [
              "x1fdtg7e",
              {
                "ltr": ".x1fdtg7e{background-attachment:scroll}",
                "rtl": null,
              },
              3000,
            ],
            [
              "x1y4qj14",
              {
                "ltr": ".x1y4qj14{background-position:0% 0%}",
                "rtl": null,
              },
              2000,
            ],
            [
              "x1cwfr1t",
              {
                "ltr": ".x1cwfr1t{background-size:auto}",
                "rtl": null,
              },
              3000,
            ],
          ],
        }
      `);
    });

    test('border expands with the defaulted currentcolor', () => {
      const { metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            border: '1px solid',
          },
        });
      `,
        options,
      );
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "xmkeg23",
              {
                "ltr": ".xmkeg23{border-width:1px}",
                "rtl": null,
              },
              2000,
            ],
            [
              "x1y0btm7",
              {
                "ltr": ".x1y0btm7{border-style:solid}",
                "rtl": null,
              },
              2000,
            ],
            [
              "x181nr7w",
              {
                "ltr": ".x181nr7w{border-color:currentcolor}",
                "rtl": null,
              },
              2000,
            ],
          ],
        }
      `);
    });

    test('gridArea expands to the four grid-line longhands', () => {
      const { metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            gridArea: 'header',
          },
        });
      `,
        options,
      );
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "xl2aupd",
              {
                "ltr": ".xl2aupd{grid-row-start:header}",
                "rtl": null,
              },
              3000,
            ],
            [
              "x1iip7fa",
              {
                "ltr": ".x1iip7fa{grid-column-start:header}",
                "rtl": null,
              },
              3000,
            ],
            [
              "x36eicd",
              {
                "ltr": ".x36eicd{grid-row-end:header}",
                "rtl": null,
              },
              3000,
            ],
            [
              "xrnd8zp",
              {
                "ltr": ".xrnd8zp{grid-column-end:header}",
                "rtl": null,
              },
              3000,
            ],
          ],
        }
      `);
    });

    test('dynamic shorthand values pass through unchanged', () => {
      const { code, metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: (offset) => ({
            margin: \`\${offset}px 20px\`,
          }),
        });
      `,
        options,
      );
      expect(code).toMatchInlineSnapshot(`
        "import * as stylex from '@stylexjs/stylex';
        const _temp = {
          kogj98: "xb9ncqk",
          "$$css": true
        };
        export const styles = {
          root: offset => [_temp, {
            "--x-margin": (val => typeof val === "number" ? val + "px" : val != null ? val : undefined)(\`\${offset}px 20px\`)
          }]
        };"
      `);
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "xb9ncqk",
              {
                "ltr": ".xb9ncqk{margin:var(--x-margin)}",
                "rtl": null,
              },
              1000,
            ],
            [
              "--x-margin",
              {
                "ltr": "@property --x-margin { syntax: "*"; inherits: false;}",
                "rtl": null,
              },
              0,
            ],
          ],
        }
      `);
    });

    describe('values that cannot be expanded', () => {
      const sourceWithInvalidShorthand = `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            color: 'red',
            margin: '1px 2px 3px 4px 5px',
          },
        });
      `;

      test('throw under propertyValidationMode: "throw"', () => {
        expect(() =>
          transform(sourceWithInvalidShorthand, {
            ...options,
            propertyValidationMode: 'throw',
          }),
        ).toThrow(
          "Cannot expand the shorthand property 'margin' with value '1px 2px 3px 4px 5px': Unexpected trailing input: 5px",
        );
      });

      test('warn and drop under propertyValidationMode: "warn"', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { metadata } = transform(sourceWithInvalidShorthand, {
          ...options,
          propertyValidationMode: 'warn',
        });
        expect(warn).toHaveBeenCalledWith(
          "[stylex] Cannot expand the shorthand property 'margin' with value '1px 2px 3px 4px 5px': Unexpected trailing input: 5px",
        );
        expect(metadata).toMatchInlineSnapshot(`
          {
            "stylex": [
              [
                "x1e2nbdu",
                {
                  "ltr": ".x1e2nbdu{color:red}",
                  "rtl": null,
                },
                3000,
              ],
            ],
          }
        `);
        warn.mockRestore();
      });

      test('drop silently under propertyValidationMode: "silent"', () => {
        const { metadata } = transform(sourceWithInvalidShorthand, {
          ...options,
          propertyValidationMode: 'silent',
        });
        expect(metadata).toMatchInlineSnapshot(`
          {
            "stylex": [
              [
                "x1e2nbdu",
                {
                  "ltr": ".x1e2nbdu{color:red}",
                  "rtl": null,
                },
                3000,
              ],
            ],
          }
        `);
      });
    });

    test('the default mode is unchanged on the same inputs', () => {
      // Guard against the new mode leaking into the default behavior: the
      // shorthands stay on their authored keys (banned ones are silently
      // dropped, as today) and nothing is expanded.
      const { metadata } = transform(
        `
        import * as stylex from '@stylexjs/stylex';
        export const styles = stylex.create({
          root: {
            margin: '10px 20px',
            background: 'url(x.png)',
            border: '1px solid',
            gridArea: 'header',
            padding: 8,
          },
        });
      `,
        { runtimeInjection: false },
      );
      expect(metadata).toMatchInlineSnapshot(`
        {
          "stylex": [
            [
              "xymmreb",
              {
                "ltr": ".xymmreb{margin:10px 20px}",
                "rtl": null,
              },
              1000,
            ],
            [
              "x4lrnbh",
              {
                "ltr": ".x4lrnbh{grid-area:header}",
                "rtl": null,
              },
              1000,
            ],
            [
              "xe8ttls",
              {
                "ltr": ".xe8ttls{padding:8px}",
                "rtl": null,
              },
              1000,
            ],
          ],
        }
      `);
    });
  });
});
