import { TestProject } from "@ttsc/testing";

import { assert, fs, path, spawnNodeWorker } from "../../internal/source-build";

/**
 * Verifies loadProjectPlugins forwards the effective instance environment to
 * the `ttsx` descriptor child, so a TypeScript descriptor reads `context.env`
 * values rather than the ambient `process.env`.
 *
 * RA-07 requires the effective environment (`{ ...process.env, ...context.env }`)
 * to reach not only Go subprocesses but also the `ttsx` fallback that loads
 * `.ts` plugin descriptors. Without that forwarding a programmatic embedder that
 * pins a value only in `context.env` cannot influence a descriptor evaluated in
 * the child interpreter.
 *
 * The load runs in a plain child `node` (no TypeScript loader registered) so
 * that `require()` of the `.ts` descriptor fails and the loader is genuinely
 * forced through `ttsx` — the in-process test runner would otherwise resolve the
 * `.ts` entry directly and never spawn the child whose environment is under
 * test.
 *
 * Transformation direction with a negative twin: the marker is supplied only in
 * the `env` passed to `loadProjectPlugins`, while the worker's `process.env`
 * holds a contradictory value. The descriptor bakes the marker it observes into
 * its declared `source`; the ensuing "source does not exist" error names which
 * value the ttsx child saw.
 *
 * 1. Write a `type: module` project whose `.ts` barrel descriptor sets its
 *    `source` to `absent-<marker>`, reading `<marker>` from
 *    `process.env.TTSC_DESC_MARKER` at module eval.
 * 2. Spawn a worker that calls `loadProjectPlugins` with the marker only in
 *    `env`, and `TTSC_DESC_MARKER=ambient` in the worker's own environment.
 * 3. Assert the error names `absent-context-only`, never `absent-ambient`.
 */
export const test_loadprojectplugins_ttsx_descriptor_reads_context_env =
  async () => {
    const root = TestProject.tmpdir("ttsc-project-");
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
    // Extensionless relative import: plain-node require cannot resolve it, so
    // loading is forced through ttsx. The marker is captured at module eval
    // inside ttsx, reflecting the child interpreter's environment.
    fs.writeFileSync(
      path.join(descriptor, "index.ts"),
      `export * from "./runtime";
const MARKER = process.env.TTSC_DESC_MARKER ?? "unset";
export default () => ({
  name: "context-env-descriptor",
  source: "absent-" + MARKER,
});
`,
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
        '    env: { ...process.env, TTSC_DESC_MARKER: "context-only" },',
        `    tsconfig: ${JSON.stringify(tsconfig)},`,
        "  });",
        '  process.stderr.write("NO_ERROR\\n");',
        "  process.exitCode = 2;",
        "} catch (error) {",
        '  process.stderr.write(String((error && error.message) || error) + "\\n");',
        "  process.exitCode = 1;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await spawnNodeWorker({
      env: {
        // Ambient value contradicts the instance environment; only forwarding
        // the injected `env` to the ttsx child can select "context-only".
        TTSC_DESC_MARKER: "ambient",
        // ttsx resolves the native TypeScript through this locator, exactly as
        // the CLI corpus tests wire it.
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        TTSC_BINARY: TestProject.NATIVE_BINARY,
      },
      script,
    });

    assert.match(result.stderr, /absent-context-only/);
    assert.equal(/absent-ambient/.test(result.stderr), false);
  };
