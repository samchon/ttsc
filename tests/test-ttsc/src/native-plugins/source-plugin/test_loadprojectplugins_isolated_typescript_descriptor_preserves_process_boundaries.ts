import { TestProject } from "@ttsc/testing";

import { assert, fs, path, spawnNodeWorker } from "../../internal/source-build";

/**
 * Verifies isolated TypeScript descriptor evaluation keeps the instance env,
 * stdout protocol, and factory side effects at their declared boundaries.
 *
 * The runtime hook can load a `.cts` descriptor before the ttsx fallback. That
 * child must receive the caller's effective environment, redirect arbitrary
 * descriptor stdout away from the host's protocol stream, and never interpret a
 * factory exception as a loader failure that should execute the factory a
 * second time through ttsx.
 *
 * 1. Load an enum-bearing descriptor under contradictory ambient/effective
 *    environments and make its factory throw after one observable write.
 * 2. Assert descriptor stdout reaches stderr, the effective value wins, and the
 *    factory ran once.
 * 3. Replace it with a top-level side-effect-plus-throw and assert that module
 *    initialization also runs once instead of being retried through ttsx.
 * 4. Give a user error a loader-like `code` and assert that mutable metadata alone
 *    cannot trigger the fallback or duplicate its side effect.
 * 5. Create a TypeScript candidate only after a genuine resolution failure and
 *    assert retry classification remains bound to the failure-time snapshot.
 * 6. Put a directory at a TypeScript candidate path and assert it is not mistaken
 *    for source that the fallback could load.
 */
export const test_loadprojectplugins_isolated_typescript_descriptor_preserves_process_boundaries =
  async () => {
    const root = TestProject.tmpdir("ttsc-isolated-ts-descriptor-");
    const descriptor = path.join(root, "plugin.cts");
    const counter = path.join(root, "factory-runs.txt");
    fs.writeFileSync(
      descriptor,
      [
        `const fs = require("node:fs");`,
        `enum Loaded { Value = "loaded" }`,
        `console.log("DESCRIPTOR_STDOUT_MARKER", Loaded.Value);`,
        `export = () => {`,
        `  fs.appendFileSync(${JSON.stringify(counter)}, "run\\n");`,
        `  throw new Error("factory-env:" + process.env.TTSC_DESC_MARKER);`,
        `};`,
        "",
      ].join("\n"),
      "utf8",
    );
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: descriptor }] },
      }),
      "utf8",
    );

    const loadProjectPluginsPath = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "plugin",
      "internal",
      "load",
      "loadProjectPlugins.js",
    );
    const script = path.join(root, "load-worker.cjs");
    fs.writeFileSync(
      script,
      [
        `const { loadProjectPlugins } = require(${JSON.stringify(loadProjectPluginsPath)});`,
        "try {",
        "  loadProjectPlugins({",
        '    binary: "",',
        '    env: { ...process.env, TTSC_DESC_MARKER: "effective" },',
        `    tsconfig: ${JSON.stringify(tsconfig)},`,
        "  });",
        '} catch (error) { process.stderr.write(String(error?.message ?? error) + "\\n"); }',
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_DESC_MARKER: "ambient",
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      },
      script,
    });

    assert.equal(result.stdout, "");
    assert.match(result.stderr, /DESCRIPTOR_STDOUT_MARKER loaded/);
    assert.match(result.stderr, /factory-env:effective/);
    assert.equal(/factory-env:ambient/.test(result.stderr), false);
    assert.equal(fs.readFileSync(counter, "utf8"), "run\n");

    const moduleCounter = path.join(root, "module-runs.txt");
    const moduleDescriptor = path.join(root, "module.cts");
    fs.writeFileSync(
      moduleDescriptor,
      [
        `const fs = require("node:fs");`,
        `fs.appendFileSync(${JSON.stringify(moduleCounter)}, "run\\n");`,
        `throw new Error("module-initialization:loaded");`,
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: moduleDescriptor }] },
      }),
      "utf8",
    );
    const moduleResult = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_DESC_MARKER: "ambient",
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      },
      script,
    });
    assert.match(moduleResult.stderr, /module-initialization:loaded/);
    assert.equal(fs.readFileSync(moduleCounter, "utf8"), "run\n");

    const counterfeitCounter = path.join(root, "counterfeit-runs.txt");
    const fallbackMarker = path.join(root, "counterfeit-fallback.txt");
    const fakeTtsx = path.join(root, "counterfeit-ttsx.cjs");
    const counterfeitDescriptor = path.join(root, "counterfeit.cts");
    fs.writeFileSync(
      fakeTtsx,
      `require("node:fs").writeFileSync(${JSON.stringify(fallbackMarker)}, "ran");\n`,
      "utf8",
    );
    fs.writeFileSync(
      counterfeitDescriptor,
      [
        `const fs = require("node:fs");`,
        `fs.appendFileSync(${JSON.stringify(counterfeitCounter)}, "run\\n");`,
        `const failure = new TypeError("user-assigned loader code");`,
        `Object.assign(failure, { code: "ERR_UNKNOWN_FILE_EXTENSION" });`,
        `throw failure;`,
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: counterfeitDescriptor }] },
      }),
      "utf8",
    );
    const counterfeitResult = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        TTSC_TTSX_BINARY: fakeTtsx,
      },
      script,
    });
    assert.match(counterfeitResult.stderr, /user-assigned loader code/);
    assert.equal(fs.readFileSync(counterfeitCounter, "utf8"), "run\n");
    assert.equal(fs.existsSync(fallbackMarker), false);

    const missingCounter = path.join(root, "counterfeit-missing-runs.txt");
    const missingDescriptor = path.join(root, "counterfeit-missing.cts");
    fs.writeFileSync(
      path.join(root, "phantom.ts"),
      "export const value = 1;\n",
    );
    fs.writeFileSync(
      missingDescriptor,
      [
        `const fs = require("node:fs");`,
        `fs.appendFileSync(${JSON.stringify(missingCounter)}, "run\\n");`,
        `const failure = new Error("Cannot find module './phantom'");`,
        `Object.assign(failure, { code: "MODULE_NOT_FOUND", requireStack: [__filename] });`,
        `throw failure;`,
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: missingDescriptor }] },
      }),
      "utf8",
    );
    const missingResult = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        TTSC_TTSX_BINARY: fakeTtsx,
      },
      script,
    });
    assert.match(missingResult.stderr, /Cannot find module '\.\/phantom'/);
    assert.equal(fs.readFileSync(missingCounter, "utf8"), "run\n");
    assert.equal(fs.existsSync(fallbackMarker), false);

    const mutatedCounter = path.join(root, "mutated-missing-runs.txt");
    const mutatedDescriptor = path.join(root, "mutated-missing.cts");
    fs.writeFileSync(
      mutatedDescriptor,
      [
        `const fs = require("node:fs");`,
        `fs.appendFileSync(${JSON.stringify(mutatedCounter)}, "run\\n");`,
        `try { require("./actually-missing"); } catch (failure) {`,
        `  failure.message = "Cannot find module './phantom'";`,
        `  failure.requireStack = [__filename];`,
        `  throw failure;`,
        `}`,
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: mutatedDescriptor }] },
      }),
      "utf8",
    );
    const mutatedResult = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        TTSC_TTSX_BINARY: fakeTtsx,
      },
      script,
    });
    assert.match(mutatedResult.stderr, /Cannot find module '\.\/phantom'/);
    assert.equal(fs.readFileSync(mutatedCounter, "utf8"), "run\n");
    assert.equal(fs.existsSync(fallbackMarker), false);

    const lateCounter = path.join(root, "late-candidate-runs.txt");
    const lateCandidate = path.join(root, "late-candidate.ts");
    const lateDescriptor = path.join(root, "late-candidate-race.cts");
    fs.writeFileSync(
      lateDescriptor,
      [
        `const fs = require("node:fs");`,
        `fs.appendFileSync(${JSON.stringify(lateCounter)}, "run\\n");`,
        `try { require("./late-candidate"); } catch (failure) {`,
        `  fs.writeFileSync(${JSON.stringify(lateCandidate)}, "export const value = 1;\\n");`,
        `  throw failure;`,
        `}`,
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: lateDescriptor }] },
      }),
      "utf8",
    );
    const lateResult = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        TTSC_TTSX_BINARY: fakeTtsx,
      },
      script,
    });
    assert.equal(fs.readFileSync(lateCounter, "utf8"), "run\n");
    assert.equal(fs.existsSync(lateCandidate), true);
    assert.equal(fs.existsSync(fallbackMarker), false);
    assert.match(lateResult.stderr, /Cannot find module '\.\/late-candidate'/);

    const directoryCounter = path.join(root, "directory-candidate-runs.txt");
    const directoryCandidate = path.join(root, "directory-candidate.ts");
    const directoryDescriptor = path.join(root, "directory-candidate-race.cts");
    fs.mkdirSync(directoryCandidate);
    fs.writeFileSync(
      directoryDescriptor,
      [
        `const fs = require("node:fs");`,
        `fs.appendFileSync(${JSON.stringify(directoryCounter)}, "run\\n");`,
        `require("./directory-candidate");`,
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: directoryDescriptor }] },
      }),
      "utf8",
    );
    const directoryResult = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        TTSC_TTSX_BINARY: fakeTtsx,
      },
      script,
    });
    assert.equal(fs.readFileSync(directoryCounter, "utf8"), "run\n");
    assert.equal(fs.existsSync(fallbackMarker), false);
    assert.match(
      directoryResult.stderr,
      /Cannot find module '\.\/directory-candidate'/,
    );
  };
