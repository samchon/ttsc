import fs from "node:fs";
import path from "node:path";

import {
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  startWatch,
} from "../internal/index";
import { FIRST_BUILD_TIMEOUT } from "../internal/startWatch";

/**
 * Verifies watch revalidates code links when only an external source changes.
 *
 * The target is absent from the Program, so no TypeScript compiler watcher can
 * substitute for the contributor's declared external input topology.
 *
 * 1. Start a passing Markdown-to-code project in watch mode.
 * 2. Rename and delete its external target and assert failing rebuilds.
 * 3. Restore the target and verify recovery without editing the Program.
 */
export const test_evidence_watch_revalidates_external_code_links =
  async (): Promise<void> => {
    const project = createProject({
      name: "watch-code-links",
      lintConfig: `import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";
export default { plugins: { evidence }, rules: { "evidence/graph": ["error", { claims: [{ type: "markdown", files: ["review.md"], symbol: "h2", reference: { type: "typescript", root: "../api", files: ["*.ts"], symbol: "property" } }] }] } } satisfies ITtscLintConfig;
`,
      workspaceFiles: { "api/example.ts": "export const value = 1;\n" },
      files: {
        "src/project.ts": "export {};\n",
        "review.md":
          "## Review\n<!-- @link ../api/example.ts#value Reviews the value. -->\n",
      },
    });
    const session = startWatch(project.directory);
    const target = path.join(project.workspace, "api/example.ts");
    try {
      assertStatus(
        await session.nextBuild(FIRST_BUILD_TIMEOUT),
        0,
        "The initial external citation must pass.",
      );
      fs.writeFileSync(target, "export const renamed = 1;\n");
      const renamed = await session.nextBuild();
      assertFailure(renamed, "Renaming the external export must fail watch.");
      assertIncludes(
        renamed,
        "Missing TypeScript evidence export",
        "An external rename must invalidate the citation.",
      );
      fs.unlinkSync(target);
      const deleted = await session.nextBuild();
      assertFailure(deleted, "Deleting the external source must fail watch.");
      assertIncludes(
        deleted,
        "Missing TypeScript evidence file",
        "Deleting the source must remain observable.",
      );
      fs.writeFileSync(target, "export const value = 2;\n");
      assertStatus(
        await session.nextBuild(),
        0,
        "Restoring an external file must recover the watch graph.",
      );
    } finally {
      await session.close();
      project.cleanup();
    }
  };
