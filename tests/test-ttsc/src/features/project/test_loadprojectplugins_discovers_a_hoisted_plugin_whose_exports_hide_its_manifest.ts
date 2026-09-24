import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies plugin discovery reads a hoisted dependency's own manifest when the
 * package's exports hide it and its entry sits below a nested manifest
 * (samchon/ttsc#1499).
 *
 * Discovery reads each direct dependency's `package.json` for a `ttsc.plugin`
 * declaration. A dependency hoisted to a workspace root is not in the project's
 * own `node_modules`, and one whose `exports` omits `./package.json` cannot
 * resolve its manifest by name, so discovery fell back to the manifest nearest
 * the package's entry. A dual package keeps `dist/cjs/package.json` beside its
 * CommonJS build: discovery read that one, never saw the declaration, and
 * loaded no plugin. The manifest is now the one of the package directory the
 * entry resolved in.
 *
 * 1. Hoist two scoped dependencies of that shape to the workspace root, one
 *    declaring a plugin and one declaring none, and depend on both from a
 *    package that configures no plugin.
 * 2. Load the package's plugins.
 * 3. Assert the declared plugin is loaded, the other is not, and the recorded
 *    manifests of the declaring package stop at the workspace root.
 */
export const test_loadprojectplugins_discovers_a_hoisted_plugin_whose_exports_hide_its_manifest =
  () => {
    const root = TestProject.tmpdir("ttsc-hoisted-plugin-discovery-");
    const project = path.join(root, "packages", "app");
    const declaring = path.join(root, "node_modules", "@scope", "plug");
    const plain = path.join(root, "node_modules", "@scope", "plain");
    write(path.join(root, "package.json"), '{ "private": true }\n');
    write(
      path.join(project, "package.json"),
      JSON.stringify({
        dependencies: { "@scope/plain": "*", "@scope/plug": "*" },
        name: "app",
      }),
    );
    write(path.join(project, "tsconfig.json"), JSON.stringify({}));
    for (const [directory, name, declares] of [
      [declaring, "@scope/plug", true],
      [plain, "@scope/plain", false],
    ] as const) {
      write(
        path.join(directory, "package.json"),
        JSON.stringify({
          exports: { ".": { require: "./dist/cjs/index.js" } },
          name,
          ...(declares
            ? { ttsc: { plugin: { transform: "./plugin.cjs" } } }
            : {}),
        }),
      );
      write(
        path.join(directory, "dist", "cjs", "package.json"),
        '{ "type": "commonjs" }\n',
      );
      write(
        path.join(directory, "dist", "cjs", "index.js"),
        "module.exports = 1;\n",
      );
    }
    write(
      path.join(declaring, "plugin.cjs"),
      [
        'const path = require("node:path");',
        "module.exports = () => ({ name: 'hoisted', source: path.join(__dirname, 'go-plugin') });",
        "",
      ].join("\n"),
    );
    writeGoModule(path.join(declaring, "go-plugin"));
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });

    const loaded = loadProjectPlugins({
      binary: "",
      cacheDir: path.join(root, "cache"),
      cwd: project,
      env: {
        ...process.env,
        TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
        TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
      },
      tsconfig: path.join(project, "tsconfig.json"),
    });

    assert.deepEqual(
      loaded.nativePlugins.map((plugin) => plugin.name),
      ["hoisted"],
      "the declared plugin is discovered, and nothing else",
    );
    const manifests = loaded.hostInputs.filter((input) =>
      input.endsWith(path.join("@scope", "plug", "package.json")),
    );
    assert.ok(
      manifests.some(
        (input) =>
          physical(input) === physical(path.join(declaring, "package.json")),
      ),
      "the package's own manifest is an input",
    );
    // The roots from the package to the workspace root lie below `root`; every
    // root past the one the package resolved in lies above it.
    assert.deepEqual(
      manifests.filter(
        (input) => !physical(input).startsWith(physical(root) + path.sep),
      ),
      [],
      "no manifest past the root the package resolved in",
    );
  };

/** The path's physical spelling, or its own for a path that does not exist. */
function physical(file: string): string {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return path.join(physical(path.dirname(file)), path.basename(file));
  }
}

/** A Go module the fake toolchain accepts. */
function writeGoModule(directory: string): void {
  write(
    path.join(directory, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  write(path.join(directory, "main.go"), "package main\n");
  // The files the fake Go build requires of the module it compiles.
  for (const relative of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    write(path.join(directory, relative), "package generated\n");
  }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
