import {
  evidence,
  type ITtscEvidenceGraphConfig,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The evidence obligations of the frontend package.
 *
 * The three claims form one chain: a hook answers for the operations it calls,
 * a screen answers for the hooks it uses, and a journey answers for the screens
 * it walks. Owning an operation is not delivering it, so a hook wrapping an
 * accessor no screen renders fails at the screen claim rather than passing on
 * hook coverage alone.
 *
 * `lib/<domain>/hooks.ts` is the only place a generated accessor is called, so
 * a hook is the one artifact that can truthfully own an operation. The screen
 * and journey populations stay narrow for the same reason: a primitive, the
 * layout chrome, a composed provider, and the presentation-only ui-review and
 * readme specs serve every requirement at once and therefore none in
 * particular.
 *
 * Every edge is many to many, so each obligation counts the units it must cover
 * rather than citations per host; one hook may cite as many operations as it
 * calls, and demanding one call per hook would dictate layout instead.
 *
 * The operation and hook references refuse exclusions, because an unconsumed
 * operation and an unused hook are missing work rather than decisions. The
 * requirement and screen references accept a reviewed one, so a screen outside
 * the journeys is a decision someone has to write down and defend.
 *
 * A journey cites each page it traverses as `{@link ThatPage}` resolved through
 * its own type-only import, so a screen no journey walks surfaces at the
 * compiler rather than in review.
 *
 * The screen and journey claims each name the one file their exclusions may be
 * written in, so the carrier is declared rather than conventional and an
 * `@evidenceExclude` on a working screen or journey is a compile error. The
 * hook claim names none, because its only reference refuses exclusions
 * outright.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    // The screens deliver the requirements a user can reach. The dev gallery
    // is tooling, not delivery.
    {
      name: "frontend-screens",
      type: "typescript",
      files: [
        "src/components/*/*-page.tsx",
        "src/components/SCREEN_EVIDENCE_EXCLUDE.ts",
        "!src/components/dev/**",
      ],
      evidenceExcludeCarriers: ["src/components/SCREEN_EVIDENCE_EXCLUDE.ts"],
      symbol: "function",
      reference: [
        {
          type: "markdown",
          root: "../..",
          files: ["docs/analysis/**/*.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "typescript",
          files: ["src/lib/*/hooks.ts"],
          symbol: ["function"],
          noEvidenceExclude: true,
        },
      ],
      // Remove after every required screen and evidence mapping is complete.
      disabled: true,
    },
    // The journeys walk the requirements end to end, through the screens they
    // cite.
    {
      name: "frontend-journeys",
      type: "typescript",
      files: ["tests/journeys/**/*.ts"],
      evidenceExcludeCarriers: ["tests/journeys/JOURNEY_EVIDENCE_EXCLUDE.ts"],
      symbol: "function",
      reference: [
        {
          type: "markdown",
          root: "../..",
          files: ["docs/analysis/**/*.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "typescript",
          files: ["src/components/*/*-page.tsx", "!src/components/dev/**"],
          symbol: ["function"],
        },
      ],
      // Remove after every requirement-backed journey and mapping is complete.
      disabled: true,
    },
    // The hooks deliver the published API. An operation no hook reaches is a
    // missing feature, not a note in `wiki/omissions.md`.
    {
      name: "frontend-hooks",
      type: "typescript",
      files: ["src/lib/*/hooks.ts"],
      symbol: "function",
      reference: {
        type: "typescript",
        package: "{{apiPackageName}}",
        files: ["src/functional/**/*.ts"],
        symbol: ["function"],
        noEvidenceExclude: true,
      },
      // Remove after every published operation reaches a hook.
      disabled: true,
    },
  ],
};

export default {
  extends: "../../config/lint.config.frontend.ts",
  plugins: {
    evidence,
  },
  rules: {
    "evidence/graph": ["error", graph],
    // One verification statement beside every acknowledgement. The graph
    // counts whether a target is cited; it cannot count whether the citing
    // host does what the target asks, so a citation that is wrong and one
    // that is right are the same bytes to it. Writing what was actually
    // checked is what makes the difference visible, and it is what turns a
    // symbol carrying several unrelated citations into several symbols.
    "evidence/review": "error",
  },
} satisfies ITtscLintConfig;
