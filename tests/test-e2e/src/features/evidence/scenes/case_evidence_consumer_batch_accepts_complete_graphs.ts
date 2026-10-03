import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { EvidenceProcessOwnership } from "../../../../../utils/src/evidence/EvidenceProcessOwnership";
import { ConsumerBatch } from "../../../internal/evidence/internal/ConsumerBatch";
import { EvidenceConsumerCorpus } from "../../../internal/evidence/internal/EvidenceConsumerCorpus";
import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
} from "../../../internal/evidence/internal/index";
import { prepareEvidenceFileRuleBatch } from "../../../internal/evidence/internal/prepareFileRuleBatch";
import {
  type INativeCheckResult,
  startNativeCheck,
} from "../../../internal/evidence/internal/startNativeCheck";
import {
  startSwaggerServer,
  stopSwaggerServer,
} from "../../../internal/evidence/internal/swaggerServer";
import { case_evidence_file_rules_share_one_consumer_check } from "./case_evidence_file_rules_share_one_consumer_check";

/**
 * Verifies complete consumer graphs through one installed contributor and exact
 * compiler-option families.
 *
 * The original configuration modules still load their real public exports.
 * Their selected sources and config membership remain separate, while
 * sequential real compiler verdicts connect their options, parser dependencies
 * and citations.
 *
 * 1. Assemble every immutable success scene beneath a disjoint root.
 * 2. Join each old host before switching original compiler options and membership.
 * 3. Load original configs and observe every graph through the native line
 *    protocol.
 * 4. Run all original assertions, collecting independent failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual successful and failing CLI checks typecheck the combined default corpus and preserve opposite exit verdicts; the successful phase fetches the exact HTTP URL. SDK-selected native check-serve responses execute all thirteen original success callbacks under their original compiler overrides and selected configuration modules. JSX and noUnusedLocals scenes own their actual initial native response rather than a repeated request.
 * @evidence contracts/testing.md#independent-expectations Authored citations, source declarations, schema and Swagger inputs establish success independently of the compiler. The original callbacks retain their literal expected verdicts and forbidden findings.
 * @evidence contracts/testing.md#distinguishing-cases Complete graphs, public named/default exports, TSX imports, ancestor roots, installed package accessor paths and declaration-file exclusion retain distinct real consumer inputs. Public typed options transport the independent checklist and strict-policy claims; named graph-rule unit bodies own their literal decisions, hierarchy and zero-host activation contrasts, with current survivor execution still unverified. The error batch owns neighboring frontend failures.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_evidence, which src/index.ts executes and the E2E claim selects; this exported case is selected by the same claim. consumerCases callbacks execute through this entry or the error batch with their original names, inputs and assertion owners. This explanation is execution ownership, not a Review procedure or runtime certificate.
 * @evidence contracts/e2e.md#necessary-boundary Real config loading, public plugin exports, native contributor assembly, serialized options, installed type resolution and Node parser dependencies connect in one real consumer; direct rule calls cannot establish these connections.
 * @evidence contracts/e2e.md#shared-execution Thirteen immutable success scenes, four file-rule scenes, twelve negative phases and HTTP share one workspace and contributor producer. Default positive/negative responses compare actual native PID and cold/full-load telemetry within one host; those observations do not prove the same Program object or total construction count. Default, composed JSX and README noUnusedLocals retain three distinct native host lifetimes and unchanged authored options. Two CLI baselines retain opposite frontend exit verdicts and each singleton consumes its initial real response once. Later responses retain PID/load and freshly resolved producer tuple checks, actual SDK selection, binary hash and isCurrent query. One separate HTTP child serves real requests. Existing monotonic timings are phase waits, not whole-process/Program completeness certification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Local and truly external paths are disjoint; byte-identical installed SDK inputs may share their real package path. Each family's original include patterns control membership and the runtime root stays outside the Program. The old native child is joined before options or membership change; a failed join blocks later families instead of sharing unknown state. The async owner joins native and HTTP children before fixture removal and preserves operation, child-close and removal failures.
 * @evidence contracts/e2e.md#preserved-coverage consumerCases retains all thirteen success and twelve negative callbacks, including their original status and diagnostic checks. Existing untagged packages/evidence/native entries graph_resolves_inline_link_through_namespace_import_test.go, single_evidence_per_symbol_expands_hierarchical_scopes_test.go, reference_policies_stay_independent_across_hierarchical_references_test.go, checklist_keeps_literal_consumer_positive_and_negative_contrasts_test.go, reference_policy_combines_strict_flags_for_positive_and_excluded_hosts_test.go and semantic_graph_{ignores_an_empty_rooted_typescript_claim,derives_no_host_finding_from_an_empty_population}_test.go contain the corresponding namespace, hierarchy, checklist, strict-policy and inactive-host contrasts. The canonical typed-config retains their public type and option transport. The four-case file-rule baseline keeps its scoped diagnostics and typed controls; case_evidence_file_rules_share_one_consumer_check names the exact nine file-rule and seven declaration unit files and their independent negative controls. Those native Test bodies are selected by root test:go ./packages/evidence/... without e2e tags; source existence and selection wiring do not certify current survivor execution, which remains required before further duplicate removal. Each actual zero consumer verdict proves its selected graph succeeded, not all portable unit decisions. Every independent consumer assertion executes before collected failures are thrown. The server must observe actual requests retaining /openapi.json?revision=1 after its child has closed. No synthetic status or diagnostic is supplied.
 */
export async function case_evidence_consumer_batch_accepts_complete_graphs(preparation: { preparedModules?: string; workspaceParent?: string } = {}): Promise<void> {
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
      files: EvidenceConsumerCorpus.read(
        "evidence/evidence_consumer_batch_accepts_complete_graphs/inputs-1",
      ),
      include: ["src/http-members.ts"],
      claims: [
        {
          type: "typescript",
          files: ["src/http-members.ts"],
          reference: { type: "swagger", file: server.url },
        },
      ],
    });
    const negative = prepareEvidenceFileRuleBatch();
    const merge = (
      left: Record<string, string>,
      right: Record<string, string>,
    ): Record<string, string> => {
      for (const [file, content] of Object.entries(right)) {
        assert.ok(
          left[file] === undefined || left[file] === content,
          `Consumer corpora conflict at ${file}`,
        );
      }
      return { ...left, ...right };
    };
    project = createProject({
      ...preparation,
      ...batch,
      files: merge(batch.files, negative.batch.files),
      workspaceFiles: merge(
        batch.workspaceFiles,
        negative.batch.workspaceFiles,
      ),
      name: "consumer-success-batch",
      nativeProducer: "snapshot",
      compilerOptions: { pretty: false },
    });
    const configPath = path.join(project.directory, "tsconfig.json");
    const originalConfig = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      compilerOptions: Record<string, unknown>;
      include: string[];
    };
    const families = ConsumerBatch.compilerFamilies(true);
    for (const [familyIndex, family] of families.entries()) {
      const phases = batch.phases.filter((phase) =>
        family.names.includes(phase.scene.scenario.props.name),
      );
      const visited = new Set<string>();
      let retired = false;
      try {
        EvidenceProcessOwnership.assertAvailable(project.directory);
        fs.writeFileSync(
          configPath,
          JSON.stringify(
            {
              ...originalConfig,
              compilerOptions: {
                ...originalConfig.compilerOptions,
                ...family.compilerOptions,
              },
              include: [
                "src/http-members.ts",
                ...(familyIndex === 0 ? negative.batch.include : []),
                ...phases.flatMap(({ scene }) =>
                  (
                    scene.scenario.props.include ?? ["src", "lint.config.ts"]
                  ).map((pattern) => scene.local + "/" + pattern),
                ),
              ],
            },
            null,
            2,
          ),
          "utf8",
        );
        fs.writeFileSync(
          path.join(project.directory, "lint.config.ts"),
          familyIndex === 0 ? batch.lintConfig : phases[0]!.lintConfig,
          "utf8",
        );
        if (familyIndex === 0) {
          const cliStarted = performance.now();
          const result = runCheck(project.directory);
          console.log(
            "Positive CLI baseline timing " +
              JSON.stringify({ milliseconds: performance.now() - cliStarted }),
          );
          check(() =>
            assertStatus(
              result,
              0,
              "The default compiler family and exact HTTP Swagger URL must pass the real consumer check.",
            ),
          );
          check(() =>
            assertExcludes(
              result,
              "Missing acknowledgement",
              "The URL-backed GET operation must participate in ordinary coverage.",
            ),
          );
        }
        session = startNativeCheck(project.directory);
        console.log(
          "Positive family actual producer " +
            JSON.stringify({
              compilerOptions: family.compilerOptions,
              names: family.names,
              provenance: session.provenance,
              timing: session.preparationTiming,
            }),
        );
        let initial: INativeCheckResult | undefined;
        try {
          initial = await session.observe();
        } catch (error) {
          failures.push(
            new Error("Positive family initial observation failed.", {
              cause: error,
            }),
          );
          if (familyIndex !== 0) throw error;
        }
        if (familyIndex === 0 && initial !== undefined)
          console.log(
            "Positive HTTP baseline actual observation " +
              JSON.stringify({
                status: initial.status,
                telemetry: initial.telemetry,
                registration: initial.registration,
                timing: initial.timing,
              }),
          );
        if (initial !== undefined) {
          const baseline = initial;
          check(() =>
            assertStatus(
              baseline,
              0,
              "Each actual compiler family must preserve its initial successful verdict.",
            ),
          );
          check(() =>
            assert.equal(
              baseline.telemetry.programLoads,
              1,
              "Each compiler family must load one actual native Program.",
            ),
          );
        }
        for (const [phaseIndex, phase] of phases.entries()) {
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
          visited.add(phase.scene.scenario.props.name);
          try {
            EvidenceProcessOwnership.assertAvailable(project.directory);
            const usesInitial = familyIndex !== 0 && phaseIndex === 0;
            if (!usesInitial)
              fs.writeFileSync(
                path.join(project.directory, "lint.config.ts"),
                phase.lintConfig,
                "utf8",
              );
            const config = path.join(project.directory, "lint.config.ts");
            const observed = usesInitial
              ? initial!
              : await session.observe([config], [config]);
            if (initial === undefined) {
              initial = observed;
              phaseCheck(() =>
                assert.equal(
                  observed.telemetry.programLoads,
                  1,
                  label +
                    " must load one real Program after joined retirement.",
                ),
              );
            } else if (observed !== initial) {
              const baseline = initial;
              phaseCheck(() =>
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
              phaseCheck(() =>
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
        if (familyIndex === 0) {
          if (initial === undefined) {
            failures.push(
              new Error(
                "File-rule and negative phases are blocked by missing shared default Program observation.",
              ),
            );
          } else {
            try {
              await case_evidence_file_rules_share_one_consumer_check({
                project,
                session,
                baseline: initial,
                prepared: negative,
              });
            } catch (error) {
              failures.push(
                new Error(
                  "Shared default Program file-rule and negative phases failed.",
                  { cause: error },
                ),
              );
            }
          }
        }
      } catch (error) {
        failures.push(
          new Error(
            "Positive compiler family failed: " +
              JSON.stringify(family.compilerOptions),
            { cause: error },
          ),
        );
        for (const phase of phases)
          if (!visited.has(phase.scene.scenario.props.name))
            failures.push(
              new Error(
                "Positive phase " +
                  phase.scene.scenario.props.name +
                  " is blocked by its compiler family initialization failure.",
                { cause: error },
              ),
            );
      } finally {
        try {
          await session?.close();
          session = undefined;
          retired = true;
        } catch (error) {
          failures.push(error);
        }
      }
      if (!retired) {
        for (const later of families.slice(familyIndex + 1))
          for (const name of later.names)
            failures.push(
              new Error(
                "Positive phase " +
                  name +
                  " is blocked by an unjoined native host.",
              ),
            );
        throw new Error(
          "Remaining compiler families are blocked by an unjoined native host.",
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
