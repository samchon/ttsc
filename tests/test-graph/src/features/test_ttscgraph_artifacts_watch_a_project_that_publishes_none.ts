import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

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
  * @evidence contracts/testing.md#behavioral-verification The compiled publication API resolves the actual compiler plugin population, returns no artifact for a project with no publisher and records its tsconfig and manifest; an actual config edit withdraws freshness.
 * @evidence contracts/testing.md#independent-expectations An unconfigured project has no graph-node publisher; literal required watch paths and an independent config edit define the expected empty and stale answers.
 * @evidence contracts/testing.md#distinguishing-cases A successfully resolved empty population contrasts its unchanged reuse state and a subsequent plugin-config edit; portable fingerprint transitions have a separate direct-input source unit.
 * @evidence contracts/testing.md#execution-ownership This named features entry exercises compiled graph code and the real compiler plugin-discovery process over an isolated consumer fixture, so it requires the native boundary batch rather than source-unit CI.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler plugin discovery must distinguish resolved-empty from unavailable and record the two discovery inputs; direct fingerprint predicates cannot establish that native connection.
 * @evidence contracts/e2e.md#shared-execution The existing graph boundary process reuses the suite-built compiler and dependency links; this one empty-publisher project starts no contributor build or publisher sidecar.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture owns its project files and deliberately changes only its tsconfig after the fresh baseline; TestProject tracks and removes its directory at process completion.
 * @evidence contracts/e2e.md#preserved-coverage All original no-artifact, exact watched-file, unchanged-fresh and config-edit-stale assertions remain here; separate source units cover direct freshness and declared-file transitions without a compiler host.
 */
export function test_ttscgraph_artifacts_watch_a_project_that_publishes_none(): void {
    const cwd = TestProject.createProject({
      "package.json": JSON.stringify({ name: "no-publisher" }),
      "src/index.ts": "export const value = 1;\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: { strict: true, target: "ES2022" },
        include: ["src"],
      }),
    });

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
  }
