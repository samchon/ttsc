import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule selects a field declared through the
 * parameter-property shorthand.
 *
 * The parameter is the one host kind whose JSDoc TypeScript attaches somewhere
 * other than a statement or a class member, so packaging is where it would
 * break without the collector noticing. The body field beside it is the control
 * that keeps the case from passing on the wrong half.
 *
 * 1. Cite one section from a body field and another from a parameter property.
 * 2. Enable a `property` claim over that file.
 * 3. Assert a clean exit with no missing acknowledgement.
 */
export const test_evidence_graph_cites_a_constructor_parameter_property =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "parameter-properties",
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
        "docs/fields.md": [
          "## Price {#price}",
          "",
          "The amount the customer pays.",
          "",
          "## Currency {#currency}",
          "",
          "The currency the price is quoted in.",
          "",
        ].join("\n"),
        "src/Sale.ts": [
          "export class Sale {",
          "  /** @evidence docs/fields.md#currency The currency this section fixes. */",
          '  public readonly currency: string = "KRW";',
          "  public constructor(",
          "    /** @evidence docs/fields.md#price The price this section fixes. */",
          "    public readonly price: number,",
          "    private readonly ledger: number,",
          "  ) {}",
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
        "A parameter property must answer for its section like a body field.",
      );
      assertExcludes(
        result,
        "Missing acknowledgement",
        "Both sections are cited, so neither may be reported as missing.",
      );
    } finally {
      project.cleanup();
    }
  };
