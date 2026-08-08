import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule makes a class and its member variables citable.
 *
 * The three selectors map onto the three declaration kinds a class spells: the
 * class is a `type`, a method is a `function`, and a field is a `property`
 * unless it is written as a callable. Driving it through the real binary is
 * what proves the mapping survives packaging, where the Go suite only proves
 * the collector.
 *
 * A clean exit would not distinguish a discharged obligation from an absent
 * one: if both populations went, both claims deactivate and the build exits
 * clean for the opposite reason. The property document therefore carries a
 * section nobody cites, and the case demands the build fail naming exactly that
 * one, with neither cited section among the names.
 *
 * 1. Cite one section from a class and another from a public field, leaving a
 *    third uncited.
 * 2. Enable a `type` claim and a `property` claim over the same file.
 * 3. Assert the build fails naming only the uncited section.
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
      "docs/fields.md": [
        "## Price {#price}",
        "",
        "The amount the customer pays.",
        "",
        "## Uncited {#uncited}",
        "",
        "Nothing answers for this section.",
        "",
      ].join("\n"),
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
    assertFailure(
      result,
      "The uncited section must keep the build red, which is what proves the claims ran.",
    );
    assertIncludes(
      result,
      "Missing acknowledgement for 'docs/fields.md#uncited'",
      "The section nobody cites is the one the build must name.",
    );
    assertExcludes(
      result,
      "docs/subject.md#sale",
      "A class must be able to answer for the section describing the subject.",
    );
    assertExcludes(
      result,
      "docs/fields.md#price",
      "A public field must be able to answer for the section fixing it.",
    );
  } finally {
    project.cleanup();
  }
};
