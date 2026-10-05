import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TransitionProject } from "../../../internal/evidence/internal/TransitionProject";
import {
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  assertStatus,
  runCheck,
} from "../../../internal/evidence/internal/index";

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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_evidence, which is discovered under src/features and selected by tests/test-e2e/evidence.config.json; this scenario is an exported case function selected by the same claim and runs the real ttsc check against the shared linked consumer.
 * @evidence contracts/e2e.md#necessary-boundary Two actual checks observe rooted external-source discovery and diagnostic transport through the contributor in the linked consumer; this is not packed-publication identity certification. Portable link resolution remains a separate direct-unit contribution.
 * @evidence contracts/e2e.md#shared-execution Runs in the experiment's single linked consumer and native cache; two checks remain because the rename between them must be seen by a fresh compiler invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The sibling api directory is workspace-owned and materialized from its static fixture on entry. Its rename follows the first actual synchronous check result; the next entry resets the sibling directory after this case. Direct returned results do not certify arbitrary descendant shutdown or unchanged compiler objects.
 * @evidence contracts/e2e.md#preserved-coverage Initial success, renamed-member failure, diagnostic category and both host-file names remain here; exact per-host finding counts are not asserted.
 */
export function case_evidence_file_links_resolve_from_markdown_and_typescript(
  project: ITtscEvidenceProject,
): void {
  const { "lint.config.ts": lintConfig, ...files } = FixtureFiles.read(
    "evidence/transitions/file-links/project",
  );
  TransitionProject.enter(project, {
    compilerOptions: { noUnusedLocals: true },
    lintConfig: lintConfig!,
    files,
    workspaceFiles: FixtureFiles.read(
      "evidence/transitions/file-links/workspace",
    ),
  });
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
}
