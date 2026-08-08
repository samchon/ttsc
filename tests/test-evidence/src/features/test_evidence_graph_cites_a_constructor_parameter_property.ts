import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule selects a field declared through the
 * parameter-property shorthand.
 *
 * The parameter is the one host kind whose JSDoc TypeScript attaches somewhere
 * other than a statement or a class member, so packaging is where it would
 * break without the collector noticing.
 *
 * A clean exit alone would prove nothing: a claim whose selected hosts all
 * vanish deactivates, and the build then exits clean for the opposite reason.
 * The document therefore carries a third section nobody cites, and the case
 * demands the build fail naming exactly that one. Either field losing its unit
 * or its host adds a second name to that failure.
 *
 * 1. Cite two of three sections, one from a body field and one from a parameter
 *    property.
 * 2. Enable a `property` claim over that file.
 * 3. Assert the build fails naming the uncited section and neither cited one.
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
          "## Uncited {#uncited}",
          "",
          "Nothing answers for this section.",
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
      assertFailure(
        result,
        "The uncited section must keep the build red, which is what proves the claim ran at all.",
      );
      assertIncludes(
        result,
        "Missing acknowledgement for 'docs/fields.md#uncited'",
        "The section nobody cites is the one the build must name.",
      );
      assertExcludes(
        result,
        "docs/fields.md#price",
        "A parameter property must answer for its section like a body field.",
      );
      assertExcludes(
        result,
        "docs/fields.md#currency",
        "The body field beside it must still answer for its own.",
      );
    } finally {
      project.cleanup();
    }
  };
