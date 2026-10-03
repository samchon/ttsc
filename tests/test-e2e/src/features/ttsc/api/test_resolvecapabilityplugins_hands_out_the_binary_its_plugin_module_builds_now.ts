import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveCapabilityPlugins } from "ttsc";

import { CapabilityResolutionFormat } from "../../../../../../packages/ttsc/lib/plugin/internal/CapabilityResolutionFormat.js";
import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";
import { nativeBinary } from "../../../internal/ttsc/internal/toolchain";

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
 * A walk records its answer anew and an answer from the cache writes nothing,
 * so the entry's file identity shows whether the cache answered. The descriptor
 * reads nothing the module edit touches, and declares that it reads no file
 * with an empty `hostInputHashes` (samchon/ttsc#1561), so that walk reuses its
 * evaluation, while another environment evaluates it again
 * (samchon/ttsc#1497).
 *
 * 1. Resolve a project whose plugin is a subpackage of its module and declares
 *    `graphNodes`, and resolve again from the cache.
 * 2. Edit a sibling package of the module, and require a walk and a new binary.
 * 3. Change `GOFLAGS`, and require a walk and a new binary.
 * 4. Write below the module's `node_modules`, and require the cached answer.
 *
 * @evidence contracts/testing.md#behavioral-verification Resolves declared graphNodes repeatedly, requires unchanged binary/record identity, then fresh identities after a sibling Go source edit or GOFLAGS change, and unchanged identity after a node_modules write.
 * @evidence contracts/testing.md#independent-expectations The authored source/environment mutations determine change/no-change expectations and descriptor evaluation counts; the synthetic Go helper validates selected module inputs but is not a real artifact-correctness oracle.
 * @evidence contracts/testing.md#distinguishing-cases Cold/warm answers, module-sibling edit, build-environment change and excluded-directory write distinguish build identity from descriptor freshness and irrelevant files.
 * @evidence contracts/testing.md#execution-ownership The named feature invokes the built public resolver, actual descriptor evaluation and a controlled external Go process provider. Native process/loader/cache integration is distinct from direct supplied state, but this provider does not certify a genuine Go-built executable or compiler result.
 * @evidence contracts/e2e.md#necessary-boundary Persistent capability answers must track real descriptor evaluation and selected build inputs across API calls; the synthetic Go provider limits this test to loader/cache integration, with real Go artifact validity owned by native survivors.
 * @evidence contracts/e2e.md#shared-execution One project/module/provider supplies the sequence, retaining unchanged-answer and changed-source/environment contrasts. Evaluation-log counts and recorded paths/inodes are individual fixture effects, not total process starts, Program generations, cache hits or measured savings; no independent install occurs per transition.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks project/module/log/private cache roots; finally restores every saved environment value. Native record inode equality/replacement is observed, not executable-image identity. Direct synchronous results and eventual tracked-root cleanup do not prove arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Every original count1/binary existence, unchanged binary+record identity, sibling source and GOFLAGS changes, exact evaluation counts1/2 and pruned node_modules stability remains. Inode support and controlled-provider limits stay explicit; no real Go transform proof, positive graph-transfer certification or donor removal is inferred.
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
    // A package scope above the project. Without one, the load reads the
    // missing `root/package.json`, proven absent by the metadata of `root`,
    // which the cold build moves by creating the caches below it: that answer
    // has an unproven input, and a cache records no answer it cannot prove
    // (samchon/ttsc#1504).
    write(path.join(root, "package.json"), '{ "private": true }\n');
    write(
      path.join(project, "plugin.cjs"),
      [
        'const fs = require("node:fs");',
        "module.exports = () => {",
        `  fs.appendFileSync(${JSON.stringify(evaluations)}, "x\\n");`,
        "  return {",
        "    capabilities: { graphNodes: true },",
        "    hostInputHashes: {},",
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
    // The file identity of the recorded answer: a walk renames a new entry
    // into place, while an answer from the cache keeps the file and records its
    // use in the file's times alone (samchon/ttsc#1562).
    const recorded = (): string => {
      const file = CapabilityResolutionFormat.resolutionFile({
        cwd: project,
        tsconfig: "tsconfig.json",
      })!;
      return String(fs.statSync(file, { bigint: true }).ino);
    };
    const resolve = (): { binary: string; entry: string } => {
      const plugins = resolveCapabilityPlugins({
        capability: "graphNodes",
        cwd: project,
        tsconfig: "tsconfig.json",
      });
      assert.equal(plugins.length, 1, "the declaring plugin was not found");
      assert.ok(fs.existsSync(plugins[0]!.binary), plugins[0]!.binary);
      return {
        binary: plugins[0]!.binary,
        entry: recorded(),
      };
    };
    apply(overrides);
    try {
      // 1. A walk, then the cache.
      const first = resolve();
      assert.deepEqual(resolve(), first, "an unchanged project walked again");

      // 2. A sibling package of the module.
      write(
        path.join(module, "internal", "mark", "mark.go"),
        "package mark\n\n// edited\n",
      );
      const sibling = resolve();
      assert.notEqual(
        sibling.entry,
        first.entry,
        "a sibling package edit was not proven",
      );
      assert.notEqual(sibling.binary, first.binary);
      const evaluated = (): number =>
        fs.readFileSync(evaluations, "utf8").split("\n").length - 1;
      assert.equal(
        evaluated(),
        1,
        "the unchanged descriptor was evaluated again",
      );

      // 3. The Go build environment.
      apply({ GOFLAGS: "-tags=ttsc_capability_probe" });
      const flagged = resolve();
      assert.notEqual(
        flagged.entry,
        sibling.entry,
        "another GOFLAGS was not proven",
      );
      assert.notEqual(flagged.binary, sibling.binary);
      assert.equal(evaluated(), 2, "another environment reused the descriptor");

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
