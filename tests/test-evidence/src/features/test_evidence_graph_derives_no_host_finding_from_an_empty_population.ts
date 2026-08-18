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
 * Verifies an empty population is reported once and not again per host.
 *
 * `singleEvidencePerSymbol` used to judge a healthy empty population, adding
 * one message per selected host telling each to cite a unit that does not exist
 * — beneath the diagnostic that had already said the population was empty. The
 * empty population is still an error, because a build must not pass on a
 * denominator of zero; only the derived per-host findings are gone.
 *
 * 1. Point a strict reference at a document holding no selected heading.
 * 2. Run `ttsc check`.
 * 3. Assert the population is named and no host is counted against it.
 */
export const test_evidence_graph_derives_no_host_finding_from_an_empty_population =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "empty-population-single-evidence",
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
        '          files: ["src/**/*.ts"],',
        '          symbol: "function",',
        "          reference: {",
        '            type: "markdown",',
        '            files: ["docs/**"],',
        '            symbol: "h2",',
        "            singleEvidencePerSymbol: true,",
        "          },",
        "        },",
        "      ],",
        "    }],",
        "  },",
        "};",
        "",
      ].join("\n"),
      files: {
        "docs/spec.md": "Prose with no heading the selector accepts.\n",
        "src/sale.ts": "export function sell(): void {}\n",
      },
    });
    try {
      const result: IRunResult = runCheck(project.directory);
      assertFailure(result, "An empty population must still fail the build.");
      assertIncludes(
        result,
        "found no selected evidence units",
        "The cause must be reported where the population materialized.",
      );
      assertExcludes(
        result,
        "singleEvidencePerSymbol requires exactly 1",
        "A host must not be asked to cite a unit the population cannot hold.",
      );
    } finally {
      project.cleanup();
    }
  };
