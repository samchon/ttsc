import { TestProject } from "@ttsc/testing";

import { assert, fs, path, spawnNodeWorker } from "../../internal/source-build";

/**
 * Verifies a descriptor that fails while its module body runs still hands the
 * caller a reason, not a bare exit status.
 *
 * The generated shim writes a failure envelope into the result file the parent
 * reads, and the parent appends it to the exit-status message. That envelope
 * used to be written only around the factory call, while `await import(...)`
 * sat above the `try` — so a descriptor that could not be imported at all, or
 * that threw while evaluating, produced no envelope and the caller saw only
 * "failed with exit code 1". The two failures are the same kind of fact about
 * the user's descriptor, and both are actionable.
 *
 * The load runs in a plain child `node` with no TypeScript loader registered,
 * and the descriptor opens with an extensionless relative export, so
 * `require()` cannot resolve it and the loader is genuinely forced through
 * `ttsx` — the in-process runner would otherwise never spawn the shim under
 * test.
 *
 * 1. Write a `type: module` project whose `.ts` descriptor throws while its module
 *    body evaluates.
 * 2. Spawn a worker that calls `loadProjectPlugins` against it.
 * 3. Assert the thrown message carries the status _and_ the descriptor's own
 *    reason on the line after it.
 */
export const test_loadprojectplugins_ttsx_descriptor_names_a_failure_from_its_module_body =
  async () => {
    const root = TestProject.tmpdir("ttsc-descriptor-body-");
    // ttsx evaluates the descriptor as an ES module; a `type: module` manifest
    // makes Node treat the `.ts` entry as ESM so ttsx's loader strips its types.
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    const descriptor = path.join(root, "descriptor");
    fs.mkdirSync(descriptor, { recursive: true });
    fs.writeFileSync(
      path.join(descriptor, "runtime.ts"),
      `export const RUNTIME_TAG = "descriptor-runtime";\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(descriptor, "index.ts"),
      [
        // Extensionless relative import: plain-node cannot resolve it, so the
        // load is forced through ttsx and the real shim runs.
        `export * from "./runtime";`,
        `throw new Error("descriptor-module-body-failed");`,
        "",
      ].join("\n"),
      "utf8",
    );
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            plugins: [{ transform: "./descriptor/index.ts" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const loadProjectPluginsPath = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "plugin",
      "internal",
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
        "    env: { ...process.env },",
        `    tsconfig: ${JSON.stringify(tsconfig)},`,
        "  });",
        '  process.stdout.write("NO_ERROR\\n");',
        "  process.exitCode = 2;",
        "} catch (error) {",
        // stdout, so the assertion cannot be satisfied by the shim's own stack
        // reaching stderr. Only the thrown message is examined.
        '  process.stdout.write(String((error && error.message) || error) + "\\n");',
        "  process.exitCode = 1;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      },
      script,
    });

    assert.equal(result.status, 1, result.stderr);
    assert.match(
      result.stdout,
      /failed with exit code 1\ndescriptor-module-body-failed/,
    );
  };
