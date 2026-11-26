import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { inheritedSidecarEnv } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/inheritedSidecarEnv";

/**
 * Verifies one-shot native plugin environments carry `TTSC_BATCH=1` while
 * resident and inherited sidecar environments clear it even when the parent
 * process has it set.
 *
 * A compiler batch hook disables or relaxes Go's collector for a process that
 * runs one batch command and exits. If an inherited `TTSC_BATCH=1` reached a
 * resident child (`check-serve`, `serve`, LSP) or a nested descriptor load,
 * that long-lived process would inherit batch GC tuning it never asked for.
 *
 * 1. Set `TTSC_BATCH=1` in `process.env` and in caller/merged environments.
 * 2. Compose one-shot (`batch: true`) and resident (`batch: false` and default)
 *    environments through `BuildExecution.composeNativePluginEnv` for check and
 *    transform stages.
 * 3. Compose an inherited sidecar environment through `inheritedSidecarEnv`.
 * 4. Assert one-shot environments carry `TTSC_BATCH="1"` and resident and
 *    inherited environments clear `TTSC_BATCH` to `undefined`.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls BuildExecution.composeNativePluginEnv and inheritedSidecarEnv directly with TTSC_BATCH set in process.env and caller layers, asserting exact presence for one-shot spawns and removal for resident and inherited spawns.
 * @evidence contracts/testing.md#independent-expectations The literal variable name TTSC_BATCH and value "1" versus undefined come directly from the one-shot marker protocol contract rather than from helper constants under test.
 * @evidence contracts/testing.md#distinguishing-cases One-shot with absent parent marker, one-shot overriding non-"1" parent marker, resident with batch=false and omitted default under inherited TTSC_BATCH=1 across check and transform stages, and inheritedSidecarEnv under inherited and caller TTSC_BATCH=1.
 * @evidence contracts/testing.md#execution-ownership A TypeScript unit test calling pure environment composers in process without spawning a child, building a host or installing a consumer, and restoring process.env in finally.
 */
export function test_ttsc_batch_marker_marks_one_shot_and_clears_resident_spawns(): void {
  const savedBatch = process.env.TTSC_BATCH;
  try {
    const projectRoot = os.tmpdir();
    const tsconfig = path.join(projectRoot, "tsconfig.json");
    const project = {
      configPaths: [tsconfig],
      compilerOptions: { plugins: [] },
      identity: {
        invocationCwd: projectRoot,
        logicalConfigPath: tsconfig,
        logicalProjectRoot: projectRoot,
        physicalConfigPath: tsconfig,
        physicalProjectRoot: projectRoot,
      },
      path: tsconfig,
      pluginBaseDirs: [],
      root: projectRoot,
    };
    const execution: Parameters<
      typeof BuildExecution.composeNativePluginEnv
    >[2] = {
      compilerSelection: {
        args: [],
        passthrough: [],
        compilerArgsCwd: projectRoot,
        inspectionError: undefined,
        inspectedArgs: [],
        observations: new Map(),
        project,
        projectGuard: [],
      },
      cwd: projectRoot,
      nativePlugins: [],
      pluginConfigDir: undefined,
      pluginSetupFailure: undefined,
      project,
      projectNoEmit: false,
      projectRoot,
      rewriteRelativeImportExtensionsForEmit: false,
      tsgo: {
        binary: "/selected/tsgo",
        packageJson: "",
        packageRoot: "/selected",
        version: "custom",
      },
      tsconfig,
    };
    const plugin = (
      stage: "check" | "transform",
    ): NonNullable<
      Parameters<typeof BuildExecution.composeNativePluginEnv>[4]
    > => ({
      binary: "/selected/host",
      config: {},
      kind: "executable",
      source: "/selected/source",
      stage,
    });

    // One-shot spawns set TTSC_BATCH=1 even when the parent environment has it unset or set to another value.
    delete process.env.TTSC_BATCH;
    for (const stage of ["check", "transform"] as const) {
      const fromUnset = BuildExecution.composeNativePluginEnv(
        SidecarEnvironment.merge(process.env),
        undefined,
        execution,
        "/selected/node",
        plugin(stage),
        undefined,
        true,
      );
      assert.equal(fromUnset.TTSC_BATCH, "1", `one-shot ${stage} from unset`);

      const fromZero = BuildExecution.composeNativePluginEnv(
        SidecarEnvironment.merge(process.env, { TTSC_BATCH: "0" }),
        { TTSC_BATCH: "0" },
        execution,
        "/selected/node",
        plugin(stage),
        undefined,
        true,
      );
      assert.equal(fromZero.TTSC_BATCH, "1", `one-shot ${stage} from 0`);
    }

    // Resident spawns (batch=false or omitted) clear TTSC_BATCH even when inherited from process.env and caller env.
    process.env.TTSC_BATCH = "1";
    for (const stage of ["check", "transform"] as const) {
      const residentExplicit = BuildExecution.composeNativePluginEnv(
        SidecarEnvironment.merge(process.env, { TTSC_BATCH: "1" }),
        { TTSC_BATCH: "1" },
        execution,
        "/selected/node",
        plugin(stage),
        undefined,
        false,
      );
      assert.equal(
        residentExplicit.TTSC_BATCH,
        undefined,
        `resident explicit false ${stage}`,
      );

      const residentDefault = BuildExecution.composeNativePluginEnv(
        SidecarEnvironment.merge(process.env, { TTSC_BATCH: "1" }),
        { TTSC_BATCH: "1" },
        execution,
        "/selected/node",
        plugin(stage),
      );
      assert.equal(
        residentDefault.TTSC_BATCH,
        undefined,
        `resident default ${stage}`,
      );
    }

    // Inherited sidecar env (used by plugin loading, native builds and descriptor children) clears TTSC_BATCH.
    assert.equal(inheritedSidecarEnv(undefined).TTSC_BATCH, undefined);
    assert.equal(
      inheritedSidecarEnv({ TTSC_BATCH: "1" }).TTSC_BATCH,
      undefined,
    );
  } finally {
    if (savedBatch === undefined) delete process.env.TTSC_BATCH;
    else process.env.TTSC_BATCH = savedBatch;
  }
}
