import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";

/**
 * Verifies a `--jsx preserve` forwarded before the entry is compiled for the
 * runtime, the way a forwarded `--target esnext` is lowered.
 *
 * Flags before the entry reach the type-check and win over the tsconfig, so the
 * runtime build has to read the effective `jsx`, not only the configured one
 * (samchon/ttsc#1408). Its negative twin is the project's own executable mode,
 * which must stay exactly as it was: the `react-jsx` run proves the replacement
 * is added only for a preserved mode.
 *
 * 1. Create a `react-jsx` project whose `jsxImportSource` is a local runtime.
 * 2. Run the entry as configured, then with `--jsx preserve` before it.
 * 3. Assert both runs render the component.
 */
export const test_ttsx_compiles_a_forwarded_jsx_preserve_for_the_runtime =
  () => {
    const root = TestProject.createProject({
      ...JSX_RUNTIME_PACKAGE,
      "package.json": JSON.stringify({ name: "forwarded-jsx", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          jsx: "react-jsx",
          jsxImportSource: "myjsx",
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.tsx": [JSX_COMPONENT_SOURCE, `console.log(view);`, ``].join(
        "\n",
      ),
    });

    for (const flags of [[], ["--jsx", "preserve"]]) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...flags, "src/main.tsx"],
        { cwd: root },
      );
      assert.equal(result.status, 0, `${flags.join(" ")}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), JSX_COMPONENT_OUTPUT);
    }
  };
