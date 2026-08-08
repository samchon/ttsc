import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule makes a class and its member variables citable.
 *
 * The three selectors map onto the three declaration kinds a class spells: the
 * class is a `type`, a method is a `function`, and a member variable is a
 * `property`. Driving it through the real binary is what proves the mapping
 * survives packaging, where the Go suite only proves the collector.
 *
 * 1. Cite one section from a class and another from a public field.
 * 2. Enable a `type` claim and a `property` claim over the same file.
 * 3. Assert a clean exit with no missing acknowledgement.
 */
export const test_evidence_graph_cites_a_class_and_its_members = (): void => {
  const project: ITtscEvidenceProject = createProject({
    name: "class-units",
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
      "      }, {",
      '        type: "typescript",',
      '        files: ["src/Sale.ts"],',
      '        symbol: "property",',
      "        reference: {",
      '          type: "markdown",',
      '          files: ["docs/fields.md"],',
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
      "docs/fields.md": "## Price {#price}\n\nThe amount the customer pays.\n",
      "src/Sale.ts": [
        "/** @evidence docs/subject.md#sale The sale this section specifies. */",
        "export class Sale {",
        "  /** @evidence docs/fields.md#price The price this section fixes. */",
        "  public readonly price: number = 0;",
        "  private ledger: number = 0;",
        "  public charge(): void {}",
        "}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertStatus(
      result,
      0,
      "A class and its public field must be able to answer for their sections.",
    );
    assertExcludes(
      result,
      "Missing acknowledgement",
      "Both obligations are cited, so neither may be reported as missing.",
    );
  } finally {
    project.cleanup();
  }
};
