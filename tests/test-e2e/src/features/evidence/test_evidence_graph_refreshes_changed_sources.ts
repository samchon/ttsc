import fs from "node:fs";
import path from "node:path";

import {
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
  withEvidenceProject,
} from "../../internal/evidence/internal/index";

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
 * @evidence contracts/testing.md#execution-ownership The test_evidence_graph_refreshes_changed_sources export is discovered by test-e2e src/index.ts under src/features and selected as a function by tests/test-e2e/evidence.config.json. This E2E entry runs the real ttsc check against its linked consumer and owns the assertions in this function; helper callbacks run through this entry and are reviewed with its body rather than selected as independent cases.
 * @evidence contracts/e2e.md#necessary-boundary Five real native checks observe input reload and diagnostics, while inventory refresh computations have portable owners and no single resident lifetime is exercised here.
 * @evidence contracts/e2e.md#shared-execution All checks share one linked fixture/native cache, but start five fresh hosts; a resident batch requires verified equivalence rather than relabeling this transition. The explicitly selected authored lint snapshot is the same producer used by the file-rule batch; changed fixture inputs do not copy or rebuild that package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only fixture sources/docs mutate between completed child calls; the same workspace preserves exact old-to-new history until finally cleanup. withEvidenceProject invokes cleanup after every operation, preserving a single thrown value unchanged or both operation and removal failures in AggregateError.
 * @evidence contracts/e2e.md#preserved-coverage All three successes and four exact stale/current-target message assertions remain here; no assertion is discarded to reduce host count.
 */
export const test_evidence_graph_refreshes_changed_sources = (): void => {
  const project: ITtscEvidenceProject = createProject({
    nativeProducer: "snapshot",
    name: "source-refresh",
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
      '          files: ["src/implementation.ts"],',
      '          symbol: "type",',
      '          reference: { type: "markdown", files: ["docs/spec.md"], symbol: "h2" },',
      "        },",
      "        {",
      '          type: "typescript",',
      '          files: ["src/ledger.ts"],',
      '          symbol: "type",',
      '          reference: { type: "typescript", files: ["src/contracts.ts"], symbol: ["function", "property"] },',
      "        },",
      "      ],",
      "    }],",
      "  },",
      "};",
      "",
    ].join("\n"),
    files: {
      "docs/spec.md": "## Alpha\n",
      "src/implementation.ts": implementationFor("alpha"),
      "src/contracts.ts": contractsFor("state", "run"),
      "src/ledger.ts": ledgerFor("state", "run"),
    },
  });
  withEvidenceProject(project, () => {
    assertStatus(
      runCheck(project.directory),
      0,
      "The initial graph must prove the fixture can pass before freshness is tested.",
    );

    write(project, "docs/spec.md", "## Beta\n");
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

    write(project, "src/implementation.ts", implementationFor("beta"));
    assertStatus(
      runCheck(project.directory),
      0,
      "Updating the Markdown citation must restore the graph.",
    );

    write(project, "src/contracts.ts", contractsFor("status", "execute"));
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

    write(project, "src/ledger.ts", ledgerFor("status", "execute"));
    assertStatus(
      runCheck(project.directory),
      0,
      "Updating the TypeScript citations must restore the refreshed graph.",
    );
  });
};

const implementationFor = (anchor: string): string =>
  [
    `/** @evidence docs/spec.md#${anchor} Implements the current specification section. */`,
    "export interface Implementation {}",
    "",
  ].join("\n");

const contractsFor = (property: string, method: string): string =>
  [
    "export namespace Api {",
    `  export const ${property} = "ready";`,
    "}",
    "",
    "export class Service {",
    `  ${method}(): void {}`,
    "}",
    "",
  ].join("\n");

const ledgerFor = (property: string, method: string): string =>
  [
    `import type { Api, Service } from "./contracts.js";`,
    "",
    "/**",
    ` * @evidence {@link Api.${property}} Documents the current namespace state.`,
    ` * @evidence {@link Service.prototype.${method}} Documents the current class operation.`,
    " */",
    "export interface ILedger {}",
    "",
  ].join("\n");

const write = (
  project: ITtscEvidenceProject,
  relative: string,
  content: string,
): void => {
  fs.writeFileSync(path.join(project.directory, relative), content, "utf8");
};
