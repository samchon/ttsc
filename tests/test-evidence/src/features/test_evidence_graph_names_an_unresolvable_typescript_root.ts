import {
  type IRunResult,
  type ITtscEvidenceProject,
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies a TypeScript claim root that does not resolve is named as a root.
 *
 * The rule computed that sentence all along and read it as a boolean, so the
 * author was answered with `matched no typescript files` and a lecture on glob
 * syntax for a mistake that is one directory name. Markdown and Prisma never
 * had the bug because their loaders walk the root; TypeScript walks nothing.
 * This runs the real binary, because the message has to survive the native
 * boundary the same way the reference-policy diagnostics do.
 *
 * 1. Declare a TypeScript claim rooted at a sibling directory that is absent.
 * 2. Run `ttsc check`.
 * 3. Assert the root is named and no glob diagnostic accompanies it.
 */
export const test_evidence_graph_names_an_unresolvable_typescript_root =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "root-typescript-unresolvable",
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
        '          root: "../absent",',
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
      files: {
        "docs/spec.md": "## Alpha\n",
        "src/sale.ts": "export interface ISale {}\n",
      },
    });
    try {
      const result: IRunResult = runCheck(project.directory);
      assertFailure(result, "An unresolvable claim root must fail the build.");
      assertIncludes(
        result,
        "could not resolve the typescript root '../absent'",
        "The diagnostic must name the property the author has to edit.",
      );
      assertExcludes(
        result,
        "'*' stays within one segment",
        "A root that does not resolve must not be answered with glob syntax.",
      );
    } finally {
      project.cleanup();
    }
  };
