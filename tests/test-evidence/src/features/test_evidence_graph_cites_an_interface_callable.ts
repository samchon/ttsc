import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule selects an interface's callables under `function`.
 *
 * An interface member is one contract with a class member, so the same spelling
 * has to answer the same selector. It did not: `charge: () => void` on an
 * interface materialized as a `property` while a class answered `function`, and
 * a method signature materialized nothing at all. A `symbol: "function"` claim
 * over a file of interfaces therefore selected no host, deactivated, and left
 * the build green with no coverage — the failure this rule exists to make
 * loud.
 *
 * A clean exit would not distinguish a discharged obligation from that absent
 * one, so the document carries a section nobody cites and the case demands the
 * build fail naming exactly that section. Both callable spellings answer, and
 * the data member is left as the `property` half so the two selectors are shown
 * dividing the same interface rather than swallowing it.
 *
 * 1. Cite one section from a function-typed member and another from a method
 *    signature, leaving a third uncited.
 * 2. Enable a `function` claim over the interface file.
 * 3. Assert the build fails naming only the uncited section.
 */
export const test_evidence_graph_cites_an_interface_callable = (): void => {
  const project: ITtscEvidenceProject = createProject({
    name: "interface-callables",
    lintConfig: [
      'import evidence from "@ttsc/evidence";',
      "",
      "export default {",
      '  plugins: { "evidence": evidence },',
      "  rules: {",
      '    "evidence/graph": ["error", {',
      "      claims: [{",
      '        type: "typescript",',
      '        files: ["src/ISale.ts"],',
      '        symbol: "function",',
      "        reference: {",
      '          type: "markdown",',
      '          files: ["docs/behaviour.md"],',
      '          symbol: "h2",',
      "        },",
      "      }],",
      "    }],",
      "  },",
      "};",
      "",
    ].join("\n"),
    files: {
      "docs/behaviour.md": [
        "## Charge {#charge}",
        "",
        "How the amount is taken.",
        "",
        "## Settle {#settle}",
        "",
        "How the transaction closes.",
        "",
        "## Uncited {#uncited}",
        "",
        "Nothing answers for this section.",
        "",
      ].join("\n"),
      "src/ISale.ts": [
        "export interface ISale {",
        "  /** @evidence docs/behaviour.md#charge The behaviour this section fixes. */",
        "  charge: () => void;",
        "  /** @evidence docs/behaviour.md#settle The behaviour this section fixes. */",
        "  settle(): void;",
        "  price: number;",
        "}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertFailure(
      result,
      "The uncited section must keep the build red, which is what proves the claim ran.",
    );
    assertIncludes(
      result,
      "Missing acknowledgement for 'docs/behaviour.md#uncited'",
      "The section nobody cites is the one the build must name.",
    );
    assertExcludes(
      result,
      "docs/behaviour.md#charge",
      "A function-typed interface member must answer a function claim.",
    );
    assertExcludes(
      result,
      "docs/behaviour.md#settle",
      "A method signature must answer a function claim just as a class method does.",
    );
  } finally {
    project.cleanup();
  }
};
