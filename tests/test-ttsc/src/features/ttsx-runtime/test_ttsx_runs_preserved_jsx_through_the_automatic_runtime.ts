import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";
import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies ttsx runs JSX a project preserves for another tool, compiled through
 * the automatic runtime its `jsxImportSource` names.
 *
 * Pins samchon/ttsc#1408. `jsx: "preserve"` is Next.js's default, and
 * `react-native` preserves the same way, so the runtime build kept JSX and Node
 * failed at the first `<` with a `SyntaxError`. The runtime build now picks the
 * executable mode that keeps the project's declared factory, the way it lowers
 * `target: ESNext` for decorators, and leaves the tsconfig untouched.
 *
 * 1. Create a `preserve` project whose `jsxImportSource` is a local runtime, with
 *    a component using elements and a fragment.
 * 2. Run the entry through ttsx and through the `ttsc/register` preload, then
 *    again through ttsx with `jsx: "react-native"`.
 * 3. Assert each run renders the component, and that the tsconfig on disk is
 *    unchanged.
 */
export const test_ttsx_runs_preserved_jsx_through_the_automatic_runtime =
  () => {
    const tsconfig = (jsx: string): string =>
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          jsx,
          jsxImportSource: "myjsx",
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      });
    const root = TestProject.createProject({
      ...JSX_RUNTIME_PACKAGE,
      "package.json": JSON.stringify({ name: "preserved-jsx", private: true }),
      "tsconfig.json": tsconfig("preserve"),
      "src/view.tsx": JSX_COMPONENT_SOURCE,
      "src/main.tsx": [
        `import { view } from "./view";`,
        `console.log(view);`,
        ``,
      ].join("\n"),
    });
    linkTtscPackage(root);

    const direct = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.tsx"],
      { cwd: root },
    );
    assert.equal(direct.status, 0, direct.stderr);
    assert.equal(direct.stdout.trim(), JSX_COMPONENT_OUTPUT);

    const registered = TestProject.spawn(
      process.execPath,
      ["--require", TTSX_REGISTER, "src/main.tsx"],
      { cwd: root },
    );
    assert.equal(registered.status, 0, registered.stderr);
    assert.equal(registered.stdout.trim(), JSX_COMPONENT_OUTPUT);
    assert.equal(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
      tsconfig("preserve"),
    );

    TestProject.writeFiles(root, { "tsconfig.json": tsconfig("react-native") });
    const native = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.tsx"],
      { cwd: root },
    );
    assert.equal(native.status, 0, native.stderr);
    assert.equal(native.stdout.trim(), JSX_COMPONENT_OUTPUT);
  };
