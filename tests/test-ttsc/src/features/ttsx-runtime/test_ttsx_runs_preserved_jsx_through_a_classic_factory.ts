import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";

/**
 * Verifies ttsx runs JSX a project preserves while declaring a classic factory,
 * compiled through that factory.
 *
 * The runtime build replaces a preserved JSX mode with an executable one, and
 * which one follows the project's declaration (samchon/ttsc#1408): a project
 * that names `jsxFactory` and `jsxFragmentFactory` writes its code against the
 * classic transform, whose calls go through those names in scope. Choosing the
 * automatic runtime instead would import a `jsx-runtime` the project never
 * asked for.
 *
 * 1. Create a `preserve` project with `jsxFactory: "h"` and `jsxFragmentFactory:
 *    "Fragment"`, whose component imports both from the local runtime and
 *    declares the global `JSX` namespace.
 * 2. Run the entry.
 * 3. Assert the component renders.
 */
export const test_ttsx_runs_preserved_jsx_through_a_classic_factory = () => {
  const root = TestProject.createProject({
    ...JSX_RUNTIME_PACKAGE,
    "package.json": JSON.stringify({ name: "classic-jsx", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        jsx: "preserve",
        jsxFactory: "h",
        jsxFragmentFactory: "Fragment",
        outDir: "lib",
        types: [],
      },
      include: ["src"],
    }),
    "src/jsx.d.ts": [
      `declare namespace JSX {`,
      `  type Element = string;`,
      `  interface IntrinsicElements { [name: string]: { children?: unknown } }`,
      `}`,
      ``,
    ].join("\n"),
    "src/view.tsx": [
      `import { Fragment, h } from "myjsx";`,
      `void h;`,
      `void Fragment;`,
      JSX_COMPONENT_SOURCE,
    ].join("\n"),
    "src/main.tsx": [
      `import { view } from "./view";`,
      `console.log(view);`,
      ``,
    ].join("\n"),
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.tsx"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), JSX_COMPONENT_OUTPUT);
};
