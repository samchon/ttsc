import {
  assert,
  buildSourcePlugin,
  fs,
  os,
  path,
  shellQuote,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin rejects go.mod replacements for ttsc-managed
 * modules.
 *
 * This ttsc source plugin scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Create a source plugin whose go.mod tries to replace a TypeScript-Go shim
 *    module path.
 * 2. Build through the source-plugin cache with a fake Go command that exposes
 *    go.mod data through `go mod edit -json`.
 * 3. Assert ttsc rejects the plugin before composing a workspace that would let
 *    the plugin override host-owned compiler/shim modules.
 */
export const test_buildsourceplugin_rejects_source_replace_for_ttsc_managed_modules =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-replace-"));
    const source = path.join(root, "plugin");
    const overlay = path.join(root, "overlay", "ttsc");
    const overlayPrinter = path.join(overlay, "shim", "printer");

    writeFile(
      path.join(source, "go.mod"),
      `module example.com/plugin

go 1.26

replace github.com/microsoft/typescript-go/shim/printer => ./shim/printer

require (
  github.com/microsoft/typescript-go/shim/printer v0.0.0
  github.com/samchon/ttsc/packages/ttsc v0.0.0
)
`,
    );
    writeFile(path.join(source, "main.go"), "package main\n\nfunc main() {}\n");
    writeFile(
      path.join(source, "shim", "printer", "go.mod"),
      "module github.com/microsoft/typescript-go/shim/printer\n\ngo 1.26\n",
    );
    writeFile(
      path.join(source, "shim", "printer", "printer.go"),
      "package printer\n",
    );

    writeFile(
      path.join(overlay, "go.mod"),
      `module github.com/samchon/ttsc/packages/ttsc

go 1.26
`,
    );
    writeFile(
      path.join(overlayPrinter, "go.mod"),
      "module github.com/microsoft/typescript-go/shim/printer\n\ngo 1.26\n",
    );
    writeFile(path.join(overlayPrinter, "printer.go"), "package printer\n");

    const fakeGo = createGoModReadingGoBinary(root);
    const previousGo = process.env.TTSC_GO_BINARY;
    process.env.TTSC_GO_BINARY = fakeGo;
    try {
      assert.throws(
        () =>
          buildSourcePlugin({
            baseDir: root,
            overlayDirs: [overlay, overlayPrinter],
            pluginName: "source-replace",
            source,
            quiet: true,
            ttscVersion: "1.0.0",
            tsgoVersion: "7.0.0-dev",
          }),
        /go\.mod replaces ttsc-managed module "github\.com\/microsoft\/typescript-go\/shim\/printer"/,
      );
    } finally {
      if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
      else process.env.TTSC_GO_BINARY = previousGo;
    }
  };

function writeFile(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}

function createGoModReadingGoBinary(root: string): string {
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
      'if (args[0] === "mod" && args[1] === "edit" && args[2] === "-json") {',
      '  const goMod = fs.readFileSync(path.join(process.cwd(), "go.mod"), "utf8");',
      "  console.log(JSON.stringify(parseGoMod(goMod)));",
      "  process.exit(0);",
      "}",
      'if (args[0] === "build") {',
      '  console.error("go build should not run after a managed replacement is rejected");',
      "  process.exit(1);",
      "}",
      'console.error(`unexpected go command: ${args.join(" ")}`);',
      "process.exit(1);",
      "",
      "function parseGoMod(text) {",
      "  const out = {};",
      "  let block = null;",
      "  for (const raw of text.split(/\\r?\\n/)) {",
      "    const line = raw.replace(/\\/\\/.*$/, '').trim();",
      "    if (!line) continue;",
      "    if (line === ')') { block = null; continue; }",
      "    if (line === 'require (') { block = 'require'; continue; }",
      "    if (line === 'replace (') { block = 'replace'; continue; }",
      "    if (line.startsWith('module ')) out.Module = { Path: line.split(/\\s+/)[1] };",
      "    else if (line.startsWith('require ')) addRequire(out, line.slice('require '.length));",
      "    else if (line.startsWith('replace ')) addReplace(out, line.slice('replace '.length));",
      "    else if (block === 'require') addRequire(out, line);",
      "    else if (block === 'replace') addReplace(out, line);",
      "  }",
      "  return out;",
      "}",
      "function addRequire(out, line) {",
      "  const fields = line.trim().split(/\\s+/);",
      "  if (fields.length >= 2) (out.Require ??= []).push({ Path: fields[0], Version: fields[1] });",
      "}",
      "function addReplace(out, line) {",
      "  const fields = line.trim().split(/\\s+/);",
      "  const arrow = fields.indexOf('=>');",
      "  if (arrow < 1 || fields.length <= arrow + 1) return;",
      "  const oldFields = fields.slice(0, arrow);",
      "  const newFields = fields.slice(arrow + 1);",
      "  const old = { Path: oldFields[0] };",
      "  if (oldFields[1]) old.Version = oldFields[1];",
      "  const next = { Path: newFields[0] };",
      "  if (newFields[1]) next.Version = newFields[1];",
      "  (out.Replace ??= []).push({ Old: old, New: next });",
      "}",
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
