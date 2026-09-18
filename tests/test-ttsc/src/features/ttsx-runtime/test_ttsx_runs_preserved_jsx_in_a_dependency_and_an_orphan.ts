import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";

/**
 * Verifies ttsx runs JSX in the two runtime lanes the entry build does not
 * cover: a dependency whose own project preserves JSX, and an orphan with no
 * project at all.
 *
 * A dependency is compiled through its own tsconfig, so its `preserve` needs
 * the same replacement as the entry's (samchon/ttsc#1408). An orphan is
 * compiled in isolation, ignoring every config, so no `jsx` reaches it at all:
 * it is compiled with the automatic runtime, and a `@jsxImportSource` pragma in
 * the file picks the runtime, as it would anywhere.
 *
 * 1. Create a workspace `dep` whose tsconfig preserves JSX with a local
 *    `jsxImportSource`, and an installed `orphan-view` package with no tsconfig
 *    whose `.tsx` names the runtime by pragma.
 * 2. Run an app entry that requires both.
 * 3. Assert both components render.
 */
export const test_ttsx_runs_preserved_jsx_in_a_dependency_and_an_orphan =
  () => {
    const root = TestProject.createProject({
      ...JSX_RUNTIME_PACKAGE,
      "package.json": JSON.stringify({ name: "jsx-lanes", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => { view: string };`,
        `console.log(require("../dep/view.tsx").view);`,
        `console.log(require("orphan-view").view);`,
        `export {};`,
        ``,
      ].join("\n"),
      "dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          jsx: "preserve",
          jsxImportSource: "myjsx",
          types: [],
        },
        include: ["view.tsx"],
      }),
      "dep/view.tsx": JSX_COMPONENT_SOURCE,
      "node_modules/orphan-view/package.json": JSON.stringify({
        name: "orphan-view",
        version: "1.0.0",
        main: "view.tsx",
      }),
      "node_modules/orphan-view/view.tsx": [
        `/** @jsxImportSource myjsx */`,
        `export const view: string = <i>orphan</i>;`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), [
      "<div>hello</div><b>world</b>",
      "<i>orphan</i>",
    ]);
  };
