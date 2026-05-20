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
 * Plugin authors may export a named `createTtscPlugin` factory as an
 * alternative to `module.exports = descriptor` or `exports.default`. The
 * descriptor loader must recognise this convention so both styles coexist
 * without requiring a separate entry-point per export shape.
 *
 * 1. Write a plugin descriptor file that exports `createTtscPlugin` returning a
 *    descriptor with the go-transformer source.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert zero exit and `"PLUGIN"` present in the emitted JS.
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
