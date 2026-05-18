import { TestProject } from "@ttsc/testing";

import {
  assert,
  commonJsProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint format subcommand rewrites source files.
 *
 * The launcher must route the positional `format` subcommand to check-stage
 * plugins with the `format` binary command — distinct from `fix`. A regression
 * in the `case "format":` switch arm surfaces immediately through this
 * scenario.
 *
 * 1. Materialize a project with one missing-semi violation.
 * 2. Run `ttsc format` through the real launcher and source-plugin cache.
 * 3. Assert the source file gains the semicolon and no JavaScript is emitted.
 */
export const test_plugin_corpus_ttsc_lint_format_subcommand_rewrites_source =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": `const value = 1\nJSON.stringify(value)\n`,
      },
      {
        compilerOptions: {
          plugins: [
            {
              transform: "@ttsc/lint",
              rules: {
                "format/semi": "error",
              },
            },
          ],
        },
      },
    );
    const linkDir = path.join(root, "node_modules", "@ttsc");
    fs.mkdirSync(linkDir, { recursive: true });
    fs.symlinkSync(
      path.join(workspaceRoot, "packages", "lint"),
      path.join(linkDir, "lint"),
      "junction",
    );

    const goBinary = path.join(os.homedir(), "go-sdk", "go", "bin", "go");
    const result = spawn(ttscBin, ["format", "--cwd", root], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-lint-format-subcmd-"),
        TTSC_GO_BINARY: fs.existsSync(goBinary) ? goBinary : "go",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
      "const value = 1;\nJSON.stringify(value);\n",
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  };
