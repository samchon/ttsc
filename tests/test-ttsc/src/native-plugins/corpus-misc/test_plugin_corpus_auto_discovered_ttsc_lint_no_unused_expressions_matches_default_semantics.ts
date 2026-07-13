import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  parseDiagnostics,
  parseExpectations,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies an auto-discovered @ttsc/lint package applies no-unused-expressions
 * default semantics without a tsconfig plugin entry.
 *
 * Issue #408 was reproduced by installing `@ttsc/lint` as a direct dependency,
 * relying on its `ttsc.plugin` package marker, and leaving
 * `compilerOptions.plugins` absent. The ordinary lint corpus always writes an
 * explicit plugin entry, so it cannot protect this loading path. This fixture
 * lists the linked workspace package in the nearest `package.json`, invokes the
 * real ttsc CLI, and checks both the rule semantics and process exit contract.
 *
 * 1. Copy the checked-in project and link its direct `@ttsc/lint` dependency.
 * 2. Assert the tsconfig has no `compilerOptions.plugins` escape hatch, then run
 *    `ttsc --noEmit` through package-marker auto-discovery.
 * 3. Assert exit code 2 and exactly the issue's two diagnostics while the
 *    productive controls, arbitrary directives, and default JSX stay silent.
 */
export const test_plugin_corpus_auto_discovered_ttsc_lint_no_unused_expressions_matches_default_semantics =
  () => {
    const root = setupLintProject("lint-no-unused-expressions-auto-discovery");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
    ) as { compilerOptions?: { plugins?: unknown } };
    assert.equal(manifest.dependencies?.["@ttsc/lint"], "*");
    assert.equal(tsconfig.compilerOptions?.plugins, undefined);

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.status, 2, result.stderr);

    const sources = ["main.ts", "default-jsx.tsx"];
    let expectedCount = 0;
    for (const source of sources) {
      const file = path.join(root, "src", source);
      const expected = parseExpectations(file);
      const actual = parseDiagnostics(result.stderr, file);
      expectedCount += expected.length;
      assert.deepEqual(actual, expected, result.stderr);
    }
    assert.equal(expectedCount, 2);
    const renderedCodes = [...result.stderr.matchAll(/\bTS(\d+):/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(
      renderedCodes,
      Array.from({ length: expectedCount }, () => "17505"),
      result.stderr,
    );
  };
