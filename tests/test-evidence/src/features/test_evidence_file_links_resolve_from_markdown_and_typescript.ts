import fs from "node:fs";
import path from "node:path";

import {
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
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
 */
export const test_evidence_file_links_resolve_from_markdown_and_typescript =
  (): void => {
    const project = createProject({
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
    try {
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
    } finally {
      project.cleanup();
    }
  };
