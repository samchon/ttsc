import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";

/**
 * Verifies ttsx leaves executable JSX modes as configured and, for a preserved
 * one, honors every way a project declares the classic transform.
 *
 * The runtime build replaces only a preserved JSX mode (samchon/ttsc#1408).
 * `react` and `react-jsxdev` already produce JavaScript Node can run and must
 * reach the compiler untouched. For `preserve`, the choice of replacement
 * follows the declaration the way the checker reads it: `reactNamespace` is a
 * classic declaration as much as `jsxFactory` is, and a project that declares
 * both a factory and an import source, which `preserve` allows but no
 * executable mode does, is checked as the automatic runtime, so it runs as one,
 * with no factory in scope. A `--jsx preserve` inside a response file is read
 * through the compiler, exactly as a visible flag is.
 *
 * 1. Create one project per configuration: `react` with a factory, `react-jsxdev`
 *    with an import source, `preserve` with `reactNamespace`, `preserve` with a
 *    factory and an import source, and `react-jsx` run with a response file that
 *    forwards `--jsx preserve`.
 * 2. Run each entry.
 * 3. Assert every run renders the component.
 */
export const test_ttsx_keeps_executable_jsx_modes_and_honors_every_classic_declaration =
  () => {
    const globalJsx = [
      `declare namespace JSX {`,
      `  type Element = string;`,
      `  interface IntrinsicElements { [name: string]: { children?: unknown } }`,
      `}`,
      ``,
    ].join("\n");
    const classicImports = `import { Fragment, h } from "myjsx";\nvoid h;\nvoid Fragment;\n`;
    const cases: {
      label: string;
      options: Record<string, unknown>;
      view: string;
      args?: string[];
      files?: Record<string, string>;
    }[] = [
      {
        label: "react",
        options: { jsx: "react", jsxFactory: "h", jsxFragmentFactory: "Fragment" },
        view: classicImports + JSX_COMPONENT_SOURCE,
        files: { "src/jsx.d.ts": globalJsx },
      },
      {
        label: "react-jsxdev",
        options: { jsx: "react-jsxdev", jsxImportSource: "myjsx" },
        view: JSX_COMPONENT_SOURCE,
      },
      {
        label: "reactNamespace",
        options: { jsx: "preserve", reactNamespace: "R" },
        view: `import * as R from "myjsx";\nvoid R;\n` + JSX_COMPONENT_SOURCE,
        files: { "src/jsx.d.ts": globalJsx },
      },
      {
        // No factory in scope and no global `JSX`: only the automatic runtime
        // the checker already reads under `preserve` can compile this.
        label: "factory and import source",
        options: {
          jsx: "preserve",
          jsxFactory: "h",
          jsxFragmentFactory: "Fragment",
          jsxImportSource: "myjsx",
        },
        view: JSX_COMPONENT_SOURCE,
      },
      {
        label: "response file",
        options: { jsx: "react-jsx", jsxImportSource: "myjsx" },
        view: JSX_COMPONENT_SOURCE,
        args: ["@jsx.rsp"],
        files: { "jsx.rsp": "--jsx preserve\n" },
      },
    ];

    for (const { label, options, view, args = [], files = {} } of cases) {
      const root = TestProject.createProject({
        ...JSX_RUNTIME_PACKAGE,
        ...files,
        "package.json": JSON.stringify({ name: "jsx-modes", private: true }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            outDir: "lib",
            types: [],
            ...options,
          },
          include: ["src"],
        }),
        "src/view.tsx": view,
        "src/main.tsx": `import { view } from "./view";\nconsole.log(view);\n`,
      });
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...args, "src/main.tsx"],
        { cwd: root },
      );
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), JSX_COMPONENT_OUTPUT, label);
    }
  };
