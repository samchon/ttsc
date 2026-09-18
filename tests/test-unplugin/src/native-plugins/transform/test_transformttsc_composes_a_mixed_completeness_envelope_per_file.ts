import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { declareComplete } from "../../internal/transform-complete/declareComplete";
import { fixtureHostInputs } from "../../internal/transform-complete/fixtureHostInputs";
import { member } from "../../internal/transform-complete/member";
import { reportDependencies } from "../../internal/transform-complete/reportDependencies";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies a mixed envelope composes per file: one transform declares
 * `src/main.ts` complete and says nothing about `src/other.ts`, and each file's
 * derivation follows its own status against that single envelope.
 */
export async function test_transformttsc_composes_a_mixed_completeness_envelope_per_file(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const other = path.join(root, "src", "other.ts");
  fs.writeFileSync(other, "export const other: number = 1;\n", "utf8");
  const options = resolveOptions({
    plugins: [
      reportDependencies(["src/consulted.d.ts"]),
      ...emitGraphPlugins(GRAPH),
      {
        transform: "./plugin.cjs",
        name: "echo",
        operation: "echo-file",
        path: "src/other.ts",
      },
      declareComplete(["src/main.ts"]),
    ],
  });
  // One shared cache, so both files read out of one envelope the way a bundler
  // calls the adapter file by file over a single project transform.
  const cache = createTtscTransformCache();

  const collect = async (file: string): Promise<string[]> => {
    const watched: string[] = [];
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: (input: string) => watched.push(input) },
    );
    assert.ok(result);
    return [...watched].sort();
  };

  assert.deepEqual(
    await collect(TestUnpluginProject.mainFile(root)),
    [member(root, "src/consulted.d.ts"), ...fixtureHostInputs(root)].sort(),
  );
  assert.deepEqual(
    await collect(other),
    [
      member(root, "src/other-type.d.ts"),
      member(root, "src/ambient.d.ts"),
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
