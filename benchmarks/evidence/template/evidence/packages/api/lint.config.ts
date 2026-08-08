import {
  evidence,
  type ITtscEvidenceGraphConfig,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The evidence obligations of the API package.
 *
 * The DTO claims are declared here because a TypeScript claim selects only
 * files the owning `tsconfig` already includes, and this package's `tsconfig`
 * is the one that includes `src/structures/`. The schema they cite belongs to
 * the backend package, which is why the Prisma references root there.
 *
 * Both edges are many to many — one requirement may be represented by several
 * DTOs, and one model exposed by several — so each obligation counts the units
 * it must cover rather than citations per host.
 *
 * Both claims name `src/structures/DTO_EVIDENCE_EXCLUDE.ts` as the one file
 * their exclusions may be written in, so the carrier is declared rather than
 * conventional and an `@evidenceExclude` on a DTO itself is a compile error.
 */
export const graph: ITtscEvidenceGraphConfig = {
  claims: [
    // A DTO type answers to the requirement it serves and the table it
    // represents.
    {
      name: "dto-types",
      type: "typescript",
      root: ".",
      files: ["src/structures/**/*.ts"],
      evidenceExcludeCarriers: ["src/structures/DTO_EVIDENCE_EXCLUDE.ts"],
      symbol: "type",
      reference: [
        {
          type: "markdown",
          root: "../..",
          files: ["docs/analysis/**/*.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "prisma",
          root: "../backend",
          files: ["prisma/schema/**/*.prisma"],
          symbol: ["model"],
        },
      ],
      // Remove after every DTO and its truthful evidence mapping is complete.
      disabled: true,
    },
    // A DTO property answers to the schema column it carries.
    {
      name: "dto-properties",
      type: "typescript",
      root: ".",
      files: ["src/structures/**/*.ts"],
      evidenceExcludeCarriers: ["src/structures/DTO_EVIDENCE_EXCLUDE.ts"],
      symbol: "property",
      reference: {
        type: "prisma",
        root: "../backend",
        files: ["prisma/schema/**/*.prisma"],
        symbol: ["column"],
      },
      // Remove after every DTO and its truthful evidence mapping is complete.
      disabled: true,
    },
  ],
};

export default {
  extends: "../../config/lint.config.ts",
  ignores: ["src/functional/**/*.ts"],
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
