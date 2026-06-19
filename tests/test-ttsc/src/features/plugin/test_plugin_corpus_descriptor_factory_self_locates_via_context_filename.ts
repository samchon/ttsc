import {
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
 * Verifies plugin corpus: a factory descriptor self-locates via
 * `context.filename` on the direct `require` load path.
 *
 * Complements the ttsx-path coverage in
 * `test_plugin_corpus_descriptor_factory_self_locates_via_context_dirname`: a
 * compiled `.cjs` descriptor loads through ttsc's direct `require()` (no ttsx),
 * the other branch that must populate the self-location fields. This pins that
 * `context.filename` is the resolved entry path there too, so #248's fix holds
 * for both load paths and both fields.
 *
 * 1. Write a `.cjs` descriptor whose `source` is derived from
 *    `path.dirname(context.filename)` rather than the ambient `__dirname`.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert zero exit and `"PLUGIN"` present in the emitted JS.
 */
export const test_plugin_corpus_descriptor_factory_self_locates_via_context_filename =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/locate.cjs", name: "locate-export" }],
      {
        "plugins/locate.cjs": `
        const path = require("node:path");

        exports.createTtscPlugin = (context) => ({
          name: context.plugin.name,
          source: path.resolve(
            path.dirname(context.filename),
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
