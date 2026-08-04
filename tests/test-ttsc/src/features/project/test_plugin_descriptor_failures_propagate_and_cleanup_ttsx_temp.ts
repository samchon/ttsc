import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies descriptor failures propagate across setup surfaces and clean up.
 *
 * The generated loader lives in a private temporary directory and executable
 * descriptor evaluation precedes CLI, API, and LSP setup. Each returned failure
 * must therefore preserve its cause without leaving loader artifacts; a
 * successful evaluator must clean up before later descriptor validation too.
 *
 * 1. Drive non-zero, enveloped, foreign-result, missing, malformed, and successful
 *    results.
 * 2. Assert each API result is distinct and its loader directory is removed.
 * 3. Assert only a well-formed envelope becomes the failure reason.
 * 4. Assert the non-zero cause also reaches CLI and LSP startup unchanged.
 */
export const test_plugin_descriptor_failures_propagate_and_cleanup_ttsx_temp =
  (): void => {
    const root = TestProject.tmpdir("ttsc-descriptor-bound-");
    const descriptorRoot = path.join(root, "descriptor");
    fs.mkdirSync(descriptorRoot, { recursive: true });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(descriptorRoot, "runtime.ts"),
      'export const runtime = "descriptor";\n',
      "utf8",
    );
    fs.writeFileSync(
      path.join(descriptorRoot, "index.ts"),
      [
        'export * from "./runtime";',
        'export default { name: "unreached", source: "./absent" };',
        "",
      ].join("\n"),
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
        '      JSON.stringify({ name: "fake-success", source: "./absent-source" }),',
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
    for (const testCase of apiCases) {
      const result = runNodeSurface({
        args: [apiWorker],
        fakeTtsx,
        marker: path.join(root, `api-${testCase.mode}.txt`),
        mode: testCase.mode,
        root,
      });
      assert.equal(result.status, 1, testCase.mode);
      assert.match(result.stderr, testCase.pattern, testCase.mode);
      if ("absent" in testCase) {
        assert.doesNotMatch(result.stderr, testCase.absent, testCase.mode);
      }
      assertLoaderRemoved(
        path.join(root, `api-${testCase.mode}.txt`),
        testCase.mode,
      );
    }

    const cliMarker = path.join(root, "cli-nonzero.txt");
    const cli = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["prepare", "--cwd", root, "--tsconfig", tsconfig],
      {
        cwd: root,
        env: fakeEnvironment(fakeTtsx, cliMarker, "nonzero"),
      },
    );
    assert.equal(cli.status, 2);
    assert.match(cli.stderr, /plugin descriptor .* failed with exit code 2/);
    assertLoaderRemoved(cliMarker, "CLI");

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
    assert.equal(lsp.status, 1);
    assert.match(
      lsp.stderr,
      /ttscserver: plugin descriptor .* failed with exit code 2/,
    );
    assertLoaderRemoved(lspMarker, "LSP");
  };

function runNodeSurface(options: {
  args: string[];
  fakeTtsx: string;
  marker: string;
  mode: string;
  root: string;
}): ReturnType<typeof TestProject.spawn> {
  return TestProject.spawn(process.execPath, options.args, {
    cwd: options.root,
    env: fakeEnvironment(options.fakeTtsx, options.marker, options.mode),
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
