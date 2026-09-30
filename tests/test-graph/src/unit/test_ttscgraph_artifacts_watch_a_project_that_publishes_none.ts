import { TestProject } from "../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { artifactsAreStale, publishArtifacts } from "../../../../packages/graph/src/model/publishedArtifacts";

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
 * @evidence contracts/testing.md#behavioral-verification publishArtifacts returns no file for an unconfigured fixture while tracking tsconfig and manifest; artifactsAreStale rejects freshness after a config edit.
 * @evidence contracts/testing.md#independent-expectations A project with no publisher has no artifacts, but its declared configuration can change that answer; literal control paths and explicit writes establish expectations.
 * @evidence contracts/testing.md#distinguishing-cases Initial absence and unchanged freshness contrast adding a plugin entry; real fixture files exercise resolver invalidation without any configured producer to build or launch.
 * @evidence contracts/testing.md#execution-ownership The named exported src/unit entry executes authored operations through the unit loader; no installed consumer, native build or product host is used.
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
