import fs from "node:fs";
import path from "node:path";

import {
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
  withEvidenceProject,
} from "../internal/index";

/**
 * Verifies file-qualified citations reach local and external code through ttsc.
 *
 * The public config must admit rooted references, and the real contributor must
 * resolve Markdown and TypeScript hosts without citation-only imports.
 *
 * 1. Configure both host kinds against a tagged-free sibling implementation.
 * 2. Build successfully through the real compiler and typed lint config.
 * 3. Rename the cited member and assert both citations fail to resolve.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks Markdown and TypeScript file-qualified links into sibling api/example.ts, renames Namespace.property and requires both citing files in the failure.
 * @evidence contracts/testing.md#independent-expectations The authored execute, Target and Namespace names and renamed member independently determine which target becomes unreachable.
 * @evidence contracts/testing.md#distinguishing-cases An initially complete graph becomes invalid after only the cited member changes; both host kinds must be diagnosed without citation-only imports.
 * @evidence contracts/testing.md#execution-ownership The test_evidence_file_links_resolve_from_markdown_and_typescript export is discovered by test-evidence src/index.ts under src/features and selected as a function by tests/test-scripts-e2e/evidence.config.json. This E2E entry runs the real ttsc check against its linked consumer and owns the assertions in this function; helper callbacks run through this entry and are reviewed with its body rather than selected as independent cases.
 * @evidence contracts/e2e.md#necessary-boundary Two actual checks observe rooted external-source discovery and diagnostic transport through the packaged contributor; portable link resolution remains a direct-unit candidate.
 * @evidence contracts/e2e.md#shared-execution Both checks share one linked consumer and suite compiler cache; distinct processes currently reload the source rather than a shared resident session. The explicitly selected authored lint snapshot is the same producer used by the file-rule batch; changed fixture inputs do not copy or rebuild that package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The sibling source is fixture-workspace owned and mutated only between completed children; finally invokes strict fixture cleanup. withEvidenceProject invokes cleanup after every operation, preserving a single thrown value unchanged or both operation and removal failures in AggregateError.
 * @evidence contracts/e2e.md#preserved-coverage Initial success, renamed-member failure, diagnostic category and both host-file names remain here; exact per-host finding counts are not asserted.
 */
export const test_evidence_file_links_resolve_from_markdown_and_typescript =
  (): void => {
    const project = createProject({
      nativeProducer: "snapshot",
      name: "file-links",
      compilerOptions: { noUnusedLocals: true },
      lintConfig: `import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";
export default { plugins: { evidence }, rules: { "evidence/graph": ["error", { claims: [
{ type: "markdown", files: ["docs/review.md"], symbol: "h2", reference: { type: "typescript", root: "../api", files: ["*.ts"], symbol: ["function", "property"] } },
{ type: "typescript", files: ["src/review.ts"], symbol: "type", reference: { type: "typescript", root: "../api", files: ["*.ts"], symbol: ["function", "property"] } }
] }] } } satisfies ITtscLintConfig;
`,
      workspaceFiles: {
        "api/example.ts":
          "export function execute(): void {}\nexport class Target { static property = 1; }\nexport namespace Namespace { export const property = true; }\n",
      },
      files: {
        "docs/review.md":
          "## Review\n<!--\n@link ../../api/example.ts#execute Reviews the operation.\n@link ../../api/example.ts#Target Reviews the class.\n@link ../../api/example.ts#Namespace.property Reviews the flag.\n-->\n",
        "src/review.ts":
          "/**\n * @link ../../api/example.ts#execute Reviews the operation.\n * @link ../../api/example.ts#Target.property Reviews the field.\n * @link ../../api/example.ts#Namespace.property Reviews the flag.\n */\nexport interface Review {}\n",
      },
    });
    withEvidenceProject(project, () => {
      assertStatus(
        runCheck(project.directory),
        0,
        "Both file-qualified host forms must compile without imports.",
      );
      fs.writeFileSync(
        path.join(project.workspace, "api/example.ts"),
        "export function execute(): void {}\nexport class Target { static property = 1; }\nexport namespace Namespace { export const renamed = true; }\n",
      );
      const result = runCheck(project.directory);
      assertFailure(result, "A renamed target must fail the compiler check.");
      assertIncludes(
        result,
        "Missing TypeScript evidence member",
        "A renamed namespace property must invalidate both citations.",
      );
      assertIncludes(
        result,
        "docs/review.md",
        "The Markdown citation must be diagnosed.",
      );
      assertIncludes(
        result,
        "src/review.ts",
        "The TypeScript citation must be diagnosed.",
      );
    });
  };
