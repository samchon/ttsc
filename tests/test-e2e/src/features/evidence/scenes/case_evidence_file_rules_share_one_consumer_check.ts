import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { EvidenceProcessOwnership } from "../../../../../utils/src/evidence/EvidenceProcessOwnership";
import { ConsumerBatch } from "../../../internal/evidence/internal/ConsumerBatch";
import {
  assertExcludes,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
} from "../../../internal/evidence/internal/index";
import { prepareEvidenceFileRuleBatch } from "../../../internal/evidence/internal/prepareFileRuleBatch";
import {
  type INativeCheckResult,
  startNativeCheck,
} from "../../../internal/evidence/internal/startNativeCheck";

/**
 * Verifies file rules and twelve negative consumer phases in one resident
 * consumer.
 *
 * Portable declaration semantics run through seven actual graph-rule Go units,
 * including imported namespace ancestors and independent uncited controls. Here
 * scoped config entries preserve each file-rule fixture's options and file
 * scope while one installed contributor and sequential native requests prove
 * registration, JSON option transport, exit status and source-anchored
 * diagnostic rendering for the whole batch.
 *
 * 1. Materialize all unchanged fixtures under isolated source subdirectories.
 * 2. Check the shared project once with all authored scoped rule settings.
 * 3. Compile both optionless typing controls and all typed config entries.
 * 4. Assert every original diagnostic and every clean fixture's silence.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual CLI baseline asserts the retained documented symbol:type options, src/parse.ts diagnostic rendering, clean-prefix silence and both optionless typed controls. SDK-selected native check-serve responses then select twelve original negative configurations and execute their literal callbacks.
 * @evidence contracts/testing.md#independent-expectations Literal original rule messages and explicitly authored source/citation identities supply the expected findings; the original typed expect-error configurations distinguish accepted from rejected option contracts.
 * @evidence contracts/testing.md#distinguishing-cases Documented narrowed selection and empty JSDoc rendering, plus singular/review optionless typing contracts retain their separate real connection assertions. Nine direct rule units own the original merged/first-declaration/missing-doc/singular/review/todo decisions and independent negative contrasts. Declaration shape, first-address identity and type-only export-space contrasts execute in their actual graph-rule unit owners.
 * @evidence contracts/testing.md#execution-ownership Called by the default family of case_evidence_consumer_batch_accepts_complete_graphs within test_e2e_evidence, which is discovered under src/features and selected by tests/test-e2e/evidence.config.json; this scenario is an exported case function selected by the same claim and runs the real ttsc check against its linked consumer and owns the assertions in this function; helper callbacks run through this entry and are reviewed with its body rather than selected as independent cases.
 * @evidence contracts/e2e.md#necessary-boundary The published Evidence entry, lint descriptor, native contributor link, serialized options, real compiler/typechecking and source-anchored diagnostic rendering connect here; direct rule calls cannot prove those connections.
 * @evidence contracts/e2e.md#shared-execution The combined default positive consumer and its actual native Program serve this CLI baseline and all negative phases. The caller passes its session and prior actual observation; the boundary compares PID and Program load count before the original negative phases. Direct scratch invocation may still own a private consumer, but the discoverable experiment never selects that path. Every phase freshly resolves the SDK registration and compares actual executable bytes, manifest and project context; PID/load assertions expose incompatible retirement. Only one original graph and its file-rule scope are active per response, so aliases and Prisma populations cannot merge. No fixture change recopies or rebuilds the authored lint package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every scene's files and selected config modules are materialized before the initial fixed Program loads. Only the existing excluded runtime root changes between graph phases; all original include patterns remain in the fixed corpus and no scope is created mid-session. Distinct local/external roots preserve selection. The combined outer caller joins the shared native child before strict fixture removal; this borrowed-session path closes neither the child nor its fixture. A direct standalone caller retains its own joined cleanup and collects those failures.
 * @evidence contracts/e2e.md#preserved-coverage The four retained boundary cases preserve their original includes/excludes, public typed options and expect-error contracts. Nine packages/evidence/native semantic units preserve all original file-rule literal sources and includes/excludes; selected/default and singular added-second negatives run independently. Seven duplicate semantic populations were removed from this Program; src/parse.ts rendering remains asserted here because message-only units cannot establish its frontend source address. Callable, destructured, ambient, accessor, imported type-only namespace, merged-first-declaration and type-only-barrel semantics execute in seven packages/evidence/native units. Their original literals, five uncited controls, citation-removal and import/value-export negatives run independently in those direct graph-rule owners. Public typed config and real compiler/CLI transport remain in this consumer; these units certify neither process status nor compiler artifact freshness. The batch's nonzero status preserves each negative fixture's failure; assertions accumulate so one failure does not hide later checks.
 */
export async function case_evidence_file_rules_share_one_consumer_check(shared?: {
  project: ReturnType<typeof createProject>;
  session: ReturnType<typeof startNativeCheck>;
  baseline: INativeCheckResult;
  prepared: ReturnType<typeof prepareEvidenceFileRuleBatch>;
}): Promise<void> {
  const { batch, cases, typedConfigurations } =
    shared?.prepared ?? prepareEvidenceFileRuleBatch();
  const project =
    shared?.project ??
    createProject({
      ...batch,
      nativeProducer: "snapshot",
      name: "consumer-errors-batch",
      compilerOptions: { pretty: false },
    });
  const failures: unknown[] = [];
  const visited = new Set<string>();
  let session: ReturnType<typeof startNativeCheck> | undefined =
    shared?.session;
  try {
    fs.writeFileSync(
      path.join(project.directory, "lint.config.ts"),
      batch.lintConfig,
      "utf8",
    );
    const cliStarted = performance.now();
    const result = runCheck(project.directory);
    console.log(
      "Negative CLI baseline timing " +
        JSON.stringify({ milliseconds: performance.now() - cliStarted }),
    );
    const verify = (assertion: () => void): void => {
      try {
        assertion();
      } catch (error) {
        failures.push(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    };
    verify(() =>
      assertStatus(
        result,
        2,
        "The batch's negative fixtures must fail the consumer check.",
      ),
    );
    for (const config of typedConfigurations)
      verify(() =>
        assertExcludes(
          result,
          config,
          "Every typed configuration must compile without diagnostics, including both expect-error controls.",
        ),
      );
    const output = result.output
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replaceAll("\\", "/");
    const diagnostics = output.split(
      /(?=^(?:[^\r\n]*(?:\(\d+,\d+\):|:\d+:\d+\s+-)\s*)?(?:error|warning)\s+TS\d+:)/m,
    );
    for (const scenario of cases) {
      const prefix = "src/" + scenario.name + "/";
      const selected = diagnostics.filter((diagnostic) =>
        diagnostic.split(/\r?\n/, 1)[0]!.includes(prefix),
      );
      const scoped = { ...result, output: selected.join("\n") };
      if (scenario.passes)
        verify(() =>
          assertExcludes(
            result,
            prefix,
            "A clean fixture must remain free of compiler and rule diagnostics.",
          ),
        );
      else if (selected.length === 0)
        failures.push(
          new Error(
            "No source-anchored diagnostic for " +
              scenario.name +
              "\n" +
              output,
          ),
        );
      if (
        !scenario.passes &&
        selected.length !== 0 &&
        !selected.some((diagnostic) =>
          /(?:\):\s*|\s+-\s+)error\s+/i.test(diagnostic.split(/\r?\n/, 1)[0]!),
        )
      )
        failures.push(
          new Error(
            "The negative fixture must contribute an error of its own: " +
              scenario.name +
              "\n" +
              scoped.output,
          ),
        );
      for (const expected of scenario.includes)
        verify(() =>
          assertIncludes(
            scoped,
            expected,
            "The original fixture's consumer diagnostic must survive batching.",
          ),
        );
      for (const unexpected of scenario.excludes)
        verify(() =>
          assertExcludes(
            scoped,
            unexpected,
            "The original fixture's negative assertion must survive batching.",
          ),
        );
    }
    session ??= startNativeCheck(project.directory);
    console.log(
      "Negative batch actual producer " +
        JSON.stringify({
          provenance: session.provenance,
          timing: session.preparationTiming,
        }),
    );
    let initial: INativeCheckResult | undefined;
    try {
      const config = path.join(project.directory, "lint.config.ts");
      initial = await session.observe(
        shared === undefined ? undefined : [config],
        shared === undefined ? undefined : [config],
      );
      if (shared !== undefined) {
        const baseline = initial;
        verify(() =>
          assert.equal(
            baseline.telemetry.pid,
            shared.baseline.telemetry.pid,
            "Negative baseline retains the positive native PID",
          ),
        );
        verify(() =>
          assert.equal(
            baseline.telemetry.programLoads,
            shared.baseline.telemetry.programLoads,
            "Negative baseline retains the positive Program load count",
          ),
        );
      }
    } catch (error) {
      failures.push(
        new Error("Negative canonical initial observation failed.", {
          cause: error,
        }),
      );
    }
    if (initial !== undefined) {
      const baseline = initial;
      console.log(
        "Negative canonical baseline actual observation " +
          JSON.stringify({
            status: baseline.status,
            telemetry: baseline.telemetry,
            registration: baseline.registration,
            timing: baseline.timing,
          }),
      );
      verify(() =>
        assertStatus(
          baseline,
          2,
          "The actual SDK-selected native contributor must preserve the canonical failure verdict.",
        ),
      );
      verify(() =>
        assert.equal(
          baseline.telemetry.programLoads,
          1,
          "The canonical baseline must load one actual native Program.",
        ),
      );
    }
    for (const phase of batch.phases) {
      const label = "Negative phase " + phase.scene.scenario.props.name;
      const phaseVerify = (assertion: () => void): void => {
        try {
          assertion();
        } catch (error) {
          failures.push(
            new Error(label + " assertion failed.", { cause: error }),
          );
        }
      };
      visited.add(phase.scene.scenario.props.name);
      try {
        EvidenceProcessOwnership.assertAvailable(project.directory);
        fs.writeFileSync(
          path.join(project.directory, "lint.config.ts"),
          phase.lintConfig,
          "utf8",
        );
        const config = path.join(project.directory, "lint.config.ts");
        const observed = await session.observe([config], [config]);
        if (initial === undefined) {
          initial = observed;
          phaseVerify(() =>
            assert.equal(
              observed.telemetry.programLoads,
              1,
              label + " must load one real Program after joined retirement.",
            ),
          );
        } else {
          const baseline = initial;
          phaseVerify(() =>
            assert.deepEqual(
              {
                pid: observed.telemetry.pid,
                programLoads: observed.telemetry.programLoads,
              },
              {
                pid: baseline.telemetry.pid,
                programLoads: baseline.telemetry.programLoads,
              },
              label +
                " must retain its actual native PID and Program load count.",
            ),
          );
          phaseVerify(() =>
            assert.deepEqual(
              {
                binary: observed.registration.binary,
                binaryDigest: observed.registration.binaryDigest,
                manifest: observed.registration.manifest,
                projectContext: observed.registration.projectContext,
              },
              {
                binary: baseline.registration.binary,
                binaryDigest: baseline.registration.binaryDigest,
                manifest: baseline.registration.manifest,
                projectContext: baseline.registration.projectContext,
              },
              label +
                " must retain its freshly resolved actual producer tuple.",
            ),
          );
        }
        console.log(
          label +
            " actual observation " +
            JSON.stringify({
              status: observed.status,
              telemetry: observed.telemetry,
              registration: observed.registration,
              timing: observed.timing,
            }),
        );
        phaseVerify(() =>
          assertStatus(
            observed,
            2,
            "The authored negative scene must retain its actual compiler verdict.",
          ),
        );
        ConsumerBatch.verify(observed, [phase.scene], phaseVerify);
      } catch (error) {
        failures.push(
          new Error(label + " could not be observed.", { cause: error }),
        );
      }
    }
  } catch (error) {
    failures.push(error);
    for (const phase of batch.phases)
      if (!visited.has(phase.scene.scenario.props.name))
        failures.push(
          new Error(
            "Negative phase " +
              phase.scene.scenario.props.name +
              " is blocked by batch initialization failure.",
            { cause: error },
          ),
        );
  } finally {
    try {
      if (shared === undefined) await session?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      if (shared === undefined) project.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Batched consumer observations and release failed.",
    );
}
