import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  commonJsProject,
  copyProject,
  nativeBinary,
  requireFromTest,
  spawn,
  tsgoBinary,
  ttscBin,
  ttsxBin,
  workspaceRoot,
} from "@ttsc/testing";

const __dirname = import.meta.dirname;

function pluginProject(pluginEntries, pluginFiles) {
  return commonJsProject(
    {
      ...pluginFiles,
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    },
    {
      compilerOptions: {
        plugins: pluginEntries,
      },
    },
  );
}

function nativePlugin() {
  return `
    module.exports = (context) => ({
      name: context.plugin.name,
      source: require("node:path").resolve(
        __dirname,
        "..",
        "go-plugin",
        "cmd",
        "ttsc-go-transformer"
      ),
    });
  `;
}

function copyDirectory(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

function writeRelativePackagePlugin(root, name, config) {
  const packageRoot = path.join(root, "node_modules", name);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      name,
      version: "0.1.0",
      ttsc: {
        plugin: {
          transform: "./plugin.cjs",
          ...config,
        },
      },
    }),
  );
  fs.writeFileSync(
    path.join(packageRoot, "plugin.cjs"),
    `const path = require("node:path");
module.exports = (context) => ({
  name: context.plugin.name,
  source: path.resolve(
    __dirname,
    "..",
    "..",
    "go-plugin",
    "cmd",
    "ttsc-go-transformer"
  ),
});
`,
  );
}

// parseExpectations reads `// expect: <rule> <severity>` annotations and
// returns the line each one anchors to (the next non-comment, non-blank
// line after the annotation).
function parseExpectations(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const expected = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /\/\/\s*expect:\s*([\w-]+)\s+(error|warn)\s*$/,
    );
    if (!match) continue;
    const [, rule, severity] = match;
    let target = i + 1;
    while (
      target < lines.length &&
      (/^\s*$/.test(lines[target]) || /^\s*\/\//.test(lines[target]))
    ) {
      target++;
    }
    if (target < lines.length) {
      expected.push({ rule, severity, line: target + 1 });
    }
  }
  return expected;
}

// parseDiagnostics turns the renderer's stderr into structured records
// for the given file. Strips ANSI color escapes before matching since
// pretty diagnostics are colored when stdout is a TTY.
//
// The renderer uses the `path:LINE:COL - <category> TS<code>: <msg>`
// shape — same one tsgo's `tsc --noEmit` prints.
function parseDiagnostics(stderr, filePath) {
  const ansi = /\x1b\[[0-9;]*[A-Za-z]/g;
  const stripped = stderr.replace(ansi, "");
  const lines = stripped.split(/\r?\n/);
  const fileBase = path.basename(filePath).replace(/\./g, "\\.");
  const banner = new RegExp(
    `(?:^|[\\s/])[^\\s:]*${fileBase}:(\\d+):(\\d+)\\s+-\\s+(error|warning)\\s+TS\\d+:\\s*\\[([\\w-]+)\\]`,
  );
  const out = [];
  for (const line of lines) {
    const match = line.match(banner);
    if (!match) continue;
    const [, lineNo, , category, rule] = match;
    out.push({
      rule,
      severity: category === "warning" ? "warn" : "error",
      line: parseInt(lineNo, 10),
    });
  }
  return out;
}

// setupLintProject copies a project fixture out to a tempdir and seeds a
// `node_modules/@ttsc/lint` symlink pointing at the workspace package, so
// `require("@ttsc/lint")` resolves the same way it would for a published
// install. Using a real symlink (instead of writing a relay file) keeps the
// plugin's `__dirname` pointed at the workspace go-plugin source dir.
function setupLintProject(name) {
  const root = copyProject(name);
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  const target = path.join(workspaceRoot, "packages", "lint");
  const link = path.join(linkDir, "lint");
  try {
    fs.symlinkSync(target, link, "junction");
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
  return root;
}

function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

export {
  __dirname,
  assert,
  child_process,
  commonJsProject,
  copyDirectory,
  copyProject,
  fs,
  goPath,
  nativeBinary,
  nativePlugin,
  os,
  parseDiagnostics,
  parseExpectations,
  path,
  pluginProject,
  requireFromTest,
  setupLintProject,
  spawn,
  tsgoBinary,
  ttscBin,
  ttsxBin,
  workspaceRoot,
  writeRelativePackagePlugin,
};
