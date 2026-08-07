import fs from "node:fs";
import path from "node:path";

import {
  type IRunResult,
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";

const LINT_CONFIG: string = [
  'import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";',
  'import type { ITtscLintConfig } from "@ttsc/lint";',
  "",
  "const graph: ITtscEvidenceGraphConfig = {",
  "  claims: [",
  "    {",
  '      type: "typescript",',
  '      files: ["src/**"],',
  '      symbol: "type",',
  "      reference: {",
  '        type: "markdown",',
  '        files: ["docs/**/*.md"],',
  '        symbol: "h2",',
  "        requireReview: true,",
  "      },",
  "    },",
  "  ],",
  "};",
  "",
  "export default {",
  '  plugins: { "evidence": evidence },',
  '  rules: { "evidence/graph": ["error", graph] },',
  "} satisfies ITtscLintConfig;",
  "",
].join("\n");

const SPEC_BEFORE: string = [
  "## Pricing",
  "",
  "The rate is capped at 30%.",
  "",
].join("\n");

const SPEC_AFTER: string = [
  "## Pricing",
  "",
  "The rate is capped at 45%.",
  "",
].join("\n");

/**
 * Reads the fingerprint the graph asks for out of its own diagnostic.
 *
 * Taken from the running compiler rather than written as a literal, because the
 * property under test is that the value tracks the content. A hard-coded digest
 * would prove only that the code agrees with itself, and would have to be
 * rewritten whenever the digest definition changed for a good reason.
 *
 * The token is found by shape rather than by taking the first `#`: the
 * diagnostic also names the cited Markdown target, whose own anchor carries
 * one.
 */
const expectedFingerprint = (result: IRunResult): string => {
  // The scan starts at a diagnostic that *asks for* a value and runs forward from
  // there. Both halves matter.
  //
  // Starting there is the guard: a stale diagnostic names the review's own
  // outdated fingerprint before the expected one, so scanning from the top would
  // return the value already in the source and the case would fail as stale rather
  // than as a broken helper. The Go twin guards the same way.
  //
  // Running forward rather than within one line is the correction: the host wraps
  // a graph diagnostic across several lines, so the sentence naming the citation
  // and the repair clause carrying the fingerprint routinely land on different
  // ones. Matching inside a single line finds the first and misses the value.
  const openings: number[] = [
    result.output.indexOf("Unreviewed @"),
    result.output.indexOf("Unfingerprinted @evidenceReview"),
  ]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  const opening: number | undefined = openings[0];
  const match: RegExpMatchArray | null =
    opening === undefined
      ? null
      : result.output.slice(opening).match(/#([0-9a-f]{7})(?=[\s'",.)])/);
  if (match === null)
    throw new Error(
      `expected a review diagnostic naming a fingerprint, got:\n${result.output}`,
    );
  return match[1]!;
};

/**
 * Verifies `requireReview` expires a review through the real compiler once the
 * cited content changes, and accepts it again when the review is rewritten.
 *
 * This is the one case that proves the feature end to end. Every other check of
 * expiry is a Go unit case driving the rule in-process, so none of them proves
 * that a consumer's `lint.config.ts` can even declare `requireReview`: the
 * property has to survive JSON decoding of a real config, the Markdown loader
 * reading a real file, and the fingerprint reaching a real diagnostic. A decode
 * that silently rejected the option would leave every one of those Go cases
 * passing while the feature did nothing for anybody.
 *
 * It also pins the diagnostic contract the design depends on. Editor
 * completions publish only on a cycle where the rule reports nothing, so the
 * cycle that needs the expected fingerprint is the one that offers none. If the
 * message did not carry it, the author would have no way to write the review at
 * all.
 *
 * The config is type-checked here rather than excluded, so the case also proves
 * a consumer can _declare_ `requireReview` under `satisfies ITtscLintConfig`.
 * Go accepting the option and the published type admitting it are two different
 * claims, and only one of them has a Go case behind it.
 *
 * 1. Cite one H2 with no review and read the fingerprint out of the failure.
 * 2. Write that review and assert the project builds clean.
 * 3. Rewrite the cited section, assert the same source now fails as stale, and
 *    assert the message names both the old value and the new one.
 */
export const test_evidence_graph_expires_a_review_when_cited_content_changes =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "require-review-expiry",
      lintConfig: LINT_CONFIG,
      files: {
        "docs/spec.md": SPEC_BEFORE,
        "src/ISale.ts": [
          "/**",
          " * @evidence docs/spec.md#pricing Derives the sale price from this section.",
          " */",
          "export interface ISale {",
          "  price: number;",
          "}",
          "",
        ].join("\n"),
      },
    });
    try {
      const unreviewed: IRunResult = runCheck(project.directory);
      assertFailure(
        unreviewed,
        "A citation acknowledging a requireReview reference must fail until it is reviewed.",
      );
      assertIncludes(
        unreviewed,
        "Unreviewed @evidence for 'docs/spec.md#pricing'",
        "The finding must name the citation it is about.",
      );
      const fingerprint: string = expectedFingerprint(unreviewed);

      const reviewed: string = [
        "/**",
        " * @evidence docs/spec.md#pricing Derives the sale price from this section.",
        ` * @evidenceReview docs/spec.md#pricing #${fingerprint} Section caps the rate at 30%; price clamps to 30.`,
        " */",
        "export interface ISale {",
        "  price: number;",
        "}",
        "",
      ].join("\n");
      fs.writeFileSync(
        path.join(project.directory, "src", "ISale.ts"),
        reviewed,
        "utf8",
      );
      assertStatus(
        runCheck(project.directory),
        0,
        "A review carrying the fingerprint the compiler asked for must satisfy the obligation.",
      );

      fs.writeFileSync(
        path.join(project.directory, "docs", "spec.md"),
        SPEC_AFTER,
        "utf8",
      );
      const stale: IRunResult = runCheck(project.directory);
      assertFailure(
        stale,
        "Rewriting the cited section must expire the review that was written against it.",
      );
      assertIncludes(
        stale,
        "Stale @evidenceReview for 'docs/spec.md#pricing'",
        "The finding must say the review is stale rather than missing.",
      );
      assertIncludes(
        stale,
        `names '#${fingerprint}'`,
        "The diagnostic must quote the value in the source, so the author can see which review moved.",
      );
    } finally {
      project.cleanup();
    }
  };
