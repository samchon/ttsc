import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies descriptor failures propagate across setup surfaces and clean up.
 *
 * The generated loader lives in a private temporary directory and executable
 * descriptor evaluation precedes CLI, API, and LSP setup. The fixture imports
 * an unsupported extension so Node itself emits the loader-classified error
 * that forces the `ttsx` fallback. Each returned failure must preserve its
 * cause without leaving loader artifacts; a successful evaluator must clean up
 * before later descriptor validation too.
 *
 * 1. Drive non-zero, stdout-only, enveloped, foreign-result, missing, malformed,
 *    and successful results.
 * 2. Assert each API result is distinct and its loader directory is removed.
 * 3. Assert only a well-formed envelope becomes the failure reason.
 * 4. Assert the non-zero cause also reaches CLI and LSP startup unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification Nonzero, stdout-only, enveloped, foreign, missing, malformed and successful evaluator replies preserve distinct API outcomes and remove loader directories; CLI/LSP preserve the nonzero cause.
 * @evidence contracts/testing.md#independent-expectations Authored reply envelopes and sentinel failure text establish which result belongs to the evaluator, independently of the fallback parser.
 * @evidence contracts/testing.md#distinguishing-cases 1. Drive non-zero, stdout-only, enveloped, foreign-result, missing, malformed, and successful results. 2. Assert each API result is distinct and its loader directory is removed. 3. Assert only a well-formed envelope becomes the failure reason. 4. Assert the non-zero cause also reaches CLI and LSP startup unchanged.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner starts actual Node API/CLI/LSP-setup surfaces with an authored fake ttsx responder and a real direct-loader cleanup worker. LSP descriptor rejection precedes native protocol startup; no real LSP session or compiler Program total is asserted.
 * @evidence contracts/e2e.md#necessary-boundary The actual child or host operation exercises the transport and execution result named in this case; direct in-process decision helpers cannot establish that process outcome.
 * @evidence contracts/e2e.md#shared-execution Seven API replies, CLI nonzero, LSP setup nonzero and physical-TEMP retarget share immutable worker/responder and private authored config while keeping distinct markers/outcomes. Ten surface requests are not total nested capability/evaluator/process counts or cache reuse proof; independent errors are collected.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before preparation. Actual sync results separately check error/signal, but do not establish arbitrary descendant join. Marker directories absent at observation certify the original cleanup oracle, not held handles/global namespace atomicity or later descendant absence; native alias retarget is preserved.
 * @evidence contracts/e2e.md#preserved-coverage All seven original status/regex/exclusion/marker/loader-absence rows, CLI2/LSP1 failure text and direct cleanup status1/physical directory absence/two sentinel existence checks remain. Sentinel bytes are not asserted. Runtime/manifest/survival unverified, donor retained and no native LSP session is certified.
 */
export const test_plugin_descriptor_failures_propagate_and_cleanup_ttsx_temp =
  (): void => {
    const root = TestProject.tmpdir("ttsc-descriptor-bound-");
    TestProject.retainTemporaryDirectory(
      root,
      "Descriptor surface descendants are not joined",
    );
    const descriptorRoot = path.join(root, "descriptor");
    fs.mkdirSync(descriptorRoot, { recursive: true });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(descriptorRoot, "index.ts"),
      [
        'import "./unsupported.xyz";',
        'export default { name: "unreached", source: "./absent" };',
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(descriptorRoot, "unsupported.xyz"),
      "export default 1;\n",
      "utf8",
    );
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          plugins: [{ transform: "./descriptor/index.ts" }],
        },
      }),
      "utf8",
    );

    const fakeTtsx = path.join(root, "fake-ttsx.cjs");
    fs.writeFileSync(
      fakeTtsx,
      [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const loaderDir = path.dirname(process.argv.at(-1));",
        'fs.writeFileSync(process.env.TTSC_FAKE_DESCRIPTOR_MARKER, loaderDir, "utf8");',
        "if (process.env.TTSC_EXPECT_PLUGIN_CONFIG_DIR) {",
        "  const context = JSON.parse(process.env.TTSC_PLUGIN_CONTEXT);",
        "  if (context.pluginConfigDir !== process.env.TTSC_EXPECT_PLUGIN_CONFIG_DIR) {",
        "    throw new Error(`pluginConfigDir mismatch: ${JSON.stringify(context.pluginConfigDir)}`);",
        "  }",
        "}",
        "switch (process.env.TTSC_FAKE_DESCRIPTOR_MODE) {",
        '  case "nonzero":',
        "    for (let i = 1; i <= 7; i++) console.error(`descriptor failure ${i}`);",
        "    process.exit(2);",
        '  case "stdout-nonzero":',
        '    console.log("stdout-only descriptor failure");',
        "    process.exit(5);",
        '  case "envelope":',
        '    console.error("envelope stack line");',
        "    fs.writeFileSync(",
        "      process.env.TTSC_PLUGIN_DESCRIPTOR_OUT,",
        '      JSON.stringify({ __ttscLoaderError: "  the descriptor said why  " }),',
        '      "utf8",',
        "    );",
        "    process.exit(4);",
        '  case "foreign-result":',
        "    fs.writeFileSync(",
        "      process.env.TTSC_PLUGIN_DESCRIPTOR_OUT,",
        '      JSON.stringify({ name: "not-an-envelope", source: "./absent" }),',
        '      "utf8",',
        "    );",
        "    process.exit(6);",
        '  case "missing":',
        "    process.exit(0);",
        '  case "malformed":',
        '    fs.writeFileSync(process.env.TTSC_PLUGIN_DESCRIPTOR_OUT, "{bad", "utf8");',
        "    process.exit(0);",
        '  case "success":',
        "    fs.writeFileSync(",
        "      process.env.TTSC_PLUGIN_DESCRIPTOR_OUT,",
        '      JSON.stringify({ descriptor: { name: "fake-success", source: "./absent-source" } }),',
        '      "utf8",',
        "    );",
        "    process.exit(0);",
        "  default:",
        '    throw new Error("unknown fake descriptor mode");',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const apiWorker = path.join(root, "api-worker.cjs");
    fs.writeFileSync(
      apiWorker,
      [
        `const { TtscCompiler } = require(${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "index.js"))});`,
        "try {",
        "  new TtscCompiler({",
        `    cwd: ${JSON.stringify(root)},`,
        "    env: process.env,",
        `    pluginConfigDir: ${JSON.stringify(root)},`,
        `    tsconfig: ${JSON.stringify(tsconfig)},`,
        "  }).prepare();",
        '  process.stderr.write("NO_ERROR\\n");',
        "  process.exitCode = 2;",
        "} catch (error) {",
        '  process.stderr.write(String(error?.message ?? error) + "\\n");',
        "  process.exitCode = 1;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const apiCases = [
      {
        mode: "nonzero",
        // The descriptor's own lines reach stderr as it writes them, so they
        // are present in the output but not folded into the failure message.
        pattern: /descriptor failure 7[\s\S]*failed with exit code 2/,
      },
      {
        mode: "stdout-nonzero",
        pattern: /stdout-only descriptor failure[\s\S]*failed with exit code 5/,
      },
      {
        // A well-formed envelope is the loader's one way to hand the caller a
        // reason it can act on, now that the child's output streams past this
        // process instead of being collected out of it. The reason is trimmed
        // and joined to the status on its own line.
        mode: "envelope",
        pattern: /failed with exit code 4\nthe descriptor said why\n/,
      },
      {
        // The negative twin: a result file that parses but carries no envelope
        // key is not a reason. Honouring it would let any descriptor output
        // become the failure message.
        absent: /not-an-envelope/,
        mode: "foreign-result",
        pattern: /failed with exit code 6/,
      },
      {
        mode: "missing",
        pattern: /produced no descriptor output/,
      },
      {
        mode: "malformed",
        pattern: /produced invalid JSON/,
      },
      {
        mode: "success",
        pattern: /plugin "fake-success" source does not exist/,
      },
    ] as const;
    const failures: unknown[] = [];
    for (const testCase of apiCases) {
      try {
        const result = runNodeSurface({
          args: [apiWorker],
          fakeTtsx,
          marker: path.join(root, `api-${testCase.mode}.txt`),
          mode: testCase.mode,
          root,
        });
        assert.equal(result.error, undefined, testCase.mode);
        assert.equal(result.signal, null, testCase.mode);
        assert.equal(result.status, 1, testCase.mode);
        assert.match(result.stderr, testCase.pattern, testCase.mode);
        assert.doesNotMatch(
          result.stderr,
          /ERR_UNKNOWN_FILE_EXTENSION|Unknown file extension/,
          `${testCase.mode} leaked the discarded direct-loader diagnostic`,
        );
        if ("absent" in testCase) {
          assert.doesNotMatch(result.stderr, testCase.absent, testCase.mode);
        }
        assertLoaderRemoved(
          path.join(root, `api-${testCase.mode}.txt`),
          testCase.mode,
        );
      } catch (error) {
        failures.push(new Error(testCase.mode, { cause: error }));
      }
    }

    try {
      const cliMarker = path.join(root, "cli-nonzero.txt");
      const cli = TestProject.spawn(
        TestProject.TTSC_BIN,
        ["prepare", "--cwd", root, "--tsconfig", tsconfig],
        {
          cwd: root,
          env: fakeEnvironment(fakeTtsx, cliMarker, "nonzero"),
        },
      );
      assert.equal(cli.error, undefined);
      assert.equal(cli.signal, null);
      assert.equal(cli.status, 2);
      assert.match(cli.stderr, /plugin descriptor .* failed with exit code 2/);
      assertLoaderRemoved(cliMarker, "CLI");
    } catch (error) {
      failures.push(new Error("CLI", { cause: error }));
    }

    try {
      const lspMarker = path.join(root, "lsp-nonzero.txt");
      const ttscserverLauncher = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "lib",
        "launcher",
        "ttscserver.js",
      );
      const lsp = TestProject.spawn(
        process.execPath,
        [ttscserverLauncher, "--stdio", "--cwd", root, "--tsconfig", tsconfig],
        {
          cwd: root,
          env: {
            ...fakeEnvironment(fakeTtsx, lspMarker, "nonzero"),
            // Descriptor setup fails before the launcher can execute this binary.
            TTSCSERVER_BINARY: TestProject.NATIVE_BINARY,
          },
        },
      );
      assert.equal(lsp.error, undefined);
      assert.equal(lsp.signal, null);
      assert.equal(lsp.status, 1);
      assert.match(
        lsp.stderr,
        /ttscserver: plugin descriptor .* failed with exit code 2/,
      );
      assertLoaderRemoved(lspMarker, "LSP");
    } catch (error) {
      failures.push(new Error("LSP setup", { cause: error }));
    }

    try {
      assertEvaluatorCleanupPinsPhysicalTempDirectory(root);
    } catch (error) {
      failures.push(new Error("Physical TEMP cleanup", { cause: error }));
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "Descriptor failure surface profiles failed",
      );
  };

/** Cleanup must not follow a TEMP/TMPDIR alias retargeted by the descriptor. */
function assertEvaluatorCleanupPinsPhysicalTempDirectory(root: string): void {
  const safeTemp = path.join(root, "cleanup-safe-temp");
  const retargetTemp = path.join(root, "cleanup-retarget-temp");
  const tempAlias = path.join(root, "cleanup-temp-alias");
  const marker = path.join(root, "cleanup-evaluator-dir.txt");
  const sentinel = path.join(root, "cleanup-victim-sentinel.txt");
  fs.mkdirSync(safeTemp);
  fs.mkdirSync(retargetTemp);
  fs.symlinkSync(
    safeTemp,
    tempAlias,
    process.platform === "win32" ? "junction" : "dir",
  );

  const descriptor = path.join(root, "cleanup-descriptor.cjs");
  fs.writeFileSync(
    descriptor,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "const evaluatorDir = path.dirname(process.env.TTSC_PLUGIN_DESCRIPTOR_OUT);",
      'fs.writeFileSync(process.env.TTSC_TEST_EVALUATOR_MARKER, evaluatorDir, "utf8");',
      "fs.rmSync(process.env.TTSC_TEST_TEMP_ALIAS, { force: true, recursive: true });",
      'fs.symlinkSync(process.env.TTSC_TEST_TEMP_RETARGET, process.env.TTSC_TEST_TEMP_ALIAS, process.platform === "win32" ? "junction" : "dir");',
      "const victim = path.join(process.env.TTSC_TEST_TEMP_RETARGET, path.basename(evaluatorDir));",
      "fs.mkdirSync(victim, { recursive: true });",
      'fs.writeFileSync(process.env.TTSC_TEST_TEMP_SENTINEL, "owned", "utf8");',
      'fs.writeFileSync(path.join(victim, "sentinel.txt"), "owned", "utf8");',
      `module.exports = { name: "cleanup", source: ${JSON.stringify(path.join(root, "absent-cleanup-source"))} };`,
      "",
    ].join("\n"),
    "utf8",
  );
  const tsconfig = path.join(root, "cleanup-tsconfig.json");
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: { plugins: [{ transform: descriptor }] },
    }),
    "utf8",
  );
  const worker = path.join(root, "cleanup-worker.cjs");
  fs.writeFileSync(
    worker,
    [
      `const { TtscCompiler } = require(${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "index.js"))});`,
      "try {",
      `  new TtscCompiler({ cwd: ${JSON.stringify(root)}, env: process.env, tsconfig: ${JSON.stringify(tsconfig)} }).prepare();`,
      "  process.exitCode = 2;",
      "} catch (error) {",
      '  process.stderr.write(String(error?.message ?? error) + "\\n");',
      "  process.exitCode = 1;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  const result = TestProject.spawn(process.execPath, [worker], {
    cwd: root,
    env: {
      TEMP: tempAlias,
      TMP: tempAlias,
      TMPDIR: tempAlias,
      TTSC_NODE_BINARY: process.execPath,
      TTSC_TEST_EVALUATOR_MARKER: marker,
      TTSC_TEST_TEMP_ALIAS: tempAlias,
      TTSC_TEST_TEMP_RETARGET: retargetTemp,
      TTSC_TEST_TEMP_SENTINEL: sentinel,
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(fs.existsSync(marker), true, "direct evaluator did not run");
  const evaluatorDir = fs.readFileSync(marker, "utf8");
  assert.equal(fs.existsSync(evaluatorDir), false, evaluatorDir);
  assert.equal(
    fs.existsSync(sentinel),
    true,
    "descriptor did not retarget TEMP",
  );
  assert.equal(
    fs.existsSync(
      path.join(retargetTemp, path.basename(evaluatorDir), "sentinel.txt"),
    ),
    true,
    "cleanup followed the retargeted TEMP alias into an unrelated directory",
  );
}

function runNodeSurface(options: {
  args: string[];
  fakeTtsx: string;
  marker: string;
  mode: string;
  root: string;
}): ReturnType<typeof TestProject.spawn> {
  return TestProject.spawn(process.execPath, options.args, {
    cwd: options.root,
    env: {
      ...fakeEnvironment(options.fakeTtsx, options.marker, options.mode),
      TTSC_EXPECT_PLUGIN_CONFIG_DIR: options.root,
    },
  });
}

function fakeEnvironment(
  fakeTtsx: string,
  marker: string,
  mode: string,
): NodeJS.ProcessEnv {
  return {
    TTSC_FAKE_DESCRIPTOR_MARKER: marker,
    TTSC_FAKE_DESCRIPTOR_MODE: mode,
    TTSC_NODE_BINARY: process.execPath,
    TTSC_TTSX_BINARY: fakeTtsx,
  };
}

function assertLoaderRemoved(marker: string, label: string): void {
  assert.equal(fs.existsSync(marker), true, `${label} did not run fake ttsx`);
  const loaderDir = fs.readFileSync(marker, "utf8");
  assert.equal(
    fs.existsSync(loaderDir),
    false,
    `${label} retained ${loaderDir}`,
  );
}
