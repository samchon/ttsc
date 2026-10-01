import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  assertStatus,
  runCheck,
} from "../../../internal/evidence/internal/index";
import { TransitionProject } from "../../../internal/evidence/internal/TransitionProject";

/**
 * Verifies repeated checks rebuild Markdown and TypeScript evidence
 * inventories.
 *
 * The linked lint binary is cached, but artifact inventories must not be.
 * Renaming a Markdown heading, namespace property, or class method between
 * compiler invocations must invalidate the old target and demand the new one.
 *
 * 1. Check a complete graph containing Markdown, namespace, and class targets.
 * 2. Rename each source target and assert the next check sees stale citations.
 * 3. Update the citations and assert both graph directions become complete.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks a complete graph, renames Alpha to Beta, repairs citation, renames Api.state/Service.run, then repairs those links across five checks.
 * @evidence contracts/testing.md#independent-expectations Authored old/new headings and member names independently establish stale target and newly owed-unit diagnostics.
 * @evidence contracts/testing.md#distinguishing-cases Each mutation is followed by failure and then recovery; both Markdown and TypeScript inventory changes are observed under shared contributor artifact caching.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_evidence, which is discovered under src/features and selected by tests/test-e2e/evidence.config.json; this scenario is an exported case function selected by the same claim and runs the real ttsc check against the shared linked consumer.
 * @evidence contracts/e2e.md#necessary-boundary Five real native checks observe input reload and diagnostics, while inventory refresh computations have portable owners and no single resident lifetime is exercised here.
 * @evidence contracts/e2e.md#shared-execution Runs in the experiment's single linked consumer and native cache. Five fresh hosts remain because each transition must be observed by a new compiler invocation, which is the invalidation behavior asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only fixture sources and docs mutate between completed child calls, from the static baseline installed on entry; the experiment releases the consumer only after the last of its four scenarios, so old-to-new history lasts until then.
 * @evidence contracts/e2e.md#preserved-coverage All three successes and four exact stale/current-target message assertions remain here.
 */
export function case_evidence_graph_refreshes_changed_sources(
  project: ITtscEvidenceProject,
): void {
  const { "lint.config.ts": lintConfig, ...files } = FixtureFiles.read(
    "evidence/transitions/source-refresh",
  );
  TransitionProject.enter(project, { lintConfig: lintConfig!, files });
  const write = (relative: string, content: string): void => {
    fs.writeFileSync(path.join(project.directory, relative), content, "utf8");
  };
  assertStatus(
    runCheck(project.directory),
    0,
    "The initial graph must prove the fixture can pass before freshness is tested.",
  );

  write("docs/spec.md", "## Beta\n");
  const staleMarkdown = runCheck(project.directory);
  assertFailure(
    staleMarkdown,
    "A renamed Markdown heading must invalidate its old citation on the next check.",
  );
  assertIncludes(
    staleMarkdown,
    "Unresolved evidence target 'docs/spec.md#alpha'",
    "The second check must not retain the first Markdown inventory.",
  );
  assertIncludes(
    staleMarkdown,
    "Missing acknowledgement for 'docs/spec.md#beta'",
    "The renamed Markdown unit must become the current obligation.",
  );

  write("src/implementation.ts", files["src/implementation.ts"]!.replace("#alpha", "#beta"));
  assertStatus(
    runCheck(project.directory),
    0,
    "Updating the Markdown citation must restore the graph.",
  );

  write(
    "src/contracts.ts",
    files["src/contracts.ts"]!.replace("state", "status").replace("run()", "execute()"),
  );
  const staleTypeScript = runCheck(project.directory);
  assertFailure(
    staleTypeScript,
    "Renamed namespace and class members must invalidate old TypeScript targets.",
  );
  assertIncludes(
    staleTypeScript,
    "Unreachable evidence target '{@link Api.state}'",
    "The next Program must replace the old namespace property inventory.",
  );
  assertIncludes(
    staleTypeScript,
    "Missing acknowledgement for 'Service.prototype.execute'",
    "The renamed class method must become a current callable obligation.",
  );

  write(
    "src/ledger.ts",
    files["src/ledger.ts"]!
      .replace("Api.state", "Api.status")
      .replace("Service.prototype.run", "Service.prototype.execute"),
  );
  assertStatus(
    runCheck(project.directory),
    0,
    "Updating the TypeScript citations must restore the refreshed graph.",
  );
}
