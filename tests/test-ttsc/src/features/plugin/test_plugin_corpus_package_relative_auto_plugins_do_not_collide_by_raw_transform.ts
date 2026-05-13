import {
  assert,
  commonJsProject,
  copyDirectory,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
  writeRelativePackagePlugin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: package-relative auto plugins do not collide by raw
 * transform.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform =
  () => {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "plugin-a": "0.1.0",
          "plugin-b": "0.1.0",
        },
      }),
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );
    writeRelativePackagePlugin(root, "plugin-a", {
      name: "prefix",
      prefix: "A:",
    });
    writeRelativePackagePlugin(root, "plugin-b", {
      name: "suffix",
      suffix: ":B",
    });

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-package-relative-plugins-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"A:plugin:B"/);
  };
