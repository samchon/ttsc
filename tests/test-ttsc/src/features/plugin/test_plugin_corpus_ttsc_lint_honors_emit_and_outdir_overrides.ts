import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  os,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint honors `--emit` and `--outDir` overrides.
 *
 * A tsconfig may set `noEmit: true` to disable output, but callers can override
 * this and also redirect the output directory via CLI flags. The lint plugin
 * path must not prevent these overrides from reaching the underlying compiler
 * invocation — a regression here would cause lint-enabled projects to lose
 * control of where their JS lands.
 *
 * 1. Configure a project with `noEmit: true` and an `@ttsc/lint` plugin.
 * 2. Run ttsc with `--emit --outDir custom`.
 * 3. Assert `custom/main.js` exists and `dist/main.js` does not.
 */
export const test_plugin_corpus_ttsc_lint_honors_emit_and_outdir_overrides =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          noEmit: true,
          outDir: "dist",
          rootDir: "src",
          plugins: [
            {
              transform: "@ttsc/lint",
              config: {},
            },
          ],
        },
        include: ["src"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `export const value: string = "lint-outdir";\n`,
    );
    const cacheDir = TestProject.tmpdir("ttsc-lint-outdir-");

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--outDir", "custom"],
      {
        cwd: root,
        env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "custom", "main.js")), true);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  };
