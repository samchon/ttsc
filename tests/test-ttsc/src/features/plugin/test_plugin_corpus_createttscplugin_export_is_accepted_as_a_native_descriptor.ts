import {
  __dirname,
  assert,
  copyDirectory,
  fs,
  goPath,
  path,
  pluginProject,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: createTtscPlugin export is accepted as a native
 * descriptor.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_createttscplugin_export_is_accepted_as_a_native_descriptor =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/create.cjs", name: "create-export" }],
      {
        "plugins/create.cjs": `
        exports.createTtscPlugin = (context) => ({
          name: context.plugin.name,
          source: require("node:path").resolve(
            __dirname,
            "..",
            "go-plugin",
            "cmd",
            "ttsc-go-transformer"
          ),
        });
      `,
      },
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
  };
