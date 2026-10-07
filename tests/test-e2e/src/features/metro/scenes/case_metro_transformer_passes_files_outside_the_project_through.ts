import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";
import {
  fakeUpstreamOptions,
  prepareSnapshot,
} from "../../../internal/metro/internal/metro-snapshot";

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
 * @evidence contracts/testing.md#behavioral-verification Actual native admission passes the authored stray source to echo upstream unchanged, records taint and the two asserted external config candidates, then fresh-epoch and config-inclusion keys differ. The candidate assertions are membership checks, not an exhaustive exact set.
 * @evidence contracts/testing.md#independent-expectations The authored stray file belongs to a separate config that initially excludes scripts; literal original source and selection paths independently establish pass-through and future inclusion.
 * @evidence contracts/testing.md#distinguishing-cases Out-of-program pass-through contrasts genuine rejection; later include mutation checks key invalidation, not a second native admission/output recovery. Stable-key controls at each fixed run/input state reject upstream fallback nonce as the cause of inequality.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes this selected scenario through the default built transformer unless TTSC_TEST_LAYER=unit. The authored echo upstream exposes source bytes, not a real Metro server/OS worker; source override execution does not certify built assembly.
 * @evidence contracts/e2e.md#necessary-boundary Only actual compiler program membership can establish this module was excluded while the adapter retains its project-selection dependency guards.
 * @evidence contracts/e2e.md#shared-execution One bare adapter root and one separate mutable plugin project serve the single native admission call and later key-only comparisons, reusing the selected shared producer. No second transform is requested after inclusion; parent calls/run IDs do not count compiler generations, processes or cache hits, and query imports are not OS workers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Explicit run IDs separate initial taint, guarded epoch and changed include input; each key is stable while its state is fixed. Runtime options env is restored after awaited calls, both slots reset prior state, and parent aggregate cleanup owns remaining files. Returned results/path removals do not certify arbitrary descendants or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original echo/source equality, taint, root+scripts config membership, fresh-epoch and inclusion key inequalities remain, strengthened by stable-key controls. No exhaustive candidate set or second-transform recovery is inferred; registration/built-layer binding/runtime survival/measurement remain unverified.
 */
export async function case_metro_transformer_passes_files_outside_the_project_through(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterBare(workspace);
  const externalProject = MetroWorkspace.enterProject(
    workspace,
    {},
    "external-project",
  );
  const src = "export const value: number = 1;\n";
  const stray = path.join(externalProject, "scripts", "stray.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  fs.writeFileSync(stray, src, "utf8");
  const options = fakeUpstreamOptions();
  const runId = await prepareSnapshot(root);
  const before = await TestMetroRuntime.withTransformerEnv(
    options,
    (mod) => {
      const key = mod.getCacheKey({ projectRoot: root });
      assert.equal(
        mod.getCacheKey({ projectRoot: root }),
        key,
        "fixed initial run/input must retain its key",
      );
      return key;
    },
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
    (mod) => {
      const key = mod.getCacheKey({ projectRoot: root });
      assert.equal(
        mod.getCacheKey({ projectRoot: root }),
        key,
        "fixed guarded run/input must retain its key",
      );
      return key;
    },
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
    (mod) => {
      const key = mod.getCacheKey({ projectRoot: root });
      assert.equal(
        mod.getCacheKey({ projectRoot: root }),
        key,
        "fixed included run/input must retain its key",
      );
      return key;
    },
    nextRunId,
  );
  assert.notEqual(
    guardedBeforeEdit,
    after,
    "including a formerly passed-through external module must invalidate its cached upstream result",
  );
}
