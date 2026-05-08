import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildSourcePlugin,
  computeCacheKey,
} from "../../../../packages/ttsc/lib/plugin/internal/buildSourcePlugin.js";

function createFakeGoBinary(root: string): string {
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
      'if (args[0] !== "build") {',
      '  console.error(`unexpected go command: ${args.join(" ")}`);',
      "  process.exit(1);",
      "}",
      "const required = [",
      '  "vendor/local/value.go",',
      '  "lib/helper.go",',
      '  "dist/generated.go",',
      '  "build/generated.go",',
      "];",
      "const missing = required.filter((file) =>",
      "  !fs.existsSync(path.join(process.cwd(), file)),",
      ");",
      "if (missing.length > 0) {",
      '  console.error(`missing copied source files: ${missing.join(", ")}`);',
      "  process.exit(1);",
      "}",
      'const outIndex = args.indexOf("-o");',
      "const out = outIndex >= 0 ? args[outIndex + 1] : null;",
      "if (!out) {",
      '  console.error("missing -o output path");',
      "  process.exit(1);",
      "}",
      "fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });",
      'fs.writeFileSync(out, "fake plugin binary\\n", "utf8");',
      "process.exit(0);",
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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export {
  assert,
  buildSourcePlugin,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  os,
  path,
  shellQuote,
};
