import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, fakeUpstreamOptions } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies a file outside the tsconfig program passes through untransformed.
 *
 * A file the compiled program does not contain is not a build error. The shared
 * `@ttsc/unplugin` core decides that once for every adapter and returns
 * `undefined`, exactly as it does for a module ttsc leaves unchanged, so this
 * transformer hands the original source downstream with no special case of its
 * own. It used to recognise the condition by searching the error text, which is
 * how one product came to hold two different answers to it, with every unplugin
 * adapter failing the build for what this one called non-fatal
 * (samchon/ttsc#1308). Exercises the real native compiler (Go source plugin) →
 * runs in CI.
 *
 * 1. Create the fixture project and a stray `.ts` file outside its `src/`.
 * 2. Transform the stray file (relative path + projectRoot).
 * 3. Assert the upstream received the original, untransformed source.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual out-of-program native transform preserves source, records exact external config-selection candidates and taint, then a config inclusion edit changes the guarded key.
 * @evidence contracts/testing.md#independent-expectations The authored stray file belongs to a separate config that initially excludes scripts; literal original source and selection paths independently establish pass-through and future inclusion.
 * @evidence contracts/testing.md#distinguishing-cases Out-of-program pass-through contrasts true plugin failure; later include mutation exercises recovery from that earlier admission decision.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Only actual compiler program membership can establish this module was excluded while the adapter retains its project-selection dependency guards.
 * @evidence contracts/e2e.md#shared-execution The same external project and bare Metro root serve pass-through and later key checks using the suite native producer cache. Including scripts requires a fresh fingerprint; no unnecessary second native transform is used. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the external config include changes; run IDs, worker compaction and option restoration maintain explicit generation ownership. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original source equality, taint, every external selection candidate, fresh-epoch inequality and config-inclusion invalidation remain.
 */
export async function case_metro_transformer_passes_files_outside_the_project_through(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterBare(workspace);
  const externalProject = MetroWorkspace.enterProject(workspace, {}, "external-project");
  const src = "export const value: number = 1;\n";
  const stray = path.join(externalProject, "scripts", "stray.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  fs.writeFileSync(stray, src, "utf8");
  const options = fakeUpstreamOptions();
  const runId = await prepareSnapshot(root);
  const before = await TestMetroRuntime.withTransformerEnv(
    options,
    (mod) => mod.getCacheKey({ projectRoot: root }),
    runId,
  );
  const result = await TestMetroRuntime.runTransform({
    options,
    params: {
      src,
      filename: stray,
      options: { projectRoot: root },
    },
    snapshotRunId: runId,
  });
  assert.equal(result.ast.__fakeUpstream, true);
  assert.equal(result.ast.src, src);

  const snapshotDirectory = path.join(
    root,
    "node_modules",
    ".cache",
    "ttsc-metro",
  );
  const worker = JSON.parse(
    fs.readFileSync(
      fs
        .readdirSync(snapshotDirectory)
        .map((name) => path.join(snapshotDirectory, name))
        .find((file) =>
          path.basename(file).startsWith("graph-inputs.worker-"),
        )!,
      "utf8",
    ),
  ) as { files: string[]; tainted: boolean };
  assert.equal(
    worker.tainted,
    true,
    "a pass-through outside the static project map must rotate the snapshot epoch",
  );
  assert.ok(
    worker.files.includes(path.join(externalProject, "tsconfig.json")) &&
      worker.files.includes(
        path.join(externalProject, "scripts", "tsconfig.json"),
      ),
    "the pass-through must retain its external config and every project-selection candidate",
  );

  await prepareSnapshot(root);
  const guardedRunId = await prepareSnapshot(root);
  const guardedBeforeEdit = await TestMetroRuntime.withTransformerEnv(
    options,
    (mod) => mod.getCacheKey({ projectRoot: root }),
    guardedRunId,
  );
  assert.notEqual(
    before,
    guardedBeforeEdit,
    "the tainted pass-through run must be isolated under a fresh epoch",
  );
  const configPath = path.join(externalProject, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    include?: string[];
  };
  config.include = ["src", "scripts"];
  fs.writeFileSync(configPath, JSON.stringify(config), "utf8");
  const nextRunId = await prepareSnapshot(root);
  const after = await TestMetroRuntime.withTransformerEnv(
    options,
    (mod) => mod.getCacheKey({ projectRoot: root }),
    nextRunId,
  );
  assert.notEqual(
    guardedBeforeEdit,
    after,
    "including a formerly passed-through external module must invalidate its cached upstream result",
  );
}
