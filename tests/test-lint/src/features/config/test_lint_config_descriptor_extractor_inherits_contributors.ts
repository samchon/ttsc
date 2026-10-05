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
 * 4. Reject cycle, malformed and depth inputs, then require CJS contributor
 *    reloads, invalid-source and collision errors, and an unnamed exit status.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored factory launches its emitted extractor through an explicit Node launcher, resolves inherited and CJS helper/package contributors, and returns exact sources and dependency hashes. Changed inputs re-evaluate while unchanged inputs reuse. Malformed contributor values and namespace collisions reject; a config exiting seven without an envelope retains its single-line status error.
 * @evidence contracts/testing.md#independent-expectations Authored fixture directories identify expected contributor sources; SHA-256 establishes input proof. A valid v9 payload must not supply the v10 result. Literal alpha/beta/demo arrays, required nonempty source and hyphen-to-underscore collision names define contributor policy. Authored process.exit(7) independently requires status seven without an invented reason; the launch counter observes each real evaluator attempt.
 * @evidence contracts/testing.md#distinguishing-cases Existing inheritance, cache, cycle, malformed-path and 32/33-depth outcomes remain. CJS helper and package-only alpha/beta changes contrast with unchanged config bytes; number, missing-source object and malformed required module reject separately. Both a-b/a_b and react-hooks/react_hooks collide; exiting before an envelope contrasts with the valid contributor returns.
 * @evidence contracts/testing.md#execution-ownership One source-unit entry, root, selected JSON path and supported Node launcher execute actual factory/extractor calls. The added ten changed or terminal inputs each require a real evaluator process and assert its launch counter increment. No extra caller, compiler Program, Go source/build or product host is created. Typed acquisition, installed ttsx transport and stdout/stderr isolation remain E2E observations.
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

    const cjsConfig = path.join(root, "nested", "portable.cjs");
    const selection = path.join(root, "nested", "selection.cjs");
    const packageDir = path.join(root, "nested", "node_modules", "demo-contributor");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, "package.json"), '{"main":"index.cjs"}\n');
    const packageEntry = path.join(packageDir, "index.cjs");
    fs.writeFileSync(rootConfig, JSON.stringify({ extends: "./nested/portable.cjs" }));
    cacheFiles.push(cachePath("v10"));
    fs.writeFileSync(cjsConfig, 'module.exports = require("./selection.cjs");\n');
    const launchesBefore = fs.readFileSync(counter, "utf8").split("\n").length - 1;
    let addedLaunches = 0;
    const requireNextLaunch = (): void => {
      assert.equal(
        fs.readFileSync(counter, "utf8").split("\n").length - 1,
        launchesBefore + ++addedLaunches,
        "each changed or terminal input needs one real Node evaluator",
      );
    };
    fs.writeFileSync(selection, `module.exports = { plugins: { alpha: { source: ${JSON.stringify(first)} } } };\n`);
    assert.deepEqual(factory(context).contributors, [{ name: "alpha", source: first }]);
    requireNextLaunch();
    fs.writeFileSync(selection, `module.exports = { plugins: { beta: { source: ${JSON.stringify(second)} } } };\n`);
    assert.deepEqual(factory(context).contributors, [{ name: "beta", source: second }]);
    requireNextLaunch();
    fs.writeFileSync(selection, 'module.exports = { plugins: { demo: "demo-contributor" } };\n');
    fs.writeFileSync(packageEntry, `module.exports = { source: ${JSON.stringify(first)} };\n`);
    assert.deepEqual(factory(context).contributors, [{ name: "demo", source: first }]);
    requireNextLaunch();
    fs.writeFileSync(packageEntry, `module.exports = { source: ${JSON.stringify(second)} };\n`);
    assert.deepEqual(factory(context).contributors, [{ name: "demo", source: second }]);
    requireNextLaunch();

    for (const value of ["42", "{}", '"demo-contributor"']) {
      fs.writeFileSync(selection, `module.exports = { plugins: { demo: ${value} } };\n`);
      fs.writeFileSync(packageEntry, "module.exports = {};\n");
      assert.throws(() => factory(context), /contributor "demo".*source/i, value);
      requireNextLaunch();
    }
    for (const [left, right, goName] of [
      ["a-b", "a_b", "a_b"],
      ["react-hooks", "react_hooks", "react_hooks"],
    ]) {
      fs.writeFileSync(selection, `module.exports = ${JSON.stringify({
        plugins: { [left!]: { source: first }, [right!]: { source: second } },
      })};\n`);
      assert.throws(() => factory(context), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes(rootConfig));
        assert.ok(error.message.includes(`"${left}", "${right}" all normalize to "${goName}"`));
        assert.match(error.message, /contributor namespaces collide/);
        return true;
      });
      requireNextLaunch();
    }
    fs.writeFileSync(cjsConfig, "process.exit(7);\nmodule.exports = { plugins: {} };\n");
    assert.throws(() => factory(context), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /evaluation failed with exit code 7$/);
      assert.equal(error.message.includes("\n"), false);
      return true;
    });
    requireNextLaunch();
    assert.equal(addedLaunches, 10);
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
