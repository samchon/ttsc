import {
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies a Markdown citation must identify its code module through a path.
 *
 * File links permit Markdown-to-code populations while bare names remain
 * unresolvable. The repair must point to the file-qualified syntax.
 *
 * 1. Configure a Markdown claim over a TypeScript reference.
 * 2. Run the real `ttsc check`.
 * 3. Assert it fails naming the missing module identity and file-link repair.
 */
export const test_evidence_graph_refuses_code_evidence_to_a_document =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "code-evidence-refused",
      lintConfig: [
        'import type { ITtscLintConfig } from "@ttsc/lint";',
        'import { evidence } from "@ttsc/evidence";',
        "",
        "export default {",
        '  plugins: { "evidence": evidence },',
        "  rules: {",
        '    "evidence/graph": ["error", {',
        "      claims: [{",
        '        type: "markdown",',
        '        files: ["docs/**/*.md"],',
        '        symbol: "file",',
        '        reference: { type: "typescript", files: ["src/**/*.ts"] },',
        "      }],",
        "    }],",
        "  },",
        "} satisfies ITtscLintConfig;",
        "",
      ].join("\n"),
      files: {
        "src/sale.ts": "export interface ISale {}\n",
        "docs/spec.md":
          "<!-- @evidence ISale This document relies on the sale contract. -->\n",
      },
    });
    try {
      const result = runCheck(project.directory);
      assertFailure(
        result,
        "A bare code symbol in Markdown must not satisfy coverage.",
      );
      assertIncludes(
        result,
        "unqualified symbol has no module identity",
        "The diagnostic must explain why the target cannot resolve.",
      );
      assertIncludes(
        result,
        "@link",
        "The diagnostic must name the repair rather than only the refusal.",
      );
    } finally {
      project.cleanup();
    }
  };
