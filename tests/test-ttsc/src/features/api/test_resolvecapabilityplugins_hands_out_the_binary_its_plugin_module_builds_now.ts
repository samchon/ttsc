import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveCapabilityPlugins } from "ttsc";

import { createFakeGoBinary } from "../../internal/source-build";
import { nativeBinary } from "../../internal/toolchain";

/**
 * Verifies `resolveCapabilityPlugins` hands out the binary its plugin's Go
 * module and build environment produce now, and keeps answering from its cache
 * while nothing the binary was keyed on moved (samchon/ttsc#1492).
 *
 * The answer is cached with the binary's path, which the build keys on the
 * plugin's whole module, every contributor's source, and the Go build
 * environment. The cache proved only the plugin's `source` directory, so after
 * an edit to a sibling package of the module, or under another `GOFLAGS`, it
 * kept handing `@ttsc/graph` the old binary, which the build cache still holds.
 * The descriptor here counts its evaluations, which only a walk makes, so each
 * call shows whether the cache answered.
 *
 * 1. Resolve a project whose plugin is a subpackage of its module and declares
 *    `graphNodes`, and resolve again from the cache.
 * 2. Edit a sibling package of the module, and require a walk and a new binary.
 * 3. Change `GOFLAGS`, and require a walk and a new binary.
 * 4. Write below the module's `node_modules`, and require the cached answer.
 */
export const test_resolvecapabilityplugins_hands_out_the_binary_its_plugin_module_builds_now =
  (): void => {
    const root = TestProject.tmpdir("ttsc-capability-module-");
    const project = path.join(root, "project");
    const module = path.join(root, "plugin-module");
    const evaluations = path.join(root, "evaluations.log");
    write(
      path.join(module, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(path.join(module, "cmd", "plugin", "main.go"), "package main\n");
    write(path.join(module, "internal", "mark", "mark.go"), "package mark\n");
    // The files the fake Go build requires of the module it compiles.
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      write(path.join(module, relative), "package generated\n");
    }
    write(path.join(module, "node_modules", "pkg", "index.js"), "\n");
    write(
      path.join(project, "plugin.cjs"),
      [
        'const fs = require("node:fs");',
        "module.exports = () => {",
        `  fs.appendFileSync(${JSON.stringify(evaluations)}, "x\\n");`,
        "  return {",
        "    capabilities: { graphNodes: true },",
        '    name: "graph-plugin",',
        '    stage: "check",',
        `    source: ${JSON.stringify(path.join(module, "cmd", "plugin"))},`,
        "  };",
        "};",
        "",
      ].join("\n"),
    );
    write(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: "./plugin.cjs" }] },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const overrides: NodeJS.ProcessEnv = {
      GOFLAGS: undefined,
      TTSC_BINARY: nativeBinary,
      TTSC_CACHE_DIR: path.join(root, "cache"),
      TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
      TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
    };
    const saved = Object.fromEntries(
      Object.keys(overrides).map((name) => [name, process.env[name]]),
    );
    const apply = (values: NodeJS.ProcessEnv): void => {
      for (const [name, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    };
    const resolve = (): { binary: string; walks: number } => {
      const plugins = resolveCapabilityPlugins({
        capability: "graphNodes",
        cwd: project,
        tsconfig: "tsconfig.json",
      });
      assert.equal(plugins.length, 1, "the declaring plugin was not found");
      assert.ok(fs.existsSync(plugins[0]!.binary), plugins[0]!.binary);
      return {
        binary: plugins[0]!.binary,
        walks: fs.readFileSync(evaluations, "utf8").split("\n").length - 1,
      };
    };
    apply(overrides);
    try {
      // 1. A walk, then the cache.
      const first = resolve();
      assert.equal(first.walks, 1);
      assert.deepEqual(resolve(), first, "an unchanged project walked again");

      // 2. A sibling package of the module.
      write(
        path.join(module, "internal", "mark", "mark.go"),
        "package mark\n\n// edited\n",
      );
      const sibling = resolve();
      assert.equal(sibling.walks, 2, "a sibling package edit was not proven");
      assert.notEqual(sibling.binary, first.binary);

      // 3. The Go build environment.
      apply({ GOFLAGS: "-tags=ttsc_capability_probe" });
      const flagged = resolve();
      assert.equal(flagged.walks, 3, "another GOFLAGS was not proven");
      assert.notEqual(flagged.binary, sibling.binary);

      // 4. What the build never reads keeps the answer.
      write(path.join(module, "node_modules", "pkg", "index.js"), "// moved\n");
      assert.deepEqual(resolve(), flagged);
    } finally {
      apply(saved);
    }
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
