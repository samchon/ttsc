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
 */
export const test_lint_reads_an_imported_source_outside_the_tsconfig_selection =
  () => {
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
  };
