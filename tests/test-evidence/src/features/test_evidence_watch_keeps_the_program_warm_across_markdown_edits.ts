import fs from "node:fs";
import path from "node:path";

import { EvidenceProcessOwnership } from "../internal/EvidenceProcessOwnership";
import {
  FIRST_BUILD_TIMEOUT,
  type IRunResult,
  type ITtscEvidenceProject,
  assertIncludes,
  assertStatus,
  createProject,
  startWatch,
} from "../internal/index";

/**
 * Verifies refreshed graph findings and unchanged resident PID and Program-load count
 * across a declared external change.
 *
 * Freshness and residency are separate properties, and only one of them is
 * visible in a diagnostic. A host that answered every Markdown edit by dropping
 * its Program would pass every other watch case in this suite while making
 * watch mode cost a cold compile per keystroke — the regression would show up
 * as a complaint about speed, months later, with nothing to point at.
 *
 * What makes this the plugin's business rather than the host's is the kind it
 * declares. The resident check keeps its Program only for a changed path it can
 * recognize as a declared data input; anything else is read as a change in the
 * selected compiler topology and drops the Program. So a document declared with
 * the wrong kind, or reported through some channel other than this contract,
 * would still be fresh here and would silently stop being resident.
 *
 * 1. Watch a project with `--diagnostics`, so each rebuild reports its Program
 *    PID and cumulative Program-load count.
 * 2. Edit only the declared Markdown document.
 * 3. Require the actual failed rebuild and stale target, then compare both PID
 *    and cumulative count so a restarted process cannot pass with the same count.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs diagnostics-enabled watch, renames Alpha to Beta and requires stale alpha output with unchanged parsed PID and cumulative programLoads.
 * @evidence contracts/testing.md#independent-expectations The authored rename independently requires refreshed findings; before/after telemetry equality is a relational oracle, not a literal performance threshold.
 * @evidence contracts/testing.md#distinguishing-cases Initial status0 and telemetry must exist; the renamed heading requires actual status2 and stale alpha text. Refreshed PID and cumulative count must both match, distinguishing process restart from unchanged resident state.
 * @evidence contracts/testing.md#execution-ownership The test_evidence_watch_keeps_the_program_warm_across_markdown_edits export is discovered by test-evidence src/index.ts under src/features and selected as a function by tests/e2e/evidence.config.json. This E2E entry starts the real ttsc watch child and owns its filesystem edits and cycle assertions; helper callbacks run through this entry and are reviewed with its body rather than selected as independent cases.
 * @evidence contracts/e2e.md#necessary-boundary Actual watcher input kind and resident native Program reuse require telemetry from the real check-serve connection.
 * @evidence contracts/e2e.md#shared-execution One project/host and contributor cache serve both cycles, sharing unchanged compiler topology while only Markdown changes. The explicitly selected authored lint snapshot is the same producer used by the file-rule batch; changed fixture inputs do not copy or rebuild that package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Document mutation follows the initial build. createProject independently releases partial preparation before returning; body, close and fixture-cleanup failures are collected independently, every available cleanup is attempted, and one error is rethrown unchanged or multiple errors are preserved in AggregateError.
 * @evidence contracts/e2e.md#preserved-coverage Original initial0, renamed status2, stale-target, telemetry presence and PID/count equality assertions remain here. positiveWatchCases.markdown also retains those assertions in its shared Alpha phase; this original stays executable until actual equivalent batch proof.
 */
export const test_evidence_watch_keeps_the_program_warm_across_markdown_edits =
  async (): Promise<void> => {
    const project: ITtscEvidenceProject = createProject({
      nativeProducer: "snapshot",
      name: "watch-resident-program",
      lintConfig: [
        'import evidence from "@ttsc/evidence";',
        "",
        "export default {",
        '  plugins: { "evidence": evidence },',
        "  rules: {",
        '    "evidence/graph": ["error", {',
        "      claims: [",
        "        {",
        '          type: "typescript",',
        '          files: ["src/**/*.ts"],',
        '          symbol: "type",',
        '          reference: { type: "markdown", files: ["docs/**/*.md"], symbol: "h2" },',
        "        },",
        "      ],",
        "    }],",
        "  },",
        "};",
        "",
      ].join("\n"),
      files: {
        "docs/spec.md": "## Alpha\n",
        "src/implementation.ts": [
          "/** @evidence docs/spec.md#alpha Implements the current specification section. */",
          "export interface Implementation {}",
          "",
        ].join("\n"),
      },
    });
    const failures: unknown[] = [];
    let session: ReturnType<typeof startWatch> | undefined;
    try {
      session = startWatch(project.directory, {
        diagnostics: true,
      });
      const first: IRunResult = await session.nextBuild(FIRST_BUILD_TIMEOUT);
      assertStatus(
        first,
        0,
        "The first watch build must pass before residency is measured.",
      );
      const loaded = programLoads(first);
      if (loaded === null)
        throw new Error(
          `The resident check must report its telemetry under --diagnostics, or this case measures nothing.\n\nActual output:\n${first.output}`,
        );

      write(project, "docs/spec.md", "## Beta\n");
      const refreshed: IRunResult = await session.nextBuild();
      assertIncludes(
        refreshed,
        "Unresolved evidence target 'docs/spec.md#alpha'",
        "The rebuild must observe the renamed heading, or residency is being measured on a build that did nothing.",
      );
      assertStatus(refreshed, 2, "The renamed target must produce a failed actual rebuild.");
      const reloaded = programLoads(refreshed);
      if (reloaded === null || loaded === null || reloaded.pid !== loaded.pid || reloaded.loads !== loaded.loads)
        throw new Error(
          `A declared Markdown change must not reload the TypeScript Program.\n\nResidency before: ${JSON.stringify(loaded)}\nResidency after: ${JSON.stringify(reloaded)}\n\nActual output:\n${refreshed.output}`,
        );
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        await session?.close();
      } catch (error) {
        failures.push(error);
      }
      try {
        project.cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "Evidence watch and cleanup failed.");
  };

/**
 * Reads the resident check's cumulative Program load count from one rebuild.
 *
 * `@ttsc/lint` prints this only under `--diagnostics`; the count is cumulative
 * for the life of the resident process. The assertion compares both PID and cumulative count, so a new resident
 * process cannot satisfy the reuse claim merely by reporting the same count.
 */
const programLoads = (result: IRunResult): { pid: number; loads: number } | null => {
  const match: RegExpMatchArray | null = result.output.match(
    /@ttsc\/lint resident check: pid=(\d+) programLoads=(\d+)/,
  );
  return match === null ? null : { pid: Number(match[1]), loads: Number(match[2]) };
};

const write = (
  project: ITtscEvidenceProject,
  relative: string,
  content: string,
): void => {
  EvidenceProcessOwnership.assertAvailable(project.directory);
  fs.writeFileSync(path.join(project.directory, relative), content, "utf8");
};
