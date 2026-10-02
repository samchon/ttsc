import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import { installedTargetBoundary } from "../../../internal/graph/internal/installedTargetBoundary";

const require = createRequire(import.meta.url);
const graphLib = path.dirname(require.resolve("@ttsc/graph"));
const { artifactsAreStale, publishArtifacts } = require(
  path.join(graphLib, "model", "publishedArtifacts.js"),
) as {
  artifactsAreStale(published: IPublished): boolean;
  publishArtifacts(options: { cwd: string; tsconfig: string }): IPublished;
};

interface IPublished {
  file: string | null;
  inputs: { files: string[]; directories: { path: string }[] };
  fingerprint: string;
}

/**
 * Verifies that "this project publishes no artifacts" is an answer that can
 * change, not a dead end.
 *
 * The refresh is driven by the inputs a publisher declares, and a project with
 * no publisher declares none — so the obvious shape, returning nothing, watches
 * nothing, and a session that started before the plugin was configured would
 * answer "no artifacts" for as long as it lived. The user's fix would be to
 * restart the editor, having been given no reason to think that would help.
 *
 * What is watched instead is the pair of files that can turn the answer around:
 * the project's own tsconfig, and its `package.json`. Re-running discovery
 * itself would be the direct question, but it walks the dependency closure
 * (samchon/ttsc#1276) — paying that on every request to learn nothing would
 * cost far more than the staleness it removes.
 *
 * 1. Publish for a project that configures no plugin.
 * 2. Assert the answer is "none", and that it names those two files.
 * 3. Assert it reads fresh against itself.
 * 4. Edit the tsconfig, and require it to read stale.
 *
 * @evidence contracts/testing.md#behavioral-verification The compiled publishArtifacts API returns null for a no-publisher project, watches its tsconfig and package.json, reads fresh unchanged and stale after configuring @ttsc/lint.
 * @evidence contracts/testing.md#independent-expectations Literal watched paths and the independent config edit define empty/fresh/stale expectations; resolved-empty requires a current capability discovery result, not merely an empty plugin array.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged resolved-empty contrasts a config edit that reopens discovery. Binary-unavailable discovery is not a substitute baseline: it reads stale and previously failed actual unit CI.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_artifacts_watch_a_project_that_publishes_none loads the compiled publication API with real installed capability discovery; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary publishArtifacts resolves runtime capabilities through resolveBinary/loadProjectPlugins and artifactsAreStale consults discovery.isCurrent; a fingerprint-only source unit cannot certify installed native availability.
 * @evidence contracts/e2e.md#shared-execution The target-installed resolution, no-publisher, resident lifetime and HTTP viewer consumers share one real project and installed binary copy. This scene starts no graph-node publisher sidecar; capability discovery still consults installed runtime inputs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The original no-publisher config is temporarily applied to the shared project; its fresh/changed discovery assertions run before original shared config bytes restore finally. Consumers run serially, no cache is deleted, and TestProject owns final project cleanup.
 * @evidence contracts/e2e.md#preserved-coverage No-artifact, required watch paths, unchanged-fresh and config-edit-stale assertions remain. Direct freshness source units cover constructed input transitions without replacing this discovery boundary.
 */
export function case_ttscgraph_artifacts_watch_a_project_that_publishes_none(): void {
  const target = installedTargetBoundary();
  const cwd = target.root;
  const configFile = path.join(cwd, "tsconfig.json");
  const original = fs.readFileSync(configFile);
  const primaryFailures: unknown[] = [];
  try {
    fs.writeFileSync(
      configFile,
      FixtureFiles.read(
        "graph/ttscgraph_artifacts_watch_a_project_that_publishes_none/inputs-1",
      )["tsconfig.json"]!,
    );

    const published = publishArtifacts({ cwd, tsconfig: "tsconfig.json" });
    assert.equal(
      published.file,
      null,
      "a project configuring no plugin was handed an artifact file",
    );

    const watched = new Set(published.inputs.files);
    for (const file of ["tsconfig.json", "package.json"])
      assert.equal(
        watched.has(path.resolve(cwd, file)),
        true,
        `nothing watches ${file}, so configuring a plugin could never be noticed: ${[...watched].join(", ")}`,
      );

    assert.equal(
      artifactsAreStale(published),
      false,
      "the answer read stale against the state it was produced from; every request would re-run plugin discovery",
    );

    // Configuring a plugin is a tsconfig edit, so a tsconfig edit is what must
    // reopen the question.
    fs.writeFileSync(
      path.join(cwd, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          plugins: [{ name: "@ttsc/lint" }],
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "utf8",
    );
    assert.equal(
      artifactsAreStale(published),
      true,
      "configuring a plugin left the answer reading fresh, so a running session would never reconsider it",
    );
  } catch (error) {
    primaryFailures.push(error);
    throw error;
  } finally {
    try {
      fs.writeFileSync(configFile, original);
    } catch (error) {
      target.preventReuse("Empty-artifact profile config restoration failed");
      throw new AggregateError(
        [...primaryFailures, error],
        "Empty-artifact assertions and config reset failed",
      );
    }
  }
}
