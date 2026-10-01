import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

const project = {
  name: "sourceMap emits a JavaScript map next to output",
  root: () =>
    commonJsProject(
      FixtureFiles.read("ttsc/compiler_corpus_sourcemap_emits_a_javascript_map_next_to_output/inputs-1"),
      {
        compilerOptions: {
          sourceMap: true,
        },
      },
    ),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js.map")), true);
  },
};

/**
 * Verifies compiler corpus: `sourceMap: true` emits a `.js.map` file next to
 * the output JavaScript.
 *
 * Source maps are produced by the Go backend and written as a sibling of the
 * `.js` file. Pins the end-to-end contract through the CLI so the tsconfig
 * `sourceMap` option is not silently dropped between the JS shim and the Go
 * compiler invocation.
 *
 * 1. Create a CommonJS project with `compilerOptions.sourceMap: true`.
 * 2. Run `ttsc --emit`.
 * 3. Assert exit 0 and that `dist/main.js.map` exists on disk.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc emit with sourceMap true; asserts successful exit and dist/main.js.map presence after compiling an authored mapped function.
 * @evidence contracts/testing.md#independent-expectations TypeScript sourceMap requests a sibling map artifact and the named expected path follows configured outDir/rootDir. Presence detects an option dropped before emission but does not establish valid JSON, mappings or source positions.
 * @evidence contracts/testing.md#distinguishing-cases Owns the positive sourceMap option through the launcher and producer. It has no sourceMap=false counterexample or map-content assertion.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_sourcemap_emits_a_javascript_map_next_to_output is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The CLI must forward sourceMap into native compiler output and write its artifact to the consumer filesystem; option parsing alone cannot establish artifact delivery.
 * @evidence contracts/e2e.md#shared-execution One project compiler invocation verifies map-option forwarding and artifact production. Existing compiler/package build is shared and no plugin producer or runtime child is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh fixture output tree ensures an older map cannot satisfy the assertion. The compiler child exits synchronously before inspection and TestProject removes sources/outputs at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Exit success and produced-map existence remain in project.run. Source-map semantic fidelity is an explicit remaining limit rather than inferred from existence.
 */
export const test_compiler_corpus_sourcemap_emits_a_javascript_map_next_to_output =
  (): void => {
    const root = project.root();
    project.run(root);
  };
