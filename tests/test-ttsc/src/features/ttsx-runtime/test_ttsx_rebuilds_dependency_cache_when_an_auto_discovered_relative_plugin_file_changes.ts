import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import { goPath } from "../../internal/plugin-corpus";

/**
 * Verifies ttsx rebuilds a raw dependency cache when an auto-discovered
 * plugin's relative transform file changes.
 *
 * Package plugin manifests resolve relative `ttsc.plugin.transform` values from
 * the plugin package root. The dependency cache stamp must use the same base;
 * otherwise edits to that descriptor keep serving stale dependency emit.
 */
export const test_ttsx_rebuilds_dependency_cache_when_an_auto_discovered_relative_plugin_file_changes =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/plugin-dep/package.json": JSON.stringify({
        name: "plugin-dep",
        version: "1.0.0",
        type: "commonjs",
        exports: { ".": "./src/main.ts" },
        dependencies: { "relative-plugin": "1.0.0" },
      }),
      "node_modules/plugin-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/plugin-dep/src/main.ts":
        `declare function goUpper(input: string): string;\n` +
        `export const value: string = goUpper("plugin");\n`,
      "node_modules/plugin-dep/node_modules/relative-plugin/package.json":
        JSON.stringify({
          name: "relative-plugin",
          version: "1.0.0",
          main: "transform.cjs",
          ttsc: {
            plugin: {
              transform: "./transform.cjs",
              operation: "go-prefix",
              prefix: "auto-",
            },
          },
        }),
      "node_modules/plugin-dep/node_modules/relative-plugin/transform.cjs":
        pluginDescriptor("initial"),
      "src/main.ts": `import { value } from "plugin-dep";\nconsole.log(value);\n`,
    });
    const depRoot = path.join(root, "node_modules", "plugin-dep");
    const pluginRoot = path.join(depRoot, "node_modules", "relative-plugin");
    fs.cpSync(
      path.join(TestProject.PROJECTS_ROOT, "go-source-plugin", "go-plugin"),
      path.join(pluginRoot, "go-plugin"),
      { recursive: true },
    );

    const run = () =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "auto-plugin");

    const cacheDir = path.join(
      depRoot,
      "node_modules",
      ".cache",
      "ttsc",
      "ttsx-deps",
    );
    const witness = path.join(cacheDir, ".reuse-witness");
    fs.writeFileSync(witness, "");

    const transformFile = path.join(pluginRoot, "transform.cjs");
    fs.writeFileSync(transformFile, pluginDescriptor("changed"));
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(transformFile, future, future);

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "auto-plugin");
    assert.equal(
      fs.existsSync(witness),
      false,
      "the dependency cache was rebuilt after relative-plugin/transform.cjs changed",
    );
  };

function pluginDescriptor(marker: string): string {
  return (
    `const path = require("node:path");\n` +
    `// ${marker}\n` +
    `module.exports = {\n` +
    `  name: "relative-plugin",\n` +
    `  source: path.resolve(__dirname, "go-plugin"),\n` +
    `};\n`
  );
}
