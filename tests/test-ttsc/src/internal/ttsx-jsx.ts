/**
 * A minimal JSX runtime installed as `node_modules/myjsx`, so the JSX cases
 * need no React. It renders an element to its HTML text, which makes the
 * compiled factory calls observable on stdout.
 *
 * It serves both transforms. The automatic runtime imports `jsx`, `jsxs`, and
 * `Fragment` from `myjsx/jsx-runtime`; the classic transform calls the `h` and
 * `Fragment` exported from `myjsx` itself, as `jsxFactory: "h"` names them.
 */
export const JSX_RUNTIME_PACKAGE: Readonly<Record<string, string>> = {
  "node_modules/myjsx/package.json": JSON.stringify({
    name: "myjsx",
    version: "1.0.0",
    main: "index.js",
    types: "index.d.ts",
    exports: {
      ".": { types: "./index.d.ts", default: "./index.js" },
      "./jsx-runtime": {
        types: "./jsx-runtime.d.ts",
        default: "./jsx-runtime.js",
      },
    },
  }),
  "node_modules/myjsx/index.js": [
    `function Fragment() {}`,
    `function render(type, props) {`,
    `  const children = [].concat(props?.children ?? []).join("");`,
    `  return type === Fragment ? children : "<" + type + ">" + children + "</" + type + ">";`,
    `}`,
    `function h(type, props, ...children) {`,
    `  return render(type, { ...props, children });`,
    `}`,
    `module.exports = { Fragment, h, render };`,
    ``,
  ].join("\n"),
  "node_modules/myjsx/index.d.ts": [
    `export declare function Fragment(props: { children?: unknown }): string;`,
    `export declare function h(type: unknown, props: unknown, ...children: unknown[]): string;`,
    `export declare function render(type: unknown, props: unknown): string;`,
    `export declare namespace JSX {`,
    `  type Element = string;`,
    `  interface IntrinsicElements { [name: string]: { children?: unknown } }`,
    `}`,
    ``,
  ].join("\n"),
  "node_modules/myjsx/jsx-runtime.js": [
    `const { Fragment, render } = require("./index.js");`,
    `module.exports = { Fragment, jsx: render, jsxs: render };`,
    ``,
  ].join("\n"),
  "node_modules/myjsx/jsx-runtime.d.ts": [
    `export { Fragment, JSX } from "./index";`,
    `export declare function jsx(type: unknown, props: unknown): string;`,
    `export declare function jsxs(type: unknown, props: unknown): string;`,
    ``,
  ].join("\n"),
};

/** A component using an element, nested text, and a fragment. */
export const JSX_COMPONENT_SOURCE = [
  `export const view: string = <><div>hello</div><b>world</b></>;`,
  ``,
].join("\n");

/** What {@link JSX_COMPONENT_SOURCE} renders to. */
export const JSX_COMPONENT_OUTPUT = "<div>hello</div><b>world</b>";
