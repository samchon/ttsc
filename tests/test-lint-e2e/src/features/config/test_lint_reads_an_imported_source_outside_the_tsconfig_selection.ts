import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies ttsc reports a lint diagnostic on a source its tsconfig never
 * selected but its type-check pass read.
 *
 * The Go suite pins this boundary inside `linthost`, which leaves the product
 * path itself unproven: the launcher, plugin discovery, and the native sidecar
 * all sit between a user's `ttsc` invocation and `userSourceFiles`. A sibling
 * package that resolves to its own TypeScript is type-checked by the same
 * Program, so lint must see it too (samchon/ttsc#1065). The consumer's own file
 * is deliberately clean, so the only diagnostic that can appear belongs to the
 * imported source, and an incidental report cannot pass this case.
 *
 * 1. Materialize a project whose tsconfig includes `src` alone.
 * 2. Import a sibling package's source, kept outside that include, with a `no-var`
 *    violation.
 * 3. Run ttsc; assert it fails and every diagnostic names the sibling file.
 *
 * @evidence contracts/testing.md#behavioral-verification A clean included entry imports a sibling source outside the tsconfig include; actual ttsc must report exactly one no-var diagnostic naming that sibling source.
 * @evidence contracts/testing.md#independent-expectations The authored sibling contains the sole var declaration and the included entry is clean, so an unrelated included-file finding cannot satisfy the expected rule and file assertions.
 * @evidence contracts/testing.md#distinguishing-cases The include selects only src but the Program reaches packages/api/src/index.ts through an import, distinguishing actual compiler-read source selection from tsconfig-root-only linting.
 * @evidence contracts/testing.md#execution-ownership This named entry creates the import/include relationship and invokes the real launcher; existing Go userSourceFiles tests own internal selection without claiming product assembly.
 * @evidence contracts/e2e.md#necessary-boundary The launcher, plugin discovery and native Program source collection must convey a compiler-read sibling file to lint and render its finding; direct selection calls cannot establish that complete connection.
 * @evidence contracts/e2e.md#shared-execution One compiler project and launcher call exercise the included clean control and excluded imported positive together, using the same content-keyed builtin lint artifact as immutable builtin consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The include, import, sibling source and rule map remain fixed in a fresh owned project removed in finally; sharing compiler/plugin artifacts cannot substitute a prior project result.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero exit, exactly one no-var finding and every diagnostic naming index remain executable; the included clean entry prevents incidental root-file reports from satisfying the case.
 */
export function test_lint_reads_an_imported_source_outside_the_tsconfig_selection() {
    const project = createLintProject({
      name: "imported-source-outside-selection",
      source:
        'import { value } from "../packages/api/src/index";\n' +
        "JSON.stringify(value);\n",
      extraSources: {
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            noEmit: true,
            plugins: [{ transform: "@ttsc/lint" }],
          },
          include: ["src"],
        }),
        "lint.config.json": JSON.stringify({
          rules: { "no-var": "error" },
        }),
        "packages/api/src/index.ts":
          "export var legacy = 1;\nexport const value = legacy;\n",
      },
    });
    try {
      const result = runLintProject(project.tmpdir);
      assert.notEqual(result.status, 0, result.stderr);
      assert.deepEqual(
        result.diagnostics.map((d) => d.rule),
        ["no-var"],
        result.stderr,
      );
      assert.equal(
        result.diagnostics.every((d) => d.file.includes("index")),
        true,
        result.stderr,
      );
    } finally {
      project.cleanup();
    }
  }
