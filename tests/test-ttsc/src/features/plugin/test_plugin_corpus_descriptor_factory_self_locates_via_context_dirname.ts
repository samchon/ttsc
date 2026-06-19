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
 * `context.dirname` when loaded through ttsx.
 *
 * Pins the regression in #248: a `.ts`-source descriptor is evaluated through
 * ttsx's `import()` shim, where the ambient `__dirname`/`__filename`/`require`
 * are all undefined, so a descriptor that resolved its own package through them
 * silently mis-resolved `source` and the build failed. The factory context now
 * carries `dirname` (the ESM-safe analog of `__dirname`); this descriptor uses
 * only that field, so it would throw before the fix and resolves after.
 *
 * 1. Write a `.ts` descriptor whose `source` is derived purely from
 *    `context.dirname`, touching no CommonJS global.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert zero exit and `"PLUGIN"` present in the emitted JS.
 */
export const test_plugin_corpus_descriptor_factory_self_locates_via_context_dirname =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/locate.ts", name: "locate-export" }],
      {
        "plugins/locate.ts": `
        import path from "node:path";

        export function createTtscPlugin(context: any) {
          return {
            name: context.plugin.name,
            source: path.resolve(
              context.dirname,
              "..",
              "go-plugin",
              "cmd",
              "ttsc-go-transformer"
            ),
          };
        }
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
