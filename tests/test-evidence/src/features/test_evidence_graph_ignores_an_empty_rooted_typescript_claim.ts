import {
  type IRunResult,
  type ITtscEvidenceProject,
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies a rooted TypeScript claim with no selected Program host is inactive.
 *
 * A TypeScript `root` changes the address space for Program sources; it does
 * not scan the filesystem. When that population contains no selected export,
 * the claim owns no acknowledgement host and its references must not run.
 *
 * 1. Declare a sibling TypeScript root with no admitted Program source.
 * 2. Put an otherwise uncovered Markdown heading behind that empty claim.
 * 3. Assert the real `ttsc check` succeeds without population or coverage noise.
 */
export const test_evidence_graph_ignores_an_empty_rooted_typescript_claim =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "root-typescript-empty",
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
        '          root: "../shared",',
        '          files: ["src/**/*.ts"],',
        '          symbol: "type",',
        '          reference: { type: "markdown", files: ["docs/**"], symbol: "h2" },',
        "        },",
        "      ],",
        "    }],",
        "  },",
        "};",
        "",
      ].join("\n"),
      workspaceFiles: {
        "shared/.keep": "",
      },
      files: {
        "docs/spec.md": "## Alpha\n",
        "src/sale.ts": "export interface ISale {}\n",
      },
    });
    try {
      const result: IRunResult = runCheck(project.directory);
      assertStatus(
        result,
        0,
        "A claim with no selected Program host must remain inactive.",
      );
      assertExcludes(
        result,
        "could not resolve the typescript root",
        "A root that exists is resolvable, whatever its globs then select.",
      );
      assertExcludes(
        result,
        "Missing acknowledgement",
        "An inactive claim must not evaluate its reference obligations.",
      );
    } finally {
      project.cleanup();
    }
  };
