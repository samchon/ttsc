import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";
import { TestLintPlugin } from "../internal/TestLintPlugin";

/**
 * Verifies inherited contributors and their watched inputs survive extraction.
 *
 * The supported launcher override runs the factory's actual emitted extractor
 * through Node's TypeScript reader. It does not invent a descriptor result or
 * invoke a native compiler. Base paths and string plugins resolve from the file
 * that declares them, and an older cache must not hide the newly followed base.
 *
 * 1. Seed an old-version cache and a JSON root extending a nested script base.
 * 2. Resolve the actual factory and require both inherited registrations and
 *    the base/helper content fingerprints as watched host inputs.
 * 3. Reuse an unchanged result, then edit the base helper, deeper JSON base and
 *    explicitly extended package-local base separately. Require a fresh
 *    evaluation with each new contributor source.
 * 4. Reject a cycle and malformed extends value, and distinguish the supported
 *    32-file chain from one exceeding that same native reader limit.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored factory launches its emitted extractor through an explicit Node launcher, resolves nested JSON/script bases and containing-file-relative string plugins, and returns exact contributor sources and dependency hashes. An unchanged second call reuses its completed cache while helper-only and base-only edits re-evaluate; cycle, malformed-path and over-depth inputs reject.
 * @evidence contracts/testing.md#independent-expectations Authored fixture directories identify the two expected contributor sources; SHA-256 of the base and helper's actual bytes independently establishes input proof. A deliberately valid v9 payload with an unrelated registration must not supply the v10 result, and an external launch counter distinguishes reuse from re-evaluation.
 * @evidence contracts/testing.md#distinguishing-cases An extends-only root contrasts with a base supplying a string-valued plugin and a deeper JSON base. Unchanged bytes, helper-only and base-only edits, an explicit node_modules base, a cycle, a numeric extends value and adjacent 32/33-file depth boundaries retain separate outcomes.
 * @evidence contracts/testing.md#execution-ownership This unit executes current createTtscPlugin and its emitted evaluator source in Node over owned temporary files using the supported launcher override. It neither patches a process API nor builds a native artifact; ttsx compiler integration remains owned by E2E.
 */
export function test_lint_config_descriptor_extractor_inherits_contributors(): void {
  const root = TestProject.tmpdir("ttsc-lint-inherited-contributors-unit-");
  const previous = {
    TTSC_TTSX_BINARY: process.env.TTSC_TTSX_BINARY,
    TTSC_LINT_DISABLE_CONFIG_CACHE: process.env.TTSC_LINT_DISABLE_CONFIG_CACHE,
  };
  const rootConfig = path.join(root, "lint.config.json");
  const base = path.join(root, "nested", "base.mjs");
  const helper = path.join(root, "nested", "plugin.cjs");
  const deepest = path.join(root, "nested", "deeper", "base.json");
  const first = path.join(root, "first-source");
  const second = path.join(root, "second-source");
  const third = path.join(root, "third-source");
  const counter = path.join(root, "launches.txt");
  const launcher = path.join(root, "node-evaluator.mjs");
  const cacheFiles: string[] = [];
  try {
    for (const directory of [path.dirname(deepest), first, second, third]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(rootConfig, JSON.stringify({ extends: "./nested/base.mjs" }));
    fs.writeFileSync(base, 'export default { extends: "./deeper/base.json", plugins: { demo: "./plugin.cjs" } };\n');
    fs.writeFileSync(deepest, JSON.stringify({ plugins: { deeper: { source: third } } }));
    fs.writeFileSync(helper, `module.exports = { source: ${JSON.stringify(first)} };\n`);
    fs.writeFileSync(launcher, [
      'import fs from "node:fs";',
      'import { pathToFileURL } from "node:url";',
      `fs.appendFileSync(${JSON.stringify(counter)}, "run\\n");`,
      'await import(pathToFileURL(process.argv.at(-1)).href);',
    ].join("\n"));
    process.env.TTSC_TTSX_BINARY = launcher;
    delete process.env.TTSC_LINT_DISABLE_CONFIG_CACHE;
    const cacheDir = path.join(os.tmpdir(), "ttsc-lint-config-cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachePath = (version: string): string => path.join(cacheDir, `${createHash("sha256")
      .update(version).update("\0").update(`plugins\0${root}`).update("\0")
      .update(rootConfig).update("\0").update(fs.readFileSync(rootConfig)).digest("hex")}.json`);
    const oldCache = cachePath("v9");
    cacheFiles.push(oldCache, cachePath("v10"));
    fs.writeFileSync(oldCache, JSON.stringify({
      entries: [{ namespace: "old", source: second }],
      dependencies: [{
        digest: digest(rootConfig), identityStable: true, kind: "file",
        path: rootConfig, realpath: fs.realpathSync.native(rootConfig), scope: "watch",
      }],
    }));
    const context = {
      ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint", configFile: rootConfig }),
      cwd: root, pluginConfigDir: root, projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    };
    const factory = TestLintPlugin.loadFactory();
    const expected = [{ name: "deeper", source: third }, { name: "demo", source: first }];
    const initial = factory(context);
    assert.deepEqual(initial.contributors, expected);
    for (const file of [base, helper, deepest]) {
      assert.ok(initial.hostInputs?.includes(file), file);
      assert.equal(initial.hostInputHashes?.[file], digest(file));
    }
    assert.equal(fs.readFileSync(counter, "utf8"), "run\n");
    assert.deepEqual(factory(context).contributors, expected);
    assert.equal(fs.readFileSync(counter, "utf8"), "run\n", "unchanged extraction must reuse");
    fs.writeFileSync(helper, `module.exports = { source: ${JSON.stringify(second)} };\n`);
    assert.deepEqual(factory(context).contributors, [{ name: "deeper", source: third }, { name: "demo", source: second }]);
    assert.equal(fs.readFileSync(counter, "utf8"), "run\nrun\n");
    fs.writeFileSync(deepest, JSON.stringify({ plugins: { deeper: { source: first } } }));
    assert.deepEqual(factory(context).contributors, [{ name: "deeper", source: first }, { name: "demo", source: second }]);
    assert.equal(fs.readFileSync(counter, "utf8"), "run\nrun\nrun\n");
    const packageBase = path.join(root, "node_modules", "base-package", "base.json");
    fs.mkdirSync(path.dirname(packageBase), { recursive: true });
    fs.writeFileSync(packageBase, JSON.stringify({ plugins: { packaged: { source: first } } }));
    fs.writeFileSync(rootConfig, JSON.stringify({ extends: "./node_modules/base-package/base.json" }));
    cacheFiles.push(cachePath("v10"));
    const packaged = factory(context);
    assert.deepEqual(packaged.contributors, [{ name: "packaged", source: first }]);
    assert.ok(packaged.hostInputs?.includes(packageBase));
    assert.equal(packaged.hostInputHashes?.[packageBase], digest(packageBase));
    fs.writeFileSync(packageBase, JSON.stringify({ plugins: { packaged: { source: second } } }));
    assert.deepEqual(factory(context).contributors, [{ name: "packaged", source: second }]);
    fs.writeFileSync(rootConfig, JSON.stringify({ extends: "./lint.config.json" }));
    assert.throws(() => factory(context), /extends cycle detected/);
    fs.writeFileSync(rootConfig, JSON.stringify({ extends: 1 }));
    assert.throws(() => factory(context), /extends must be a non-empty string/);
    const depthDir = path.join(root, "depth");
    fs.mkdirSync(depthDir);
    for (let i = 0; i < 31; ++i) {
      fs.writeFileSync(path.join(depthDir, `${i}.json`), JSON.stringify(i === 30
        ? { plugins: { terminal: { source: third } } }
        : { extends: `./${i + 1}.json` }));
    }
    fs.writeFileSync(rootConfig, JSON.stringify({ extends: "./depth/0.json" }));
    cacheFiles.push(cachePath("v10"));
    assert.deepEqual(factory(context).contributors, [{ name: "terminal", source: third }]);
    fs.writeFileSync(path.join(depthDir, "30.json"), JSON.stringify({ extends: "./31.json" }));
    fs.writeFileSync(path.join(depthDir, "31.json"), JSON.stringify({ plugins: { terminal: { source: third } } }));
    assert.throws(() => factory(context), /extends chain exceeds the depth limit of 32/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const file of cacheFiles) fs.rmSync(file, { force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function digest(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
