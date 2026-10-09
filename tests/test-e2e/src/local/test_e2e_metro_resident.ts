import { TestExecutor, TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BatchWorkspace } from "../batch/BatchWorkspace";
import { createLoaderPoolWorker } from "../batch/LoaderPoolWorker";
import { MetroResidentBoundary } from "../batch/MetroResidentBoundary";

/**
 * Run only the real initial resident installation/proof/descriptor boundary.
 *
 * The default index selects nine full callbacks. This local
 * diagnostic borrows their actual packed installation/fixture preparation and
 * shared assertions, not their acceptance result. Upfront dead-claim, public
 * cold/cache/failure controls, two-adapter sharing and later
 * mutation/repair/restart controls are not selected and require full Metro.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual Metro worker completes public prepare without a Program tick, then runs the original two native graph captures and descriptor/runtime-input commands with their exact shared assertions and joined stderr markers.
 * @evidence contracts/testing.md#independent-expectations Shared assertion owners retain literal served source/nativePrograms2, actual declaration immutability, exact descriptor failures/contributors and original runtime-input/config fingerprints; this entry cannot replace them with prepared outputs.
 * @evidence contracts/testing.md#distinguishing-cases Readiness error, delivery refusal, descriptor failure and joined close remain independently collected failures. Failed work retains its workspace and native trace; startup or close does not certify a reusable generation.
 * @evidence contracts/testing.md#execution-ownership This opt-in file is outside the default index's nine selected feature paths. Its supported campaign invocation selects this TestExecutor location under an existing qualified native supervisor; arbitrary bare invocation is not certified contained. One Metro worker replaces the full pool's two workers for this subset, with no later restart; the omitted Turbopack/full scopes remain unverified.
 * @evidence contracts/e2e.md#necessary-boundary Actual packed preparation and resident native/descriptor line responses detect installation, IPC and publication defects that pure helper calls do not exercise.
 * @evidence contracts/e2e.md#shared-execution BatchWorkspace.open supplies the original single installation/fixture family. The same resident owns one public prepare call, two graph captures and the same two descriptor commands; descriptor/native admission re-observation remains actual work, not a zero-cost or warmed result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh owned session and descriptor population are created before preparation. Successful graceful close precedes config restoration; failed close or unknown borrower retirement retains inputs, and retention failures accompany the original error.
 * @evidence contracts/e2e.md#preserved-coverage This subset shares its source generation and assertions with full Metro; it makes no claim about omitted upfront controls, adapter sharing, churn/repair/restart, full suite acceptance or total independent E2E counts.
 */
export async function test_e2e_metro_resident(): Promise<void> {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const workspace = await BatchWorkspace.open();
  const configPath = path.join(workspace.root, "tsconfig.json");
  const originalConfig = fs.readFileSync(configPath);
  const config = JSON.parse(originalConfig.toString("utf8"));
  const nativeProbe = config.compilerOptions.plugins.find(
    (entry: { name?: string }) => entry.name === "shared-real-program-probe",
  );
  assert.ok(nativeProbe && typeof nativeProbe.fixtureSource === "string");
  const configuredTrace = process.env.TTSC_E2E_TRACE;
  if (configuredTrace !== undefined)
    assert.ok(path.isAbsolute(configuredTrace));
  const traceRoot = TestProject.tmpdir(
    "ttsc-loader-pool-observations-",
    configuredTrace,
  );
  const session = path.join(workspace.root, "loader-pool-session");
  const failures: unknown[] = [];
  let worker: ReturnType<typeof createLoaderPoolWorker> | undefined;
  let joined = false;
  let descriptorInputs:
    | ReturnType<typeof MetroResidentBoundary.createDescriptorInputs>
    | undefined;
  try {
    assert.equal(fs.existsSync(session), false);
    fs.mkdirSync(session);
    descriptorInputs = MetroResidentBoundary.createDescriptorInputs(
      workspace,
      nativeProbe.fixtureSource,
      path.join(path.dirname(nativeProbe.fixtureSource), "cmd/public-probe"),
    );
    MetroResidentBoundary.selectAdapterProgram(config);
    fs.writeFileSync(configPath, JSON.stringify(config));
    const beforePreparation = fs.existsSync(workspace.programRunLog)
      ? fs.statSync(workspace.programRunLog).size
      : 0;
    worker = createLoaderPoolWorker({
      mode: "metro",
      root: workspace.root,
      cache: workspace.cache,
      session,
      traceRoot,
      prepareNative: TestUnpluginRuntime.libUrl("api"),
      metro: pathToFileURL(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/metro/lib/transformer.js",
        ),
      ).href,
      turbopack: TestUnpluginRuntime.libUrl("turbopack"),
    });
    await MetroResidentBoundary.observeGraphProof(
      worker,
      workspace,
      beforePreparation,
      failures,
    );
    await MetroResidentBoundary.observeDescriptors(
      worker,
      workspace,
      descriptorInputs,
      failures,
    );
  } catch (error) {
    failures.push(error);
  } finally {
    if (worker !== undefined) {
      try {
        await worker.close();
        joined = true;
      } catch (error) {
        failures.push(error);
      }
      // Original stream close is independently observable; a failed close
      // does not grant shared-input restoration or native borrower retirement.
      if (worker.joined) {
        try {
          MetroResidentBoundary.assertDiagnostics(worker, false);
          if (worker.descriptorCommandCompleted)
            MetroResidentBoundary.assertDiagnostics(worker);
          else failures.push(new Error("Blocked descriptor markers: lint operation has no successful completion reply"));
        } catch (error) {
          failures.push(error);
        }
      }
    } else joined = true;
    if (joined) {
      const restored = await TestExecutor.collectPhases([
        { name: "restore local config", run: () => fs.writeFileSync(configPath, originalConfig) },
        { name: "remove local session", run: () => fs.rmSync(session, { recursive: true }) },
        ...(descriptorInputs !== undefined && failures.length === 0
          ? [{ name: "remove completed local descriptors", run: () => fs.rmSync(descriptorInputs!.descriptorFailureRoot, { recursive: true }) }]
          : []),
      ]);
      for (const result of restored)
        if (result.status === "failed")
          failures.push(new Error(result.name, { cause: result.error }));
    }
    if (failures.length > 0 || !joined) {
      BatchWorkspace.retain("local resident failure retains actual inputs");
      try {
        TestProject.retainTemporaryDirectory(
          traceRoot,
          "local resident failure retains native argv/key/terminal observations",
        );
      } catch (error) {
        failures.push(error);
      }
      console.error("Local Metro resident observations retained: " + traceRoot);
    }
    console.log(
      "Local Metro resident scope",
      JSON.stringify({
        startedAt,
        finishedAt: new Date().toISOString(),
        elapsedMs: performance.now() - started,
        fullMetroAcceptance: false,
        omitted: [
          "upfront cold/negative/cache/dead-claim",
          "Turbopack/initial adapter sharing",
          "later mutation/repair/restart",
        ],
      }),
    );
  }
  if (failures.length)
    throw new AggregateError(failures, "local actual Metro resident boundary");
}
