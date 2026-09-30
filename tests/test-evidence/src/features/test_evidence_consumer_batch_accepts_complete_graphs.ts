import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ConsumerBatch } from "../internal/ConsumerBatch";
import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";
import { startNativeCheck } from "../internal/startNativeCheck";
import {
  startSwaggerServer,
  stopSwaggerServer,
} from "../internal/swaggerServer";

/**
 * Verifies complete consumer graphs through one installed contributor and
 * resident compiler.
 *
 * The original configuration modules still load their real public exports.
 * Their selected sources and config membership remain separate, while
 * sequential real compiler verdicts connect their options, parser dependencies
 * and citations.
 *
 * 1. Assemble every immutable success scene beneath a disjoint root.
 * 2. Load original config exports and observe each graph through the actual native
 *    line protocol.
 * 3. Run all original assertions, collecting independent failures.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual CLI check typechecks the fixed source corpus and fetches the exact HTTP URL. SDK-selected native check-serve responses then execute all twenty original success callbacks, including the configuration modules their original include lists selected.
 * @evidence contracts/testing.md#independent-expectations Authored citations, source declarations, schema and Swagger inputs establish success independently of the compiler. The original callbacks retain their literal expected verdicts and forbidden findings.
 * @evidence contracts/testing.md#distinguishing-cases Complete and zero-host inactive graphs, public named/default exports, TSX imports, ancestor roots, installed package accessor paths, Markdown checklists, strict policy and declaration-file exclusion retain distinct inputs. The error batch owns neighboring failures.
 * @evidence contracts/testing.md#execution-ownership This matching named features export is executed by test-evidence src/index.ts and selected by the central E2E function claim. consumerCases callbacks execute only through this entry or the error batch and are reviewed with their actual runner owner.
 * @evidence contracts/e2e.md#necessary-boundary Real config loading, public plugin exports, native contributor assembly, serialized options, installed type resolution and Node parser dependencies connect in one real consumer; direct rule calls cannot establish these connections.
 * @evidence contracts/e2e.md#shared-execution Twenty immutable success scenes and the HTTP operation share one workspace and contributor producer. One actual CLI baseline owns frontend/exit-code transport; one native check-serve lifetime owns fixed-option graph phases, with PID/load assertions exposing retirement. Every phase freshly resolves the actual SDK registration and compares its complete tuple and executable bytes. The necessary separate HTTP child serves real requests. jsx preserve and noUnusedLocals retain the TSX and README import inputs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Local and truly external paths are disjoint; byte-identical installed SDK inputs may share their real package path. Original include lists control config membership, and the runtime root stays outside the Program. The async owner joins both native and HTTP children before fixture removal, collects independent assertions and preserves operation, child-close and removal failures.
 * @evidence contracts/e2e.md#preserved-coverage consumerCases retains each original success callback, including zero status and all absence checks; each actual zero verdict proves its original graph succeeded while the selected sources remain loaded. Every independent assertion executes before collected failures are thrown. The server must observe actual requests retaining /openapi.json?revision=1 after its child has closed. No synthetic status or diagnostic is supplied.
 */
export async function test_evidence_consumer_batch_accepts_complete_graphs(): Promise<void> {
  const server = await startSwaggerServer();
  const failures: unknown[] = [];
  const check = (assertion: () => void): void => {
    try {
      assertion();
    } catch (error) {
      failures.push(error);
    }
  };
  let project: ITtscEvidenceProject | undefined;
  let session: ReturnType<typeof startNativeCheck> | undefined;
  try {
    const batch = ConsumerBatch.assemble(true, {
      files: {
        "src/http-members.ts":
          "/** @evidence GET:/members/{id} Reads a member through the remote API contract. */\nexport interface IMemberReader {}\n",
      },
      include: ["src/http-members.ts"],
      claims: [
        {
          type: "typescript",
          files: ["src/http-members.ts"],
          reference: { type: "swagger", file: server.url },
        },
      ],
    });
    project = createProject({
      ...batch,
      name: "consumer-success-batch",
      nativeProducer: "snapshot",
      compilerOptions: { pretty: false, jsx: "preserve", noUnusedLocals: true },
    });
    const result = runCheck(project.directory);
    check(() =>
      assertStatus(
        result,
        0,
        "All complete scenes and the exact HTTP Swagger URL must pass the same real consumer check.",
      ),
    );
    check(() =>
      assertExcludes(
        result,
        "Missing acknowledgement",
        "The URL-backed GET operation must participate in ordinary coverage.",
      ),
    );
    session = startNativeCheck(project.directory);
    console.log("Positive batch actual producer " + JSON.stringify(session.provenance));
    const initial = await session.observe();
    check(() =>
      assertStatus(
        initial,
        0,
        "The actual SDK-selected native contributor must preserve the HTTP success verdict.",
      ),
    );
    check(() =>
      assert.equal(
        initial.telemetry.programLoads,
        1,
        "The HTTP baseline must load one actual native Program.",
      ),
    );
    for (const phase of batch.phases) {
      const label = "Positive phase " + phase.scene.scenario.props.name;
      const phaseCheck = (assertion: () => void): void => {
        try {
          assertion();
        } catch (error) {
          failures.push(
            new Error(label + " assertion failed.", { cause: error }),
          );
        }
      };
      try {
        fs.writeFileSync(
          path.join(project.directory, "lint.config.ts"),
          phase.lintConfig,
          "utf8",
        );
        const config = path.join(project.directory, "lint.config.ts");
        const observed = await session.observe([config], [config]);
        phaseCheck(() =>
          assert.deepEqual(
            {
              pid: observed.telemetry.pid,
              programLoads: observed.telemetry.programLoads,
            },
            {
              pid: initial.telemetry.pid,
              programLoads: initial.telemetry.programLoads,
            },
            label +
              " must retain its actual native PID and Program load count.",
          ),
        );
        phaseCheck(() =>
          assert.deepEqual(
            {
              binary: observed.registration.binary,
              binaryDigest: observed.registration.binaryDigest,
              manifest: observed.registration.manifest,
              projectContext: observed.registration.projectContext,
            },
            {
              binary: initial.registration.binary,
              binaryDigest: initial.registration.binaryDigest,
              manifest: initial.registration.manifest,
              projectContext: initial.registration.projectContext,
            },
            label + " must retain its freshly resolved actual producer tuple.",
          ),
        );
        console.log(
          label +
            " actual observation " +
            JSON.stringify({
              status: observed.status,
              telemetry: observed.telemetry,
              registration: observed.registration,
            }),
        );
        phaseCheck(() =>
          assertStatus(
            observed,
            0,
            "The authored complete scene must retain its actual compiler verdict.",
          ),
        );
        ConsumerBatch.verify(observed, [phase.scene], phaseCheck);
      } catch (error) {
        failures.push(
          new Error(label + " could not be observed.", { cause: error }),
        );
      }
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      await session?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      await stopSwaggerServer(server.child);
    } catch (error) {
      failures.push(error);
    }
    check(() =>
      assert.ok(
        server.requests.length > 0,
        "The actual HTTP server must observe a fetch.",
      ),
    );
    check(() =>
      assert.ok(
        server.requests.every((url) => url === "/openapi.json?revision=1"),
        "Every observed request must retain the authored query.",
      ),
    );
    try {
      project?.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Consumer success and release assertions failed.",
    );
}
