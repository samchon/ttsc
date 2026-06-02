import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import { goPath } from "../../internal/plugin-corpus";

/**
 * Verifies ttsx rebuilds a raw dependency cache when an explicit plugin file
 * changes.
 *
 * A raw-`.ts` dependency may declare a source transform in its own
 * `compilerOptions.plugins[]`. The persistent dependency emit cache must be
 * invalidated by that plugin descriptor file as well as by TypeScript sources;
 * otherwise a plugin edit keeps serving stale transformed JavaScript.
 *
 * 1. Compile a raw dependency through a relative source-plugin descriptor.
 * 2. Plant a witness file in its dependency emit cache.
 * 3. Change only `plugin.cjs` and run ttsx again.
 * 4. Assert the dependency still runs and the witness was removed by rebuild.
 */
export const test_ttsx_rebuilds_dependency_cache_when_an_explicit_plugin_file_changes =
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
      }),
      "node_modules/plugin-dep/plugin.cjs": pluginDescriptor("initial"),
      "node_modules/plugin-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
          plugins: [
            {
              transform: "./plugin.cjs",
              operation: "go-prefix",
              prefix: "explicit-",
            },
          ],
        },
        include: ["src"],
      }),
      "node_modules/plugin-dep/src/main.ts":
        `declare function goUpper(input: string): string;\n` +
        `export const value: string = goUpper("plugin");\n`,
      "src/main.ts": `import { value } from "plugin-dep";\nconsole.log(value);\n`,
    });
    const depRoot = path.join(root, "node_modules", "plugin-dep");
    fs.cpSync(
      path.join(TestProject.PROJECTS_ROOT, "go-source-plugin", "go-plugin"),
      path.join(depRoot, "go-plugin"),
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
    assert.equal(first.stdout.trim(), "explicit-plugin");

    const cacheDir = path.join(
      depRoot,
      "node_modules",
      ".cache",
      "ttsc",
      "ttsx-deps",
    );
    const witness = path.join(cacheDir, ".reuse-witness");
    fs.writeFileSync(witness, "");

    const pluginFile = path.join(depRoot, "plugin.cjs");
    fs.writeFileSync(pluginFile, pluginDescriptor("changed"));
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(pluginFile, future, future);

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "explicit-plugin");
    assert.equal(
      fs.existsSync(witness),
      false,
      "the dependency cache was rebuilt after plugin.cjs changed",
    );
  };

function pluginDescriptor(marker: string): string {
  return (
    `const path = require("node:path");\n` +
    `// ${marker}\n` +
    `module.exports = {\n` +
    `  name: "go-source-plugin",\n` +
    `  source: path.resolve(__dirname, "go-plugin"),\n` +
    `};\n`
  );
}
