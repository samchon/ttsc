import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  child_process,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies a source plugin binary is not published when the Go toolchain
 * changed while it was being built, even if the tool changed back.
 *
 * The key reads the Go tool's identity before the lock wait and the build, and
 * `go build` runs the tool by path. A tool rewritten to another version and
 * restored before the build returned produced a binary under the key of the
 * version it was restored to; a later process with that version reused it
 * (samchon/ttsc#1534). The build now proves that every toolchain path the key
 * read still holds the metadata it was read with; the change time moves with
 * every write, so even a byte-identical restore is caught.
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
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Barrier-driven builds must retain their own initially cold publication state; the subsequent stable/reuse call consumes the same case cache. Mutations require another proof and cannot borrow a warm binary from a different case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases. Barrier files establish the race before assertions; auxiliary editors are killed at their existing cleanup points. Cancellation cleanup is not stronger than those points.
 * @evidence contracts/e2e.md#preserved-coverage A paused build rejects a changed-and-restored toolchain, leaves no cached binary, and later publishes a stable build. These assertions stay in test_buildsourceplugin_publishes_no_binary_built_by_a_toolchain_changed_during_its_build with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_publishes_no_binary_built_by_a_toolchain_changed_during_its_build =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-toolchain-race-");
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
          `while (!fs.existsSync(${JSON.stringify(barrier)})) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);`,
          `const original = fs.readFileSync(${JSON.stringify(tool)});`,
          `fs.writeFileSync(${JSON.stringify(tool)}, Buffer.concat([original, Buffer.from("\\n")]));`,
          `fs.writeFileSync(${JSON.stringify(tool)}, original);`,
          `fs.writeFileSync(${JSON.stringify(release)}, "");`,
        ].join("\n"),
      ],
      { stdio: "ignore" },
    );
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
      assert.throws(
        () =>
          build({
            FAKE_GO_BUILD_BARRIER_FILE: barrier,
            FAKE_GO_BUILD_RELEASE_FILE: release,
          }),
        /Go toolchain of plugin "toolchain-race" changed while it was being built/,
      );
    } finally {
      swapper.kill();
    }
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
