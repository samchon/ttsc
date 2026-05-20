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
 * Verifies plugin corpus: default export factory is accepted as a native
 * descriptor.
 *
 * Plugin descriptors may use `exports.default = (context) => descriptor` in
 * addition to the plain `module.exports = descriptor` shape. The descriptor
 * loader must recognise both so package authors who prefer named exports are
 * not forced to use `module.exports`.
 *
 * 1. Write a plugin file that sets `exports.default` to a factory function
 *    returning a descriptor pointing at the go-transformer source.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert zero exit and `"PLUGIN"` present in the emitted JS.
 */
export const test_plugin_corpus_default_export_factory_is_accepted_as_a_native_descriptor =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/default.cjs", name: "default-shape" }],
      {
        "plugins/default.cjs": `
        exports.default = (context) => ({
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
