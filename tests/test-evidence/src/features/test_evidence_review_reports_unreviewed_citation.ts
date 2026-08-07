import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged review rule fails a build on a citation with no
 * `@evidenceReview` of its target.
 *
 * The Go cases prove the pairing; this proves a consumer gets the rule at all,
 * which depends on the descriptor's rule list naming `review` and on the host
 * linking that Go into its binary. A registration typo drops a rule with only a
 * stderr warning, so a missing rule and a passing project look identical from
 * here — and this rule is the one the whole cycle exists for, so nothing else
 * would have caught the omission.
 *
 * The neighbor citation is reviewed, and a third tag spells
 * `@evidenceReviewed`, the boundary one character away. So the same run pins
 * three things: the rule is registered, it does not report a citation that is
 * answered, and the packaged scan does not widen into prefix matching.
 *
 * 1. Export two interfaces, one citation reviewed and one not, plus a citation
 *    whose only answer is an `@evidenceReviewed` tag.
 * 2. Enable `evidence/review` with a bare severity, the only form it accepts.
 * 3. Assert a non-zero exit naming the two unreviewed targets and not the reviewed
 *    one.
 */
export const test_evidence_review_reports_unreviewed_citation = (): void => {
  const project: ITtscEvidenceProject = createProject({
    name: "review-unreviewed",
    include: ["src"],
    lintConfig: [
      'import { evidence } from "@ttsc/evidence";',
      "",
      "export default {",
      '  plugins: { "evidence": evidence },',
      "  rules: {",
      '    "evidence/review": "error",',
      "  },",
      "};",
      "",
    ].join("\n"),
    files: {
      "src/ISale.ts": [
        "/**",
        " * @evidence docs/spec.md#pricing Derives the sale price from this section.",
        " * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.",
        " * @evidence docs/spec.md#refunds Applies the refund window this section sets.",
        " */",
        "export interface ISale {",
        "  price: number;",
        "}",
        "",
      ].join("\n"),
      "src/IOrder.ts": [
        "/**",
        " * @evidence docs/spec.md#orders Places the order this section describes.",
        " * @evidenceReviewed docs/spec.md#orders Not this rule's tag.",
        " */",
        "export interface IOrder {",
        "  id: string;",
        "}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertFailure(
      result,
      "A citation with no review of its target must fail the build.",
    );
    assertIncludes(
      result,
      "Unreviewed @evidence for 'docs/spec.md#refunds'",
      "The unreviewed citation must be reported, and named by its target.",
    );
    assertIncludes(
      result,
      "Unreviewed @evidence for 'docs/spec.md#orders'",
      "'@evidenceReviewed' is another tag; it must not answer a citation.",
    );
    assertIncludes(
      result,
      "Add '@evidenceReview docs/spec.md#refunds",
      "The diagnostic must name the repair, not merely the finding.",
    );
    assertExcludes(
      result,
      "Unreviewed @evidence for 'docs/spec.md#pricing'",
      "A citation answered by a review of the same target must not be reported.",
    );
  } finally {
    project.cleanup();
  }
};
