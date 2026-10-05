import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";
import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { createAliasPaths } from "../../../../../packages/unplugin/src/core/transform/alias/createAliasPaths";
import { createTransformScratchDirectory } from "../../../../../packages/unplugin/src/core/transform/tsconfig/createTransformScratchDirectory";
import { createTransformTsconfig } from "../../../../../packages/unplugin/src/core/transform/tsconfig/createTransformTsconfig";
import { readTransformTsconfigState } from "../../../../../packages/unplugin/src/core/transform/tsconfig/readTransformTsconfigState";

/**
 * Verifies generated configuration preserves path anchors and plugin payloads.
 *
 * The real materializer writes a native scratch wrapper, read independently as
 * JSON. This tests configuration preparation, not native plugin execution or
 * compiler diagnostics. Literal protocol paths use native path.join anchors
 * and forward-slash encoding independently of the production alias readers.
 * Two actual alias translations retain the absolute @lib mapping, withhold a
 * regex silently and report the wildcard description once. The testbody restores
 * stderr's exact own descriptor without resetting the reporter's private state.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls readTransformTsconfigState/createAliasPaths/createTransformTsconfig/resolveOptions over real JSONC and package-manifest presets. Actual wrapper JSON must extend the selected config, preserve inherited and inline mappings, add absolute bundler exact/subtree mappings, avoid invented baseUrl and anchor plugin config/configFile/transform paths at the project rather than scratch.
 * @evidence contracts/testing.md#independent-expectations Literal inherited #lib/#preset, inline #inline and bundler @lib mappings identify expected addresses. Authored prefix/upper/suffix entries and untouched payload fields fix order and preservation independently; expected values never call the materializer, paths reader or normalization under test.
 * @evidence contracts/testing.md#distinguishing-cases JSONC inheritance and package.json tsconfig selection contrast with an unchanged no-overlay config. Relative path-typed plugin fields contrast with opaque payload and package specifiers; top-level ordered plugin options contrast with inline compilerOptions plugins. Top-level-only caller props keep the original config; combined caller props materialize only the normalized inline list and leave the separate native override channel unchanged. Find-only trailing slash retains its distinct grammar while both-sided trailing slashes normalize together. Actual allocator rows contrast direct/aliased project temp parents with an outside native alias; independently observed realpaths prove physical refusal and canonical returned ownership without compiler capture. Saved temp environment and owned empty children are restored/released in finally.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit owns these actual filesystem/configuration operations in process. It installs nothing and starts no compiler, Go peer, plugin binary or host. Native type errors, banner output, plugin execution order and forwarded configFile evidence remain E2E producer/consumer connections; JSON preparation is not their certificate.
 */
export function test_generated_tsconfig_preserves_alias_and_plugin_option_boundaries(): void {
  const aliasRoot = TestProject.tmpdir("ttsc-alias-notice-policy-");
  const aliasTarget = path.join(aliasRoot, "src", "library");
  const aliasNotices: string[] = [];
  const stderrWrite = Object.getOwnPropertyDescriptor(process.stderr, "write");
  try {
    Object.defineProperty(process.stderr, "write", {
      configurable: true,
      writable: true,
      value: (chunk: string | Uint8Array): boolean => {
        aliasNotices.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
        return true;
      },
    });
    const declaredAliases = [
      { find: "@glob/*", replacement: aliasTarget },
      { find: /^~/, replacement: aliasTarget },
      { find: "@lib", replacement: aliasTarget },
    ];
    for (let delivery = 0; delivery < 2; delivery++) {
      assert.deepEqual(createAliasPaths(declaredAliases), {
        "@lib": [aliasTarget.replace(/\\/g, "/")],
        "@lib/*": [path.join(aliasTarget, "*").replace(/\\/g, "/")],
      });
      assert.deepEqual(aliasNotices, [
        'ttsc: the Vite alias "@glob/*" was not forwarded to the compile, because a "paths" key already reads "*" as its own wildcard. Declare it in your tsconfig\'s "paths" if ttsc must resolve through it.\n',
      ], "wildcard reporting is once per description; regex withholding is silent");
    }
  } finally {
    if (stderrWrite === undefined) delete (process.stderr as { write?: unknown }).write;
    else Object.defineProperty(process.stderr, "write", stderrWrite);
  }
  for (const preset of [false, true]) {
    const root = TestProject.tmpdir("ttsc-config-policy-unit-");
    const scratch = TestProject.tmpdir("ttsc-config-policy-scratch-");
    const inheritedKey = preset ? "#preset/*" : "#lib/*";
    const baseDirectory = preset ? path.join(root, "node_modules", "example-preset") : root;
    const base = path.join(baseDirectory, "base.json");
    TestProject.writeFiles(root, {
      "src/main.ts": "export const kept = 1;\n",
      "plugin.cjs": "module.exports = () => {};\n",
      "config/banner.config.json": '{"ok":true}',
      "fixture.config.json": '{"ok":true}',
      "tsconfig.json": JSON.stringify({
        compilerOptions: { plugins: [] },
        extends: preset ? "example-preset" : "./base.json",
        include: ["src"],
      }),
    });
    fs.mkdirSync(baseDirectory, { recursive: true });
    fs.writeFileSync(base, '{\n// inherited JSONC mapping\n"compilerOptions":{"paths":{"' + inheritedKey + '":["./types/*"]}},\n}\n');
    if (preset) fs.writeFileSync(path.join(baseDirectory, "package.json"), JSON.stringify({ name: "example-preset", version: "1.0.0", tsconfig: ".\\base.json" }));
    const tsconfig = path.join(root, "tsconfig.json");
    const slash = (file: string): string => file.replace(/\\/g, "/");
    const state = readTransformTsconfigState(tsconfig, true, root);
    assert.deepEqual(state.effectivePaths, {
      [inheritedKey]: [slash(path.join(baseDirectory, "types", "*"))],
    });
    const target = path.join(root, "src", "modules");
    const aliases = createAliasPaths({ "@lib": target });
    assert.deepEqual(aliases, {
      "@lib": [slash(target)], "@lib/*": [slash(path.join(target, "*"))],
    });
    const inlinePlugins = [{
      transform: "./plugin.cjs", name: "fixture", config: "./fixture.config.json",
      configFile: "./config/banner.config.json", operation: "kept-operation",
      path: "./opaque-payload", prefix: "a:",
    }, { transform: "package-plugin", name: "package" }];
    const materialized = createTransformTsconfig({
      aliasPaths: aliases,
      compilerOptions: { plugins: inlinePlugins, paths: { "#inline/*": ["./inline/*"] } },
      tsconfig,
    }, scratch, state, { configDir: root, tsconfig });
    assert.equal(materialized.path, path.join(scratch, "tsconfig.json"));
    const wrapper = JSON.parse(fs.readFileSync(materialized.path, "utf8"));
    assert.equal(wrapper.extends, slash(tsconfig));
    assert.equal(Object.prototype.hasOwnProperty.call(wrapper.compilerOptions, "baseUrl"), false);
    assert.deepEqual(wrapper.compilerOptions.paths, {
      [inheritedKey]: [slash(path.join(baseDirectory, "types", "*"))],
      "#inline/*": [slash(path.join(root, "inline", "*"))],
      "@lib": [slash(target)], "@lib/*": [slash(path.join(target, "*"))],
    });
    assert.deepEqual(wrapper.compilerOptions.plugins, [{
      transform: path.join(root, "plugin.cjs"), name: "fixture",
      config: path.join(root, "fixture.config.json"),
      configFile: path.join(root, "config", "banner.config.json"),
      operation: "kept-operation", path: "./opaque-payload", prefix: "a:",
    }, { transform: "package-plugin", name: "package" }]);
    assert.equal(inlinePlugins[0]!.config, "./fixture.config.json", "normalization does not mutate caller entries");
    assert.equal(inlinePlugins[0]!.configFile, "./config/banner.config.json");
    assert.equal(createTransformTsconfig({ aliasPaths: {}, compilerOptions: {}, tsconfig }, scratch, state, { configDir: root, tsconfig }).path, tsconfig);
    const ordered = [{ transform: "./plugin.cjs", name: "prefix", prefix: "a:" }, { transform: "./plugin.cjs", name: "upper" }, { transform: "./plugin.cjs", name: "suffix", suffix: ":z" }];
    const resolved = resolveOptions({ plugins: ordered });
    assert.equal(resolved.plugins, ordered);
    assert.deepEqual((resolved.plugins as typeof ordered).map((entry) => entry.name), ["prefix", "upper", "suffix"]);
    const inline = resolveOptions({ compilerOptions: { plugins: inlinePlugins } });
    assert.equal(inline.plugins, undefined);
    assert.equal(inline.compilerOptions.plugins, inlinePlugins);
    // Capture passes these two channels separately: compilerOptions into the
    // wrapper and top-level plugins directly into TtscCompiler. Do not merge
    // them in a unit fixture and then claim the production caller did so.
    const topLevelOnly = {
      aliasPaths: {}, compilerOptions: resolved.compilerOptions,
      plugins: resolved.plugins, tsconfig,
    };
    assert.equal(createTransformTsconfig(topLevelOnly, scratch, state,
      { configDir: root, tsconfig }).path, tsconfig,
      "top-level compiler overrides alone do not materialize a wrapper");
    const bothChannels = resolveOptions({
      plugins: ordered,
      compilerOptions: { plugins: inlinePlugins },
    });
    const callerProps = {
      aliasPaths: {}, compilerOptions: bothChannels.compilerOptions,
      plugins: bothChannels.plugins, tsconfig,
    };
    const separated = createTransformTsconfig(callerProps, scratch, state,
      { configDir: root, tsconfig });
    assert.equal(separated.path, path.join(scratch, "tsconfig.json"));
    const separatedWrapper = JSON.parse(fs.readFileSync(separated.path, "utf8"));
    assert.deepEqual(separatedWrapper.compilerOptions.plugins, [{
      transform: path.join(root, "plugin.cjs"), name: "fixture",
      config: path.join(root, "fixture.config.json"),
      configFile: path.join(root, "config", "banner.config.json"),
      operation: "kept-operation", path: "./opaque-payload", prefix: "a:",
    }, { transform: "package-plugin", name: "package" }],
    "the wrapper preserves inline order and payload without adding top-level overrides");
    assert.equal(callerProps.plugins, ordered);
    assert.deepEqual(ordered, [
      { transform: "./plugin.cjs", name: "prefix", prefix: "a:" },
      { transform: "./plugin.cjs", name: "upper" },
      { transform: "./plugin.cjs", name: "suffix", suffix: ":z" },
    ], "wrapper normalization leaves the separate override channel unchanged");
    assert.equal(inlinePlugins[0]!.transform, "./plugin.cjs");
    assert.equal(inlinePlugins[0]!.config, "./fixture.config.json");
    assert.deepEqual(createAliasPaths([{ find: "@trail/", replacement: target }]), {
      "@trail//*": [slash(target) + "/*"],
    });
    assert.deepEqual(createAliasPaths([{ find: "@trail/", replacement: slash(target) + "/" }]), {
      "@trail": [slash(target)], "@trail/*": [slash(target) + "/*"],
    });
  }
  const physical = fs.realpathSync.native(TestProject.tmpdir("ttsc-scratch-policy-unit-"));
  const inside = path.join(physical, "inside-temp");
  const aliases = TestProject.tmpdir("ttsc-scratch-policy-alias-");
  const insideAlias = path.join(aliases, "inside");
  const outside = fs.realpathSync.native(TestProject.tmpdir("ttsc-scratch-policy-outside-"));
  const outsideAlias = path.join(aliases, "outside");
  fs.mkdirSync(inside);
  fs.symlinkSync(inside, insideAlias, process.platform === "win32" ? "junction" : "dir");
  fs.symlinkSync(outside, outsideAlias, process.platform === "win32" ? "junction" : "dir");
  assert.equal(fs.realpathSync.native(insideAlias), inside);
  assert.equal(fs.realpathSync.native(outsideAlias), outside);
  const previous = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
  try {
    for (const [label, candidate] of [["inside", inside], ["inside alias", insideAlias], ["outside alias", outsideAlias]] as const) {
      process.env.TEMP = candidate;
      process.env.TMP = candidate;
      process.env.TMPDIR = candidate;
      const scratch = createTransformScratchDirectory(physical);
      try {
        assert.equal(fs.realpathSync.native(scratch), scratch, label + ": return the observed physical child");
        const relative = path.relative(physical, scratch);
        assert.ok(relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative), label + ": accepted scratch is outside the physical project");
        if (label === "outside alias") assert.equal(path.dirname(scratch), outside, "the native temporary parent alias resolves before allocation");
        assert.deepEqual(fs.readdirSync(scratch), [], "the caller owns one new empty directory");
      } finally {
        fs.rmdirSync(scratch);
      }
      assert.equal(fs.existsSync(scratch), false);
      assert.equal(process.env.TEMP, candidate);
      assert.equal(process.env.TMP, candidate);
      assert.equal(process.env.TMPDIR, candidate);
    }
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.unlinkSync(insideAlias);
    fs.unlinkSync(outsideAlias);
  }
}
