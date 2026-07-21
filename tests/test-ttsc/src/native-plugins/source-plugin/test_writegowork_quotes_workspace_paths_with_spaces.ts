import { TestProject } from "@ttsc/testing";
import child_process from "node:child_process";

import {
  assert,
  buildSourcePlugin,
  fs,
  path,
  shellQuote,
} from "../../internal/source-build";

/**
 * Verifies writeGoWork quotes unsafe go.work workspace paths (#394, #857).
 *
 * `writeGoWork` emitted `use`/`replace` paths unquoted, so an overlay resolved
 * under a directory with a space — the common `C:\Users\John Smith\...` /
 * `/Users/John Smith/...` case — produced a `go.work` the modfile lexer splits
 * into extra tokens, and `go` failed to parse it. The emitter now quotes each
 * path via `modfile.AutoQuote`. This drives the real build pipeline (fake `go`)
 * and inspects the generated `go.work` to pin both directives, plus a
 * space-free twin that must stay unquoted so the fix never over-quotes. A
 * namespaced Windows path (or a POSIX double-slash spelling of the same local
 * directory) also proves a normalized comment-prefix path survives a real `go
 * work edit -json` parse.
 *
 * 1. Build a plugin whose overlays are a ttsc-module dir under a `"space dir"`
 *    path and a space-free shim dir.
 * 2. Capture the `go.work` the builder hands to `go build`.
 * 3. Assert the spaced path is quoted in both `use` and `replace`, the space-free
 *    path stays bare, and the normalized comment-prefix path is quoted in
 *    `use`.
 * 4. Parse the captured workspace with the real Go modfile tool and assert it
 *    retains that `use` entry.
 */
export const test_writegowork_quotes_workspace_paths_with_spaces = () => {
  const root = TestProject.tmpdir("ttsc-gowork-spaces-");
  const source = path.join(root, "plugin");
  const spacedOverlay = path.join(root, "space dir", "ttsc");
  const bareOverlay = path.join(root, "nospace", "shim");
  const commentPrefixBase = path.join(root, "comment-prefix", "shim");
  const commentPrefixOverlay =
    process.platform === "win32"
      ? path.toNamespacedPath(commentPrefixBase)
      : `/${commentPrefixBase}`;

  writeFile(
    path.join(root, "go.mod"),
    "module example.com/workspace\n\ngo 1.26\n",
  );

  writeFile(
    path.join(source, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  writeFile(path.join(source, "main.go"), "package main\n\nfunc main() {}\n");

  writeFile(
    path.join(spacedOverlay, "go.mod"),
    "module github.com/samchon/ttsc/packages/ttsc\n\ngo 1.26\n",
  );
  writeFile(path.join(spacedOverlay, "ttsc.go"), "package ttsc\n");
  writeFile(
    path.join(bareOverlay, "go.mod"),
    "module github.com/microsoft/typescript-go/shim/foo\n\ngo 1.26\n",
  );
  writeFile(path.join(bareOverlay, "foo.go"), "package foo\n");
  writeFile(
    path.join(commentPrefixBase, "go.mod"),
    "module example.com/comment-prefix\n\ngo 1.26\n",
  );
  writeFile(path.join(commentPrefixBase, "shim.go"), "package shim\n");

  const capture = path.join(root, "go.work");
  const fakeGo = createGoWorkCapturingGoBinary(root);

  const previousGo = process.env.TTSC_GO_BINARY;
  const previousCapture = process.env.FAKE_GO_WORK_CAPTURE;
  process.env.TTSC_GO_BINARY = fakeGo;
  process.env.FAKE_GO_WORK_CAPTURE = capture;
  try {
    buildSourcePlugin({
      baseDir: root,
      overlayDirs: [spacedOverlay, bareOverlay, commentPrefixOverlay],
      pluginName: "gowork-spaces",
      source,
      quiet: true,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
  } finally {
    restoreEnv("TTSC_GO_BINARY", previousGo);
    restoreEnv("FAKE_GO_WORK_CAPTURE", previousCapture);
  }

  const goWork = fs.readFileSync(capture, "utf8");
  const spaced = spacedOverlay.replace(/\\/g, "/");
  const bare = bareOverlay.replace(/\\/g, "/");
  const commentPrefix = commentPrefixOverlay.replace(/\\/g, "/");

  // The spaced overlay must appear quoted in the `use` block and the `replace`
  // directive, and must never appear as a bare (unquoted) token.
  assert.ok(
    goWork.includes(`\n\t"${spaced}"\n`),
    `go.work should quote the spaced use path:\n${goWork}`,
  );
  assert.ok(
    goWork.includes(
      `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => "${spaced}"`,
    ),
    `go.work should quote the spaced replace path:\n${goWork}`,
  );
  assert.ok(
    !goWork.includes(`\n\t${spaced}\n`),
    `go.work must not emit the spaced path unquoted:\n${goWork}`,
  );

  // The space-free overlay is the negative twin: it must stay bare so the fix
  // does not over-quote clean tokens.
  assert.ok(
    goWork.includes(`\n\t${bare}\n`),
    `go.work should leave the space-free use path bare:\n${goWork}`,
  );
  assert.ok(
    !goWork.includes(`"${bare}"`),
    `go.work must not quote the space-free path:\n${goWork}`,
  );

  assert.ok(
    goWork.includes(`\n\t"${commentPrefix}"\n`),
    `go.work should quote the comment-prefix use path:\n${goWork}`,
  );

  const parsed = child_process.spawnSync("go", ["work", "edit", "-json"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GOWORK: capture },
    windowsHide: true,
  });
  if (parsed.error) throw parsed.error;
  assert.equal(
    parsed.status,
    0,
    `go work edit -json should parse generated go.work:\n${parsed.stderr || parsed.stdout}`,
  );
  const workspace = JSON.parse(parsed.stdout) as {
    Use?: readonly { DiskPath?: string }[];
  };
  assert.ok(
    workspace.Use?.some((entry) => entry.DiskPath === commentPrefix),
    `go work edit -json should retain ${commentPrefix}:\n${parsed.stdout}`,
  );
};

function writeFile(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}

function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[key];
  else process.env[key] = previous;
}

/**
 * Writes a fake `go` that answers the metadata commands ttsc issues while
 * composing a source build (`version`, `env -json`, `mod edit -json`) and, on
 * `go build`, copies the workspace's `go.work` to `FAKE_GO_WORK_CAPTURE` before
 * writing a stub binary — so the test can inspect the exact `go.work` ttsc
 * generated without a real Go toolchain.
 */
function createGoWorkCapturingGoBinary(root: string): string {
  const script = path.join(root, "fake-go.cjs");
  fs.writeFileSync(
    script,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "const args = process.argv.slice(2);",
      'if (args[0] === "version") {',
      '  console.log("go version fake");',
      "  process.exit(0);",
      "}",
      'if (args[0] === "env" && args[1] === "-json") {',
      '  console.log("{}");',
      "  process.exit(0);",
      "}",
      'if (args[0] === "mod" && args[1] === "edit" && args[2] === "-json") {',
      '  const text = fs.readFileSync(path.join(process.cwd(), "go.mod"), "utf8");',
      "  const m = text.match(/^\\s*module\\s+(\\S+)/m);",
      "  console.log(JSON.stringify(m ? { Module: { Path: m[1] } } : {}));",
      "  process.exit(0);",
      "}",
      'if (args[0] === "build") {',
      "  const capture = process.env.FAKE_GO_WORK_CAPTURE;",
      "  if (capture) {",
      '    fs.writeFileSync(capture, fs.readFileSync(path.join(process.cwd(), "go.work"), "utf8"), "utf8");',
      "  }",
      '  const outIndex = args.indexOf("-o");',
      "  const out = outIndex >= 0 ? args[outIndex + 1] : null;",
      "  if (!out) {",
      '    console.error("missing -o output path");',
      "    process.exit(1);",
      "  }",
      "  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });",
      '  fs.writeFileSync(out, "fake plugin binary\\n", "utf8");',
      "  process.exit(0);",
      "}",
      'console.error(`unexpected go command: ${args.join(" ")}`);',
      "process.exit(1);",
      "",
    ].join("\n"),
    "utf8",
  );

  if (process.platform === "win32") {
    const command = path.join(root, "fake-go.cmd");
    fs.writeFileSync(
      command,
      `@echo off\r\n"${process.execPath}" "%~dp0fake-go.cjs" %*\r\n`,
      "utf8",
    );
    return command;
  }

  const command = path.join(root, "fake-go");
  fs.writeFileSync(
    command,
    `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(script)} "$@"\n`,
    "utf8",
  );
  fs.chmodSync(command, 0o755);
  return command;
}
