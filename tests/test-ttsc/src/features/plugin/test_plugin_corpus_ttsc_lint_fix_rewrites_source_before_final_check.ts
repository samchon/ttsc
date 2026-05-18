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
 * Verifies plugin corpus: @ttsc/lint fix rewrites source before final check.
 *
 * This pins the user-facing `ttsc fix` path, not just the native sidecar. The
 * launcher must route fix mode to check-stage plugins, and the lint sidecar
 * must reload the project before reporting remaining diagnostics.
 *
 * 1. Materialize a project with fixable native lint violations.
 * 2. Run `ttsc fix` through the real launcher and source-plugin cache.
 * 3. Assert the source file is rewritten and no JavaScript output is emitted.
 */
export const test_plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": `var legacy = 1;\nlet stable = legacy;\nif (typeof stable == "number") { JSON.stringify(stable); }\n`,
      },
      {
        compilerOptions: {
          plugins: [
            {
              transform: "@ttsc/lint",
              rules: {
                eqeqeq: "error",
                "no-var": "error",
                "prefer-const": "error",
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
    const result = spawn(ttscBin, ["fix", "--cwd", root], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-lint-fix-"),
        TTSC_GO_BINARY: fs.existsSync(goBinary) ? goBinary : "go",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
      'const legacy = 1;\nconst stable = legacy;\nif (typeof stable === "number") { JSON.stringify(stable); }\n',
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  };
