import fs from "node:fs";
import path from "node:path";

import type { IBenchmarkWorkspace } from "../internal/IBenchmarkWorkspace";
import type { IRunResult } from "../internal/IRunResult";
import { assertExcludes } from "../internal/assertExcludes";
import { assertStatus } from "../internal/assertStatus";
import { acquireBenchmarkWorkspace } from "../internal/benchmarkWorkspace";
import { provisionEnvironment } from "../internal/provisionEnvironment";
import { runScript } from "../internal/runScript";
import { sdkAccessorAddresses } from "../internal/sdkAccessorAddresses";

/**
 * Verifies the delivered Evidence workspace passes every layer gate while its
 * claims are still staged shut.
 *
 * This is the state a cell is handed, and two opposite failures live in it. A
 * scaffold that cannot build makes the arm unmeasurable — every Evidence gate
 * runs through `ttsc`, which evaluates `lint.config.ts` in a Program of its
 * own, so a configuration that type-checks nowhere fails `build:main`,
 * `build:sdk`, `build:test`, and `lint` alike before any evidence work starts.
 * A scaffold that reports evidence obligations while every claim still carries
 * `disabled` would flood a cell's context with errors for tags it was told not
 * to write yet. The staged graph must be installed, loadable, and silent.
 *
 * 1. Materialize the Evidence arm through the runner's own preparation path.
 * 2. Assert the packed plugin archive was injected as a local dependency.
 * 3. Run every layer gate a cell runs and require a zero exit from each.
 * 4. Assert no obligation was reported, and that `build:sdk` really published the
 *    accessor surface later cases derive their expectations from.
 *
 * @evidence contracts/testing.md#behavioral-verification Evidence archive/file dependency must exist; nine package gates exit zero, seven backend outputs omit Missing acknowledgement, and generated SDK accessor discovery is nonempty.
 * @evidence contracts/testing.md#independent-expectations Delivered archive path/file specifier, shipped command contracts and generator-authored accessor tags define independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Disabled backend claims stay silent; API/frontend lint assert status only. Missing injection and empty SDK output fail separately.
 * @evidence contracts/testing.md#execution-ownership The matching features export runs via DynamicExecutor and nine actual pnpm requests against the installed Evidence consumer.
 * @evidence contracts/e2e.md#necessary-boundary Packed plugin injection, installed lint-config evaluation, native compilation and SDK publication must connect while staged backend claims stay silent.
 * @evidence contracts/e2e.md#shared-execution Shared Evidence preparation/pack serve seven ordered backend scripts, two sibling lint requests and one generated SDK walk.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Baseline restore retains ignored installation/output. Example environment and schema reset prepare live backend tests; synchronous commands finish and benchmarkWorkspace owns cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original injection, nine status, seven silence and nonempty-accessor checks remain; archive byte equality and sibling diagnostic-string absence are not asserted.
 */
export const test_benchmark_evidence_workspace_passes_every_layer_gate =
  async (): Promise<void> => {
    const workspace: IBenchmarkWorkspace =
      await acquireBenchmarkWorkspace("evidence");
    assertArchiveInstalled(workspace);

    provisionEnvironment(workspace.workspace);
    const backend: string = path.join(
      workspace.workspace,
      "packages",
      "backend",
    );
    // `schema` is the disposable SQLite reset the template prescribes before
    // anything runs against a live server, and `test` opens one. The rest are
    // the layer gates themselves, in the order the arm's instruction stages
    // them.
    const gates: readonly string[] = [
      "build:prisma",
      "schema",
      "build:main",
      "build:sdk",
      "build:test",
      "lint",
      "test",
    ];
    for (const script of gates) {
      const result: IRunResult = runScript({ cwd: backend, script });
      assertStatus(
        result,
        0,
        `The Evidence backend must pass \`pnpm ${script}\` on the delivered workspace. A gate that fails before a cell writes anything measures the scaffold rather than the treatment.`,
      );
      assertExcludes(
        result,
        "Missing acknowledgement",
        `\`pnpm ${script}\` reported an evidence obligation while every claim still carries its \`disabled\` marker. A staged claim owes nothing; reporting here would fill a cell's context with errors for tags the instruction told it not to write yet.`,
      );
    }

    for (const owner of ["api", "frontend"]) {
      const result: IRunResult = runScript({
        cwd: path.join(workspace.workspace, "packages", owner),
        script: "lint",
      });
      assertStatus(
        result,
        0,
        `The Evidence \`packages/${owner}\` package must lint clean on the delivered workspace.`,
      );
    }

    // Deriving the accessor surface here is what makes the package-reference
    // cases assert against generation output rather than against a name written
    // down in this suite, and an empty derivation would silently turn those
    // assertions into no-ops. `sdkAccessorAddresses` refuses an empty result for
    // that reason, so calling it is the assertion.
    sdkAccessorAddresses(
      path.join(workspace.workspace, "packages", "api", "src", "functional"),
    );
  };

/**
 * Fails unless the packed plugin reached the workspace as a local dependency.
 *
 * The Evidence arm installs one immutable archive that the runner packs from
 * `packages/evidence`; nothing in the template names the plugin otherwise. If
 * the injection were skipped, every `lint.config.ts` import would fail to
 * resolve and the arm's gates would fail for a reason unrelated to the graph.
 */
const assertArchiveInstalled = (workspace: IBenchmarkWorkspace): void => {
  const archive: string = path.join(
    workspace.workspace,
    ".benchmark-deps",
    "evidence.tgz",
  );
  if (!fs.existsSync(archive))
    throw new Error(
      `The Evidence arm must carry its packed plugin at ${archive}; without it the arm's lint configuration cannot resolve its import.`,
    );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(workspace.workspace, "package.json"), "utf8"),
  ) as { devDependencies?: Record<string, string> };
  const specifier: string | undefined =
    manifest.devDependencies?.["@ttsc/evidence"];
  if (specifier === undefined || !specifier.startsWith("file:"))
    throw new Error(
      `The prepared manifest must depend on the packed plugin through a local \`file:\` specifier, so a cell lints against the archive under measurement rather than whatever a registry serves. Found: ${String(specifier)}.`,
    );
};
