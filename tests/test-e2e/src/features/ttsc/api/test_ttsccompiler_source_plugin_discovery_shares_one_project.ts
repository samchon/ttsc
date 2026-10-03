import { inspect } from "node:util";

import { Scenarios } from "../../../internal/Scenarios";
import { CompilerApiWorkspace } from "../../../internal/ttsc/internal/CompilerApiWorkspace";
import {
  TtscCompiler,
  assert,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writePackageCompilerPlugin,
  writeSharedCompilerPlugin,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies plugin discovery, consulted host inputs and asynchronous API
 * behavior through one project directory and an immutable Go source producer.
 *
 * A source plugin turns `goUpper("plugin")` into `"PLUGIN"`. It is reached
 * three ways: a `compilerOptions.plugins` entry, a dependency package whose
 * manifest advertises a plugin, and the same package declared by an ancestor
 * manifest above the project. A nearer `package.json` ends that ancestor
 * discovery. Each way is asserted for the in-memory records and for writing
 * nothing to disk.
 *
 * 1. Configure the plugin in tsconfig; compile and transform and assert the plugin
 *    output without a `dist` directory.
 * 2. Declare it only through a dependency package; compile and transform.
 * 3. Place the project below a workspace manifest and assert it is discovered,
 *    then add a manifest beside the project and assert it no longer is.
 * 4. Retain a missing explicit config in the exact host-input list while excluding
 *    an unrelated notes file.
 * 5. Compare a worker's invalid scoped temp parent with an ambient positive.
 * 6. Compare synchronous and worker envelopes while a descriptor holds for a
 *    second, sample event-loop progress and change ambient temp variables after
 *    starting the worker; also compare the missing-config exceptions.
 *
 * @evidence contracts/testing.md#behavioral-verification Real native API calls apply configured and discovered plugins, stop at a nearer manifest, report the exact four consulted host inputs, distinguish scoped invalid temp from ambient success and compare sync/worker envelopes, call-time environment capture and event-loop progress; discovery calls leave dist absent.
 * @evidence contracts/testing.md#independent-expectations The authored goUpper source and uppercase contract fix PLUGIN and unchanged goUpper expectations; nearest-manifest discovery is independently specified. The four literal consulted paths exclude the unrelated notes asset, scoped temp failure names the physical regular file and a literal one-second hold sets the independent 500ms stall bound. Sync/async envelopes compare the public contracts rather than compiler internals.
 * @evidence contracts/testing.md#distinguishing-cases Configured and package-discovered plugins, ancestor discovery and its nearest-manifest negative contrast with missing explicit config versus an unrelated asset, invalid scoped versus valid ambient temp parents and success versus missing-config worker envelopes. The one-second descriptor hold has an independent 500ms maximum caller stall.
 * @evidence contracts/testing.md#execution-ownership This ordinary test export is discovered by test-e2e src/index.ts and selected by evidence.config.json; it runs the native plugin loader and source producer through TtscCompiler, through the checkout built API and selected native compiler; manifest parsing units alone do not exercise this assembly. It is not packed installation or loaded-image certification.
 * @evidence contracts/e2e.md#necessary-boundary Native plugin discovery and API output publication, worker environment capture and the sampled descriptor-hold timer bound require actual native API and worker connections; direct manifest or envelope units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution The six discovery calls and seven calls formerly made by three private API consumers share one workspace instead of four project roots and an additional later-temp directory outside those projects. The current thirteen public invocations include four asynchronous worker requests; these static calls do not certify actual worker/process totals, construction counts or native Program/descriptor-child reduction. The immutable process-owned Go producer and content-keyed cache remain shared. The authored check descriptor substitutes only that producer's absolute source path.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Before each input state the test removes its own descriptors, asset and temp paths, then the workspace resets source, package discovery trees, outputs and configuration from baseline plus overlay. Requested asynchronous outcomes are awaited, changed temp variables and timers are restored in finally, and body/close causes are retained with root absence after scenarios. The directory helper itself joins no worker/process; direct outcomes do not prove arbitrary descendant closure or forced-interruption cleanup. Scenarios collects failures so one state does not hide subsequent cases.
 * @evidence contracts/e2e.md#preserved-coverage Retains configured and discovered compile/transform records, ancestor positive and nearest-manifest negative, the original exact host-input list, scoped-temp exception text and physical path, ambient success, sync/async envelope equality, 500ms stall bound, call-time environment mutation and missing-config exception kind/message/name equality. The three removed additional entries now share these executable scenarios and the existing discovery workspace.
 */
export async function test_ttsccompiler_source_plugin_discovery_shares_one_project(): Promise<void> {
  const workspace = CompilerApiWorkspace.open();
  const failures: unknown[] = [];
  try {
    const root = workspace.root;
    const dist = path.join(root, "dist");
    const compilerFor = (cwd: string) =>
      new TtscCompiler({ binary: tsgo, cwd });
    const enter = (state: string) => {
      for (const name of [
        "plugin.cjs",
        "check.cjs",
        "notes.md",
        "temp-is-a-file",
        "later-temp",
      ])
        fs.rmSync(path.join(root, name), { recursive: true, force: true });
      CompilerApiWorkspace.enter(workspace, state);
    };
    const setPlugins = (plugins: object[]) => {
      const filename = path.join(root, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(filename, "utf8"));
      config.compilerOptions.plugins = plugins;
      fs.writeFileSync(filename, JSON.stringify(config), "utf8");
    };
    await Scenarios.collect("compiler source plugins", [
      [
        "configured_plugin",
        () => {
          enter("goupper-configured");
          writeSharedCompilerPlugin(root);
          const compiler = compilerFor(root);
          const compiled = compiler.compile();
          assert.equal(compiled.type, "success", describe(compiled));
          assert.match(
            expectRecordValue(compiled.output, "dist/main.js"),
            /PLUGIN/,
          );
          assert.equal(fs.existsSync(dist), false);
          const transformed = compiler.transform();
          assert.equal(transformed.type, "success", describe(transformed));
          assert.match(
            expectRecordValue(transformed.typescript, "src/main.ts"),
            /export const value = "PLUGIN"/,
          );
          assert.match(
            expectRecordValue(transformed.typescript, "src/main.ts"),
            /console\.log\(value\)/,
          );
          assert.equal(transformed.typescript["dist/main.js"], undefined);
          assert.equal(fs.existsSync(dist), false);
        },
      ],
      [
        "package_discovered_plugin",
        () => {
          enter("goupper-discovered");
          writePackageCompilerPlugin(root, "compile-fixture");
          const compiler = compilerFor(root);
          const compiled = compiler.compile();
          assert.equal(compiled.type, "success", describe(compiled));
          assert.match(
            expectRecordValue(compiled.output, "dist/main.js"),
            /PLUGIN/,
          );
          assert.equal(fs.existsSync(dist), false);
          const transformed = compiler.transform();
          assert.equal(transformed.type, "success", describe(transformed));
          assert.match(
            expectRecordValue(transformed.typescript, "src/main.ts"),
            /export const value = "PLUGIN"/,
          );
          assert.equal(fs.existsSync(dist), false);
        },
      ],
      [
        "ancestor_manifest_discovery_and_nearest_manifest_stop",
        () => {
          enter("ancestor");
          writePackageCompilerPlugin(root, "compile-fixture");
          const project = path.join(root, "packages", "app");
          const compiler = compilerFor(project);
          const discovered = compiler.compile();
          assert.equal(discovered.type, "success", describe(discovered));
          assert.match(
            expectRecordValue(discovered.output, "dist/main.js"),
            /PLUGIN/,
          );
          assert.equal(fs.existsSync(path.join(project, "dist")), false);

          fs.writeFileSync(
            path.join(project, "package.json"),
            JSON.stringify({ private: true }),
            "utf8",
          );
          const stopped = compilerFor(project).compile();
          assert.equal(stopped.type, "success", describe(stopped));
          assert.match(
            expectRecordValue(stopped.output, "dist/main.js"),
            /goUpper\("plugin"\)/,
          );
          assert.doesNotMatch(
            expectRecordValue(stopped.output, "dist/main.js"),
            /PLUGIN/,
          );
          assert.equal(fs.existsSync(path.join(project, "dist")), false);
        },
      ],
      [
        "exact_host_inputs_and_unrelated_asset",
        () => {
          enter("goupper-configured");
          fs.rmSync(path.join(root, "check.cjs"));
          setPlugins([
            {
              transform: "./plugin.cjs",
              configFile: "missing.plugin.config.json",
            },
          ]);
          fs.writeFileSync(
            path.join(root, "src", "main.ts"),
            'export const value = goUpper("plugin");\n',
            "utf8",
          );
          writeSharedCompilerPlugin(root);
          fs.writeFileSync(
            path.join(root, "notes.md"),
            "not a host input\n",
            "utf8",
          );
          const physical = fs.realpathSync.native(root);
          const result = compilerFor(physical).transform();
          assert.equal(result.type, "success", describe(result));
          assert.deepEqual(result.hostInputs, [
            path.join(physical, "missing.plugin.config.json"),
            path.join(physical, "package.json"),
            path.join(physical, "plugin.cjs"),
            path.join(physical, "tsconfig.json"),
          ]);
        },
      ],
      [
        "worker_scoped_environment_and_ambient_positive",
        async () => {
          enter("goupper-configured");
          fs.rmSync(path.join(root, "check.cjs"));
          writeSharedCompilerPlugin(root);
          const notADirectory = path.join(root, "temp-is-a-file");
          fs.writeFileSync(notADirectory, "", "utf8");
          await Scenarios.collect("worker temp environment", [
            [
              "scoped_regular_file_parent",
              async () => {
                const scoped = await new TtscCompiler({
                  binary: tsgo,
                  cwd: root,
                  env: {
                    TEMP: notADirectory,
                    TMP: notADirectory,
                    TMPDIR: notADirectory,
                  },
                }).transformAsync();
                assert.equal(scoped.type, "exception");
                if (scoped.type !== "exception") throw new Error("unreachable");
                assert.match(
                  (scoped.error as Error).message,
                  /temporary directory parent is not a directory/,
                );
                assert.ok(
                  (scoped.error as Error).message.includes(
                    fs.realpathSync.native(notADirectory),
                  ),
                  (scoped.error as Error).message,
                );
              },
            ],
            [
              "ambient_environment_positive",
              async () => {
                assert.equal(
                  (await compilerFor(root).transformAsync()).type,
                  "success",
                );
              },
            ],
          ]);
        },
      ],
      [
        "worker_envelope_environment_capture_and_event_loop",
        async () => {
          enter("goupper-configured");
          setPlugins([
            { transform: "./check.cjs" },
            { transform: "./plugin.cjs" },
          ]);
          const producer = writeSharedCompilerPlugin(root);
          const check = path.join(root, "check.cjs");
          const authored = fs.readFileSync(check, "utf8");
          assert.equal(
            authored.split('"__SHARED_COMPILER_SOURCE__"').length,
            2,
          );
          fs.writeFileSync(
            check,
            authored.replace(
              '"__SHARED_COMPILER_SOURCE__"',
              JSON.stringify(producer),
            ),
            "utf8",
          );
          const compiler = compilerFor(root);
          const expected = compiler.transform();
          const laterRoot = path.join(root, "later-temp");
          fs.mkdirSync(laterRoot);
          const later = path.join(laterRoot, "missing");
          const names = ["TEMP", "TMP", "TMPDIR"] as const;
          const previous = names.map((name) => process.env[name]);
          const ticks: number[] = [];
          const timer = setInterval(() => ticks.push(performance.now()), 1);
          const started = performance.now();
          let actual: Awaited<ReturnType<TtscCompiler["transformAsync"]>>;
          try {
            const pending = compiler.transformAsync();
            for (const name of names) process.env[name] = later;
            actual = await pending;
          } finally {
            clearInterval(timer);
            names.forEach((name, index) => {
              const value = previous[index];
              if (value === undefined) delete process.env[name];
              else process.env[name] = value;
            });
          }
          assert.deepEqual(actual, expected);
          let longestStall = (ticks[0] ?? performance.now()) - started;
          for (let index = 1; index < ticks.length; index += 1)
            longestStall = Math.max(
              longestStall,
              ticks[index]! - ticks[index - 1]!,
            );
          assert.ok(
            longestStall < 500,
            `the loop ran while plugin loading held: longest stall ${longestStall.toFixed(0)} ms`,
          );
        },
      ],
      [
        "missing_config_sync_and_worker_exception_envelopes",
        async () => {
          const missing = new TtscCompiler({
            binary: tsgo,
            cwd: root,
            tsconfig: path.join(root, "missing.json"),
          });
          const envelope = (
            result: Awaited<ReturnType<TtscCompiler["transformAsync"]>>,
          ) => {
            assert.equal(result.type, "exception");
            if (result.type !== "exception") throw new Error("unreachable");
            return {
              kind: result.kind,
              message: (result.error as Error).message,
              name: (result.error as Error).name,
            };
          };
          assert.deepEqual(
            envelope(await missing.transformAsync()),
            envelope(missing.transform()),
          );
        },
      ],
    ]);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      CompilerApiWorkspace.close(workspace);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Compiler source plugin states and cleanup failed.",
    );
}

/** Names a native exception in a failed type assertion so its cause is not lost. */
function describe(result: { type: string; error?: unknown }): string {
  return result.type === "exception" ? inspect(result, { depth: 6 }) : "";
}
