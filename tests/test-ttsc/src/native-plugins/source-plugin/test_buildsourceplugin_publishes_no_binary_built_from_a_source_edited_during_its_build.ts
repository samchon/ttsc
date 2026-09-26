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
 * Verifies a source plugin binary is published only under the key of the
 * sources it was built from.
 *
 * The cache key digests each source directory before the build reads it: the
 * build copies the module after any wait for the build lock, and `go build`
 * read an overlay in place for the whole build. A source edited in between was
 * built into the binary, which was published under the key of the state before
 * the edit, permanently, and served once the source returned to that state
 * (samchon/ttsc#1505). The build now compiles copies of the module and of every
 * overlay, each proven against the key before Go reads it, so an overlay edit
 * during `go build` cannot reach the binary (samchon/ttsc#1527), and a source
 * that changed before its copy publishes nothing.
 *
 * 1. Wrap the fake Go toolchain so a build writes into the binary the text of
 *    the overlay the workspace names, and so it can pause at the key's own
 *    `go mod edit -json` read.
 * 2. Pause `go build`, edit the overlay from another process, and resume: the
 *    build compiled the proven copy, so the binary carries the text the key
 *    names.
 * 3. Restore the overlay and build: the same binary is reused.
 * 4. Pause the key computation after it digested the module, edit the module from
 *    another process, and resume: the build fails naming the module.
 */
export const test_buildsourceplugin_publishes_no_binary_built_from_a_source_edited_during_its_build =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-source-race-");
    const plugin = path.join(root, "plugin");
    const overlay = path.join(root, "overlay");
    const overlayFile = path.join(overlay, "value.go");
    // The word `replace` makes the key read `go.mod` through Go, which is where
    // step 4 pauses it; no directive follows.
    write(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n\n// replace nothing\n",
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
    write(
      path.join(overlay, "go.mod"),
      "module example.com/overlay\n\ngo 1.26\n",
    );
    write(overlayFile, "package overlay // FIRST\n");

    const fakeDir = path.join(root, "fake");
    fs.mkdirSync(fakeDir, { recursive: true });
    const inner = createFakeGoBinary(fakeDir);
    const wrapperScript = path.join(fakeDir, "wrap.cjs");
    write(
      wrapperScript,
      [
        'const cp = require("node:child_process");',
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const args = process.argv.slice(2);",
        "const pause = process.env.PAUSE_KEY_READ_BARRIER;",
        'if (pause && args[0] === "mod" && args[1] === "edit" && args[2] === "-json" && !fs.existsSync(pause)) {',
        '  fs.writeFileSync(pause, "");',
        "  while (!fs.existsSync(process.env.PAUSE_KEY_READ_RELEASE)) {",
        "    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);",
        "  }",
        "}",
        `const result = cp.spawnSync(${JSON.stringify(inner)}, args, { stdio: "inherit", shell: process.platform === "win32" });`,
        "if (result.status !== 0) process.exit(result.status ?? 1);",
        'if (args[0] === "build") {',
        '  const out = args[args.indexOf("-o") + 1];',
        // The overlay the build reads is the one the workspace names.
        '  const used = fs.readFileSync("go.work", "utf8").split(/\\r?\\n/).map((line) => line.trim().replace(/^"|"$/g, "")).find((entry) => path.basename(entry) === "overlay");',
        '  fs.writeFileSync(path.resolve(out), fs.readFileSync(path.join(used, "value.go"), "utf8"));',
        "}",
        "",
      ].join("\n"),
    );
    const wrapper =
      process.platform === "win32"
        ? path.join(fakeDir, "wrap.cmd")
        : path.join(fakeDir, "wrap");
    if (process.platform === "win32")
      write(
        wrapper,
        `@echo off\r\n"${process.execPath}" "%~dp0wrap.cjs" %*\r\n`,
      );
    else {
      write(
        wrapper,
        `#!/bin/sh\nexec "${process.execPath}" "${wrapperScript}" "$@"\n`,
      );
      fs.chmodSync(wrapper, 0o755);
    }

    /** Edit `file` once `barrier` exists, then write `release`. */
    const editWhenPaused = (
      barrier: string,
      release: string,
      file: string,
      text: string,
    ): child_process.ChildProcess =>
      child_process.spawn(
        process.execPath,
        [
          "-e",
          [
            'const fs = require("node:fs");',
            `while (!fs.existsSync(${JSON.stringify(barrier)})) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);`,
            `fs.writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(text)});`,
            `fs.writeFileSync(${JSON.stringify(release)}, "");`,
          ].join("\n"),
        ],
        { stdio: "ignore" },
      );
    const build = (env: NodeJS.ProcessEnv): string =>
      buildSourcePlugin({
        baseDir: root,
        cacheDir: path.join(root, "cache"),
        env: { ...process.env, TTSC_GO_BINARY: wrapper, ...env },
        overlayDirs: [overlay],
        pluginName: "source-race",
        quiet: true,
        source: plugin,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
    const cachedBinaries = (): string[] =>
      fs.existsSync(path.join(root, "cache"))
        ? fs
            .readdirSync(path.join(root, "cache"), { recursive: true })
            .map(String)
            .filter((name) => /plugin(\.exe)?$/.test(name))
        : [];

    // 2. An overlay edited while `go build` runs.
    const buildBarrier = path.join(root, "build-barrier");
    const buildRelease = path.join(root, "build-release");
    const overlayEditor = editWhenPaused(
      buildBarrier,
      buildRelease,
      overlayFile,
      "package overlay // SECOND\n",
    );
    const snapshot = build({
      FAKE_GO_BUILD_BARRIER_FILE: buildBarrier,
      FAKE_GO_BUILD_RELEASE_FILE: buildRelease,
    });
    overlayEditor.kill();
    assert.equal(
      fs.readFileSync(snapshot, "utf8"),
      "package overlay // FIRST\n",
      "the build compiled the proven copy, not the edit",
    );
    assert.equal(cachedBinaries().length, 1);

    // 3. The restored overlay names the same key and reuses the binary.
    write(overlayFile, "package overlay // FIRST\n");
    assert.equal(build({}), snapshot);

    // 4. A module edited after the key digested it, before the build copied it.
    // A state no binary was built for yet, so the build runs rather than serving
    // the cached one, which is the binary of the state the key names.
    write(path.join(plugin, "extra.go"), "package main\n");
    const keyBarrier = path.join(root, "key-barrier");
    const keyRelease = path.join(root, "key-release");
    const moduleEditor = editWhenPaused(
      keyBarrier,
      keyRelease,
      path.join(plugin, "main.go"),
      "package main\n\n// edited\n",
    );
    assert.throws(
      () =>
        build({
          PAUSE_KEY_READ_BARRIER: keyBarrier,
          PAUSE_KEY_READ_RELEASE: keyRelease,
        }),
      (error: unknown) =>
        String(error instanceof Error ? error.message : error).includes(
          `source ${plugin} changed while it was being built`,
        ),
    );
    moduleEditor.kill();
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
