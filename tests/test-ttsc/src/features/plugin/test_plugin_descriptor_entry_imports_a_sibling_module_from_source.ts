import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  copyDirectory,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin resolution: a descriptor entry that imports a sibling module
 * from source loads instead of crashing.
 *
 * Locks `installPluginEntryResolveHook`. A plugin may ship inside a package
 * whose entry `import`s other files from source (a package root that
 * re-exports its descriptor/runtime). ttsc loads the descriptor during plugin
 * bootstrap, before runtime source-loading hooks are live, so without the
 * rescue the first extensionless relative import dies with
 * `ERR_MODULE_NOT_FOUND` — killing a valid plugin merely for having imports.
 *
 * 1. A `node_modules/barrel-import-plugin` package's entry (`index.mts`)
 *    re-exports the factory from an extensionless sibling (`./descriptor`).
 * 2. Run ttsc with `--emit` against a project that depends on it.
 * 3. Assert zero exit and the transform ran (`"BARRELIMPORT:plugin"` in the
 *    emit), proving the extensionless `./descriptor` import resolved.
 */
export const test_plugin_descriptor_entry_imports_a_sibling_module_from_source =
  () => {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "barrel-import-plugin": "0.1.0",
        },
      }),
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );

    const packageRoot = path.join(root, "node_modules", "barrel-import-plugin");
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "barrel-import-plugin",
        version: "0.1.0",
        main: "./index.mts",
        ttsc: {
          plugin: {
            transform: "barrel-import-plugin",
            name: "prefix",
            prefix: "BARRELIMPORT:",
          },
        },
      }),
    );
    // The entry re-exports the factory through an extensionless relative
    // specifier — the shape Node's own resolver rejects without the rescue.
    fs.writeFileSync(
      path.join(packageRoot, "index.mts"),
      `export { default } from "./descriptor";\n`,
    );
    fs.writeFileSync(
      path.join(packageRoot, "descriptor.mts"),
      `import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default (context: { plugin: { name: string } }) => ({
  name: context.plugin.name,
  source: path.resolve(
    here,
    "..",
    "..",
    "go-plugin",
    "cmd",
    "ttsc-go-transformer",
  ),
});
`,
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"BARRELIMPORT:plugin"/);
  };
