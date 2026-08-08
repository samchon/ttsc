import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The evidence obligations of the backend, declared once in the test Program.
 *
 * All three claims live here because this is the Program that holds every host.
 * `test/tsconfig.json` compiles the backend source together with the tests, so
 * controllers and test functions are both selected from it, while the package
 * Program sees only `src/` and could never reach the tests.
 *
 * The schema answers to the requirements, every requirement and every model
 * answers to some controller operation, and every published operation answers
 * to a test. Each edge is many to many, so an obligation counts the units it
 * must cover rather than citations per host.
 *
 * Roots are relative to the package directory, which is where every backend
 * command runs from: `check:watch`, `build:sdk`, and `test` are declared in
 * `packages/backend/package.json`, so the package manager makes that directory
 * the working directory for each of them.
 *
 * Each claim names the one file its exclusions may be written in, resolved
 * against that same root, so the carrier is declared rather than conventional
 * and an `@evidenceExclude` written anywhere else is a compile error.
 *
 * The two file rules are declared here rather than on the package for the same
 * reason: this Program includes `../src` alongside the tests, so it already
 * covers every file they should reach. Declaring them on the package would put
 * them in the configuration `nestia all` resolves when it compiles
 * `nestia.config.ts` through a project of its own making, and that file is an
 * anonymous default export `evidence/singular` can never accept.
 *
 * `include` selects this directory, so the Program holds this file too, and
 * `evidence/singular` would reach the anonymous default export below for the
 * same reason it reaches `nestia.config.ts`. Linting the configuration that
 * declares the rules is never the point, so it is ignored here.
 */
export default {
  extends: "../lint.config.ts",
  ignores: ["lint.config.ts"],
  plugins: {
    evidence,
  },
  rules: {
    "evidence/singular": "error",
    // One verification statement beside every acknowledgement. The graph counts
    // whether a target is cited; it cannot count whether the citing host does
    // what the target asks, so a citation that is wrong and one that is right
    // are the same bytes to it. Writing what was actually checked is what makes
    // the difference visible, and it is what turns a symbol carrying several
    // unrelated citations into several symbols.
    "evidence/review": "error",
    // A controller stub marks the work it has not realized with `@todo`, and
    // the tag is the marker until the provider replaces it. Set this to
    // "error" once every public-operation test is written, and the stubs that
    // remain enumerate themselves as the work left to do.
    "evidence/todo": "off",
    "evidence/graph": [
      "error",
      {
        claims: [
          // The schema stores what the requirements say must persist.
          {
            name: "schema-models",
            type: "prisma",
            root: "..",
            files: [
              "prisma/schema/**/*.prisma",
              "prisma/schema/exclude.schema",
            ],
            evidenceExcludeCarriers: ["prisma/schema/exclude.schema"],
            symbol: "model",
            reference: {
              type: "markdown",
              root: "../../..",
              files: ["docs/analysis/**/*.md"],
              symbol: ["h2", "h3"],
            },
            // Remove after the complete schema passes build:prisma and schema.
            disabled: true,
          },
          // The operations realize the requirements and expose the schema.
          {
            name: "api-operations",
            type: "typescript",
            root: "..",
            files: ["src/controllers/**/*.ts"],
            evidenceExcludeCarriers: [
              "src/controllers/CONTROLLER_EVIDENCE_EXCLUDE.ts",
            ],
            symbol: "function",
            reference: [
              {
                type: "markdown",
                root: "../../..",
                files: ["docs/analysis/**/*.md"],
                symbol: ["h2", "h3"],
              },
              {
                type: "prisma",
                root: "..",
                files: ["prisma/schema/**/*.prisma"],
                symbol: ["model"],
              },
            ],
            // Remove after every controller contract is complete and build:sdk
            // passes.
            disabled: true,
          },
          // A test answers for the one published operation it proves. Its
          // operation population is the generated SDK accessor surface alone,
          // so no operation may answer "not applicable" and one test proves
          // exactly one of them. TypeScript targets are cited as `{@link ...}`
          // resolved through the test file's own imports.
          {
            name: "backend-tests",
            type: "typescript",
            root: ".",
            files: ["features/**/*.ts"],
            evidenceExcludeCarriers: ["features/TEST_EVIDENCE_EXCLUDE.ts"],
            symbol: "function",
            reference: [
              {
                type: "markdown",
                root: "../../..",
                files: ["docs/analysis/**/*.md"],
                symbol: ["h2", "h3"],
              },
              {
                type: "typescript",
                package: "{{apiPackageName}}",
                files: ["src/functional/**/*.ts"],
                symbol: ["function"],
                noEvidenceExclude: true,
                singleEvidencePerSymbol: true,
              },
            ],
            // Remove after every public-operation test and evidence mapping is
            // complete.
            disabled: true,
          },
        ],
      },
    ],
  },
} satisfies ITtscLintConfig;
