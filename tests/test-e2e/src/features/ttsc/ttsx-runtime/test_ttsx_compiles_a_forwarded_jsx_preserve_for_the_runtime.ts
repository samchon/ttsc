import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../../internal/ttsc/internal/ttsx-jsx";

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
 * @evidence contracts/testing.md#behavioral-verification Executes the same JSX component with project react-jsx and forwarded jsx preserve, requiring both outputs to equal the authored HTML.
 * @evidence contracts/testing.md#independent-expectations The manual myjsx runtime and literal <div>hello</div><b>world</b> determine the oracle independently of compiler lowering.
 * @evidence contracts/testing.md#distinguishing-cases Default automatic lowering and forwarded preserve must both be executable; the sequential loop stops on its first failed variant.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_compiles_a_forwarded_jsx_preserve_for_the_runtime at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Two real ttsx/native compiler/Node connections prove preserved JSX is lowered into an executable runtime representation.
 * @evidence contracts/e2e.md#shared-execution The component project and authored runtime package are shared by the two fresh hosts; no per-variant native plugin producer is constructed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both variants use immutable fixture inputs and separate child lifetimes; the tracked project survives until process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both exact HTML assertions stay in this entry; compiler-option units do not replace execution of either variant.
 */
export function test_ttsx_compiles_a_forwarded_jsx_preserve_for_the_runtime() {
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
  }
