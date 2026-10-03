import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../../internal/ttsc/internal/ttsx-jsx";

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
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx serves a configured preserved-JSX dependency and a pragma-selected orphan to Node, requiring both complete HTML outputs and zero status.
 * @evidence contracts/testing.md#independent-expectations The authored myjsx runtime and literal component source specify div/hello plus b/world and i/orphan HTML independently of compiler output.
 * @evidence contracts/testing.md#distinguishing-cases An owning dependency config selects myjsx while a configless orphan selects it by source pragma. Root and public-register JSX preparation have separate survivor owners.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one actual root launcher with two runtime module consumers; authored runtime files and components are fixture inputs.
 * @evidence contracts/e2e.md#necessary-boundary Dependency project discovery and orphan pragma compilation are different runtime serving connections that direct Go JSX emission cannot certify.
 * @evidence contracts/e2e.md#shared-execution One authored runtime package, root compiler preparation and Node host serve both consumers. Their dependency versus orphan identities require separate emitted modules, not separate launcher sessions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Config/source/package inputs remain immutable and each consumer has a distinct owning path. The synchronous host completes before tracked fixture cleanup; no warm or invalidation state is claimed.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status and both exact rendered outputs remain in this batch. Each load is caught independently so a failed dependency still permits the orphan request, with distinct failure markers and a nonzero shared status. Both HTML assertions remain in the exact ordered output expectation.
 */
export function test_ttsx_runs_preserved_jsx_in_a_dependency_and_an_orphan() {
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
        `declare const process: { exitCode: number };`,
        `try { console.log(require("../dep/view.tsx").view); } catch (error) { console.log("DEPENDENCY_FAILED:" + String(error)); process.exitCode = 1; }`,
        `try { console.log(require("orphan-view").view); } catch (error) { console.log("ORPHAN_FAILED:" + String(error)); process.exitCode = 1; }`,
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
  }
