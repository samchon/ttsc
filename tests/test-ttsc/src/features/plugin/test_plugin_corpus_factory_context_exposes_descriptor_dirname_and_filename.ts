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
 * Verifies plugin corpus: the factory context exposes the descriptor's own
 * `dirname` and `filename`.
 *
 * Pins the new `ITtscPluginFactoryContext.dirname`/`filename` fields wired in
 * `loadProjectPlugins.ts::loadPluginEntry`. They are the load-mode-independent
 * stand-in for the CommonJS `__dirname`/`__filename`: when a descriptor is
 * loaded directly through `require` both globals exist, so the context fields
 * must match them exactly, point at the resolved descriptor file, and be usable
 * to resolve the plugin's Go `source`.
 *
 * 1. Write a `.cjs` descriptor that records `context.dirname`/`context.filename`
 *    alongside the ambient `__dirname`/`__filename`, and derives its `source`
 *    from `context.dirname`.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert the build ran the transform (`"PLUGIN"`), the context fields equal the
 *    ambient globals, and `filename` is the resolved descriptor path.
 */
export const test_plugin_corpus_factory_context_exposes_descriptor_dirname_and_filename =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/probe.cjs", name: "probe" }],
      {
        "plugins/probe.cjs": `
        const fs = require("node:fs");
        const path = require("node:path");
        exports.createTtscPlugin = (context) => {
          fs.writeFileSync(
            process.env.TTSC_FACTORY_PROBE,
            JSON.stringify({
              dirname: context.dirname,
              filename: context.filename,
              ambientDirname: __dirname,
              ambientFilename: __filename,
            }),
          );
          return {
            name: context.plugin.name,
            source: path.resolve(
              context.dirname,
              "..",
              "go-plugin",
              "cmd",
              "ttsc-go-transformer",
            ),
          };
        };
      `,
      },
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );

    const probe = path.join(root, "factory-context-probe.json");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_FACTORY_PROBE: probe },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );

    const recorded = JSON.parse(fs.readFileSync(probe, "utf8")) as {
      dirname: string;
      filename: string;
      ambientDirname: string;
      ambientFilename: string;
    };
    // A directly `require`d CommonJS descriptor keeps `__dirname`/`__filename`,
    // so the context fields must mirror them exactly.
    assert.equal(recorded.dirname, recorded.ambientDirname);
    assert.equal(recorded.filename, recorded.ambientFilename);
    // `filename` is the resolved descriptor module, `dirname` its directory.
    assert.equal(
      recorded.filename,
      fs.realpathSync(path.join(root, "plugins", "probe.cjs")),
    );
    assert.equal(recorded.dirname, path.dirname(recorded.filename));
  };
