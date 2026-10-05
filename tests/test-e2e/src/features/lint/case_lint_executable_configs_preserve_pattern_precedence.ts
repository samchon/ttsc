import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../utils/src/TestProject";
import { EvidenceProcessOwnership } from "../../../../utils/src/evidence/EvidenceProcessOwnership";
import type { PreparedAssetSelection } from "../../internal/captureE2ePreparedAssets";
import {
  type TracePhaseObservation,
  captureE2eTracePhase,
} from "../../internal/captureE2eTracePhase";
import { readE2eTraceMeasurements } from "../../internal/readE2eTraceMeasurements";
import { case_lint_loader_preserves_observed_raw_normalization } from "./case_lint_loader_preserves_observed_raw_normalization";

/**
 * Verifies CJS and TypeScript loader options retain pattern precedence in
 * fixes.
 *
 * The already prepared native lint binary and installed consumer are supplied
 * by the common experiment. Each extension uses its real loader, then the
 * native string-content rule must replace foo with the authored first match.
 *
 * 1. Copy the same authored source and ordered options into the owned slot.
 * 2. Run the selected native binary's supported fix command for each extension.
 * 3. Require complete first/untouched output and restore all overwritten bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native fix loads CJS or TS config through the installed loader and applies unicorn/string-content to the real file; exact first/untouched text distinguishes an option map reorder producing second. Each actual native PID/phase pairs raw result-file value and accepted normalization with independently supplied cache outcome expectations.
 * @evidence contracts/testing.md#independent-expectations Literal foo$ before foo and expected first come from the original authored precedence regression, with untouched adjacent text preserved. No trace/raw JSON or native fix output generates the expectation.
 * @evidence contracts/testing.md#distinguishing-cases CJS and TS extension-specific loader paths are independently named profiles over identical rule inputs. Wrong precedence, no edit, unrelated edits, nonzero status, signal and spawn failure cannot count as success.
 * @evidence contracts/testing.md#execution-ownership Callable profile is not yet registered or executed. Caller owns the actual prepared binary, linked consumer, manifest and activation; Go direct JSON/cache units do not certify these two executable-loader connections.
 * @evidence contracts/e2e.md#necessary-boundary Config evaluation, result-file transport and native option consumption can disagree despite a direct JSON policy unit passing; this actual fixed file observes their joined consequence.
 * @evidence contracts/e2e.md#shared-execution Both profiles reuse the same supplied binary/consumer/installation. Their actual fix processes, loader children and Programs remain separately observed; two extension inputs are not claimed to reuse one Program or to reduce total starts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original bytes/absence of only four controlled files are saved before mutation and restored after synchronous direct-child return while ownership remains available. Null/signal/spawn failure conservatively retains inputs and blocks further mutation; this policy does not assert a child is alive or that direct-child closure proves arbitrary descendant termination. Actual phases retain the unchanged trace root and explicit producer observations.
 * @evidence contracts/e2e.md#preserved-coverage Preserves the authored ordered two-pattern source and full first/untouched result across actual CJS/TS evaluation. Reverse/duplicate/numeric-key and cold/memory/disk policy remain direct Go owners; original loader donors remain pending actual survivor selection/execution.
 */
export async function case_lint_executable_configs_preserve_pattern_precedence(
  directory: string,
  binary: string,
  observation: {
    traceRoot: string;
    producerAssets: readonly PreparedAssetSelection[];
    cacheRoots: readonly string[];
    cacheOutcomes: { cjs: readonly string[]; ts: readonly string[] };
  },
): Promise<
  readonly TracePhaseObservation<ReturnType<typeof E2eProcessTrace.spawnSync>>[]
> {
  assert.ok(path.isAbsolute(directory) && path.isAbsolute(binary));
  EvidenceProcessOwnership.assertAvailable(directory);
  const fixture = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests/test-e2e/fixtures/lint/ordered-loader-options",
  );
  const controlled = [
    "tsconfig.json",
    "loader-main.ts",
    "lint.config.cjs",
    "lint.config.ts",
  ];
  const previous = controlled.map((name) => {
    const file = path.join(directory, name);
    try {
      const stat = fs.lstatSync(file);
      assert.ok(
        stat.isFile(),
        "controlled input must be an owned regular file",
      );
      return { bytes: fs.readFileSync(file), mode: stat.mode & 0o777 };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  });
  const failures: unknown[] = [];
  const phases: TracePhaseObservation<
    ReturnType<typeof E2eProcessTrace.spawnSync>
  >[] = [];
  let cursor = readE2eTraceMeasurements(
    observation.traceRoot,
    [],
  ).lastWriterSequences;
  assert.ok(
    observation.producerAssets.some(
      (asset) =>
        asset.role === "executable" &&
        fs.realpathSync.native(asset.file) === fs.realpathSync.native(binary),
    ),
    "selected native executable asset",
  );
  try {
    for (const name of ["lint.config.cjs", "lint.config.ts"]) {
      EvidenceProcessOwnership.assertAvailable(directory);
      try {
        fs.copyFileSync(
          path.join(fixture, "tsconfig.json"),
          path.join(directory, "tsconfig.json"),
        );
        fs.copyFileSync(
          path.join(fixture, "main.ts"),
          path.join(directory, "loader-main.ts"),
        );
        fs.copyFileSync(path.join(fixture, name), path.join(directory, name));
        const requiredWriterPids: number[] = [];
        const phase = await captureE2eTracePhase(
          {
            label: `ordered-loader-${name}`,
            traceRoot: observation.traceRoot,
            assets: [
              ...observation.producerAssets,
              {
                label: `ordered-${name}-config`,
                file: path.join(directory, name),
                role: "configuration",
              },
              {
                label: `ordered-${name}-source`,
                file: path.join(directory, "loader-main.ts"),
                role: "fixture",
              },
              {
                label: `ordered-${name}-tsconfig`,
                file: path.join(directory, "tsconfig.json"),
                role: "configuration",
              },
            ],
            cacheRoots: observation.cacheRoots,
            afterSequences: cursor,
            requiredWriterPids,
          },
          async () => {
            const result = E2eProcessTrace.spawnSync(
              binary,
              [
                "fix",
                "--cwd",
                directory,
                "--tsconfig",
                "tsconfig.json",
                "--plugins-json",
                JSON.stringify([
                  { name: "@ttsc/lint", config: { configFile: name } },
                ]),
              ],
              {
                cwd: directory,
                encoding: "utf8",
                env: process.env,
                maxBuffer: 64 * 1024 * 1024,
              },
            );
            if (Number.isSafeInteger(result.pid) && result.pid > 0)
              requiredWriterPids.push(result.pid);
            return result;
          },
        );
        phases.push(phase);
        if (phase.traces) cursor = phase.traces.lastWriterSequences;
        assert.equal(phase.outcome.returned, true);
        if (!phase.outcome.returned) throw phase.outcome.error;
        const result = phase.outcome.value;
        if (result.error || result.status === null || result.signal !== null)
          EvidenceProcessOwnership.retain(
            directory,
            new Error(
              "Native fix inputs retained without a normal native exit",
              {
                cause: result.error ?? result.signal,
              },
            ),
          );
        assert.deepEqual(phase.observationErrors, []);
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.equal(result.status, 0, String(result.stderr));
        assert.ok(Number.isSafeInteger(result.pid) && result.pid > 0);
        assert.equal(
          fs.readFileSync(path.join(directory, "loader-main.ts"), "utf8"),
          'const value = "first";\nconst untouched = "untouched";\n',
        );
        assert.ok(phase.traces);
        case_lint_loader_preserves_observed_raw_normalization(
          observation.traceRoot,
          phase.traces,
          {
            writerPid: result.pid,
            location: path.join(directory, name),
            label: name.endsWith(".ts")
              ? "TypeScript config file"
              : "config file",
            evaluations: [
              {
                value: {
                  rules: {
                    "unicorn/string-content": [
                      "error",
                      { patterns: { foo$: "first", foo: "second" } },
                    ],
                  },
                },
                rawDependencies: [],
                normalizedDependencies: [],
                absentRawPaths: [],
                absentNormalizedPaths: [],
                cacheOutcomes: name.endsWith(".ts")
                  ? observation.cacheOutcomes.ts
                  : observation.cacheOutcomes.cjs,
              },
            ],
            fixedOutputs: [
              {
                file: path.join(directory, "loader-main.ts"),
                text: 'const value = "first";\nconst untouched = "untouched";\n',
              },
            ],
          },
        );
      } catch (error) {
        failures.push(new Error(`ordered loader ${name}`, { cause: error }));
      }
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      EvidenceProcessOwnership.assertAvailable(directory);
      const cleanupErrors: unknown[] = [];
      for (const [index, name] of controlled.entries()) {
        const file = path.join(directory, name);
        const saved = previous[index];
        try {
          if (saved === undefined) {
            fs.rmSync(file, { force: true });
            assert.equal(
              fs.lstatSync(file, { throwIfNoEntry: false }),
              undefined,
            );
          } else {
            fs.writeFileSync(file, saved.bytes);
            fs.chmodSync(file, saved.mode);
            assert.deepEqual(fs.readFileSync(file), saved.bytes);
            assert.equal(fs.statSync(file).mode & 0o777, saved.mode);
          }
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (cleanupErrors.length) {
        const error = new AggregateError(
          cleanupErrors,
          "Controlled input restoration",
        );
        EvidenceProcessOwnership.retain(directory, error);
        throw error;
      }
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Executable config pattern precedence");
  return phases;
}
