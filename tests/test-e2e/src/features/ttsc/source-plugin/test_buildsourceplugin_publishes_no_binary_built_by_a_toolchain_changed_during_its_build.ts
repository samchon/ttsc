import { TestProject } from "@ttsc/testing";
import { once } from "node:events";

import {
  assert,
  buildSourcePlugin,
  child_process,
  createFakeGoBinary,
  fs,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a source plugin binary is not published when the Go toolchain
 * changed while it was being built, even if the tool changed back.
 *
 * The key reads the Go tool's identity before the lock wait and the build, and
 * `go build` runs the tool by path. A tool rewritten to another version and
 * restored before the build returned produced a binary under the key of the
 * version it was restored to; a later process with that version reused it
 * (samchon/ttsc#1534). The build now proves that every toolchain path the key
 * read still holds the metadata it was read with. The race expects native
 * metadata to distinguish the intervening writes even after bytes are restored;
 * byte equality alone does not independently establish that metadata premise.
 *
 * 1. Use a fake Go tool whose build pauses at a barrier.
 * 2. While it pauses, rewrite the tool and write its original bytes back.
 * 3. Assert the build fails naming the toolchain and caches no binary.
 * 4. Build again with the tool untouched and assert it is cached.
 *
 * @evidence contracts/testing.md#behavioral-verification A paused build rejects a changed-and-restored toolchain, leaves no cached binary, and later publishes a stable build.
 * @evidence contracts/testing.md#independent-expectations A separate process deliberately mutates and restores the executable while the build barrier holds; rejection and zero publication are the provenance contract.
 * @evidence contracts/testing.md#distinguishing-cases Changed then restored bytes must still invalidate the witness, contrasted with subsequent stable success.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_publishes_no_binary_built_by_a_toolchain_changed_during_its_build entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One initially cold source/cache and actual editor feed the changed-restored rejection. The stable request uses that same cache only after direct editor close and original no-binary observation, so its publication is recovery, not a proven cache hit or zero-child reuse. Actual editor/wrapper/evaluator/tool attempts remain separate observed populations; no native Go compilation is certified.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before preparation. Actual editor spawn/error/close are observed before synchronous build can block delivery; its barrier wait has a 120-second deadline. Original kill attempt remains, but same-root restored-byte/cache/stable observations occur only after actual direct editor close within a bounded wait. Timed-out join is failure, not resource release; arbitrary editor descendants are not certified. Environments remain call-local and native changed/restored metadata authority is distinct from byte equality.
 * @evidence contracts/e2e.md#preserved-coverage Original six-file fixture, actual editor append-newline/restore/release order, exact toolchain-race rejection regex, restored Buffer equality, recursive plugin(.exe) empty population and stable binary existence remain. Spawn/error/close plus bounded barrier/join strengthen ownership without replacing native race inputs. New inline observer callbacks are AUTHORED/UNEXECUTED, not extra original686 verdicts; actual runtime/survival remain unverified and donor retained.
 */
export const test_buildsourceplugin_publishes_no_binary_built_by_a_toolchain_changed_during_its_build =
  async () => {
    const root = TestProject.tmpdir("ttsc-plugin-toolchain-race-");
    TestProject.retainTemporaryDirectory(root, "Toolchain editor or build descendants are not joined");
    const plugin = path.join(root, "plugin");
    write(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(path.join(plugin, "main.go"), "package main\n");
    // The files the fake Go build requires of the module it compiles.
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ])
      write(path.join(plugin, relative), "package generated\n");
    const fakeDir = path.join(root, "fake");
    fs.mkdirSync(fakeDir, { recursive: true });
    const tool = createFakeGoBinary(fakeDir);
    const original = fs.readFileSync(tool);

    const barrier = path.join(root, "build-barrier");
    const release = path.join(root, "build-release");
    const swapper = child_process.spawn(
      process.execPath,
      [
        "-e",
        [
          'const fs = require("node:fs");',
          `const deadline = Date.now() + 120_000;`,
          `while (!fs.existsSync(${JSON.stringify(barrier)})) { if (Date.now() >= deadline) throw new Error("Toolchain build barrier not reached"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); }`,
          `const original = fs.readFileSync(${JSON.stringify(tool)});`,
          `fs.writeFileSync(${JSON.stringify(tool)}, Buffer.concat([original, Buffer.from("\\n")]));`,
          `fs.writeFileSync(${JSON.stringify(tool)}, original);`,
          `fs.writeFileSync(${JSON.stringify(release)}, "");`,
        ].join("\n"),
      ],
      { stdio: "ignore" },
    );
    const failures: unknown[] = [];
    swapper.once("error", (error) => failures.push(error));
    const closed = new Promise<void>((resolve) => {
      swapper.once("close", () => resolve());
    });
    const build = (env: NodeJS.ProcessEnv = {}): string =>
      buildSourcePlugin({
        baseDir: root,
        cacheDir: path.join(root, "cache"),
        env: { ...process.env, TTSC_GO_BINARY: tool, ...env },
        overlayDirs: [],
        pluginName: "toolchain-race",
        quiet: true,
        source: plugin,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

    try {
      await once(swapper, "spawn");
      assert.throws(
        () =>
          build({
            FAKE_GO_BUILD_BARRIER_FILE: barrier,
            FAKE_GO_BUILD_RELEASE_FILE: release,
          }),
        /Go toolchain of plugin "toolchain-race" changed while it was being built/,
      );
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        swapper.kill();
      } catch (error) {
        failures.push(error);
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          closed,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("Toolchain editor did not close")), 60_000);
          }),
        ]);
      } catch (error) {
        failures.push(error);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }
    if (failures.length) throw new AggregateError(failures, "Toolchain race and editor close failed");
    assert.deepEqual(fs.readFileSync(tool), original, "the tool was restored");
    const cached = fs
      .readdirSync(path.join(root, "cache"), { recursive: true })
      .map(String)
      .filter((name) => /plugin(\.exe)?$/.test(name));
    assert.deepEqual(cached, [], "no binary was cached");

    const binary = build();
    assert.equal(fs.existsSync(binary), true, "a stable build is cached");
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
