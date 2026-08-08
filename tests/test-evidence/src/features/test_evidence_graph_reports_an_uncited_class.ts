import {
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule reports an uncited class.
 *
 * The firing twin of `test_evidence_graph_cites_a_class_and_its_members`.
 * Without it, a build in which classes had quietly stopped being selected would
 * exit clean in exactly the same way a satisfied one does, and the whole
 * obligation would be invisible.
 *
 * 1. Remove the class's citation and keep the field's.
 * 2. Enable the same two claims.
 * 3. Assert a non-zero exit naming the unacknowledged section.
 */
export const test_evidence_graph_reports_an_uncited_class = (): void => {
  const project: ITtscEvidenceProject = createProject({
    name: "class-units-uncited",
    lintConfig: [
      'import evidence from "@ttsc/evidence";',
      "",
      "export default {",
      '  plugins: { "evidence": evidence },',
      "  rules: {",
      '    "evidence/graph": ["error", {',
      "      claims: [{",
      '        type: "typescript",',
      '        files: ["src/Sale.ts"],',
      '        symbol: "type",',
      "        reference: {",
      '          type: "markdown",',
      '          files: ["docs/subject.md"],',
      '          symbol: "h2",',
      "        },",
      "      }],",
      "    }],",
      "  },",
      "};",
      "",
    ].join("\n"),
    files: {
      "docs/subject.md": "## Sale {#sale}\n\nA sale offered to a customer.\n",
      "src/Sale.ts": [
        "/** A sale offered to a customer. */",
        "export class Sale {",
        "  public readonly price: number = 0;",
        "}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertFailure(
      result,
      "A class that cites nothing must fail the claim it hosts.",
    );
    assertIncludes(
      result,
      "Missing acknowledgement for 'docs/subject.md#sale'",
      "The section owes an acknowledgement the class alone can give.",
    );
  } finally {
    project.cleanup();
  }
};
