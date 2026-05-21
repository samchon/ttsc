import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: a forwarded `--strict` flag is honored on a project
 * that configures a ttsc plugin.
 *
 * A plugin-configured project builds through native sidecars, not a plain
 * `tsgo` spawn, so a tsgo flag the `ttsc` launcher forwards must travel into
 * those sidecars (as the `--tsgo-args` payload) and merge onto their compiler
 * options. The tsconfig here sets `strict: false`; a strict-null error
 * therefore proves `ttsc --strict` overrode the project setting end-to-end
 * through the plugin lane, not only on the plain build path.
 *
 * 1. Configure a `@ttsc/lint` project whose tsconfig disables strict mode, with a
 *    possibly-null dereference in the source.
 * 2. Run `ttsc --noEmit --strict`.
 * 3. Assert a non-zero exit and a strict-null diagnostic in the output.
 */
export const test_plugin_corpus_ttsc_lint_applies_forwarded_strict_flag =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: false,
          outDir: "dist",
          rootDir: "src",
          plugins: [{ transform: "@ttsc/lint" }],
        },
        include: ["src"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `export const len = (x: string | null): number => x.length;\n`,
    );
    const cacheDir = TestProject.tmpdir("ttsc-lint-strict-");
    const result = spawn(ttscBin, ["--cwd", root, "--noEmit", "--strict"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /is possibly .?null/i);
  };
