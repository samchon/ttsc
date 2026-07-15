/**
 * Shared helpers for plugin-corpus feature tests. Provides project scaffolding
 * (Go plugin source, package fixtures, lint project setup), lint diagnostic
 * parsing, and re-exports of the ttsc CLI paths and workspace constants used
 * across the plugin-corpus feature suite.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const INTERNAL_DIR = path.join(
  TestProject.WORKSPACE_ROOT,
  "tests",
  "test-ttsc",
  "src",
  "internal",
);

interface ILintExpectation {
  rule: string;
  severity: "warn" | "error";
  line: number;
}

interface ILintDiagnostic {
  rule: string;
  severity: "warn" | "error";
  line: number;
}

function pluginProject(
  pluginEntries: unknown[],
  pluginFiles: Record<string, string>,
) {
  return TestProject.commonJsProject(
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

function nativePlugin(): string {
  return `
    module.exports = (context) => ({
      name: context.plugin.name,
      source: require("node:path").resolve(
        context.dirname,
        "..",
        "go-plugin",
        "cmd",
        "ttsc-go-transformer"
      ),
    });
  `;
}

function copyDirectory(from: string, to: string): void {
  fs.cpSync(from, to, { recursive: true });
}

/**
 * List the content-keyed plugin-binary directories under a plugin cache root,
 * excluding the lock-coordination directories `buildSourcePlugin` leaves beside
 * them.
 *
 * A source-plugin build creates the PERSISTENT `<key>.lock.v2` coordination
 * directory (and can leave `<key>.lock` / `<key>.lock.retired-*` tombstones) as
 * SIBLINGS of the `<key>` binary directory. ttsc's own cache GC
 * (`buildSourcePlugin.ts::collectPluginCacheEntries`) skips exactly these when
 * it enumerates cache entries, so a test that counts cache entries must do the
 * same. Otherwise the persistent v2 lock directory is miscounted as a second
 * content-keyed binary and a one-plugin build looks like two.
 */
function pluginCacheEntryDirs(pluginCacheRoot: string): string[] {
  return fs
    .readdirSync(pluginCacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isPluginCacheEntryDir(entry.name))
    .map((entry) => entry.name);
}

/**
 * Report whether a directory name under the plugin cache root is a
 * content-keyed binary entry rather than a lock-coordination sibling. Mirrors
 * the `.lock`-family exclusion in
 * `buildSourcePlugin.ts::collectPluginCacheEntries`; the `scratch-` guard is a
 * legacy carry-over from when build scratch dirs lived under the cache root.
 */
function isPluginCacheEntryDir(name: string): boolean {
  return (
    !name.startsWith("scratch-") &&
    !name.endsWith(".lock") &&
    !name.includes(".lock.")
  );
}

function writeRelativePackagePlugin(
  root: string,
  name: string,
  config: Record<string, unknown>,
): void {
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
    context.dirname,
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
function parseExpectations(filePath: string): ILintExpectation[] {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const expected: ILintExpectation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = line.match(
      /\/\/\s*expect:\s*([\w][\w/-]*)\s+(error|warn)\s*$/,
    );
    if (!match) continue;
    const rule = match[1];
    const severity = match[2] as "warn" | "error" | undefined;
    if (!rule || !severity) continue;
    let target = i + 1;
    while (
      target < lines.length &&
      (/^\s*$/.test(lines[target] ?? "") ||
        /^\s*\/\//.test(lines[target] ?? ""))
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
function parseDiagnostics(stderr: string, filePath: string): ILintDiagnostic[] {
  const ansi = /\x1b\[[0-9;]*[A-Za-z]/g;
  const stripped = stderr.replace(ansi, "");
  const lines = stripped.split(/\r?\n/);
  const fileBase = path.basename(filePath).replace(/\./g, "\\.");
  const banner = new RegExp(
    `(?:^|[\\s/])[^\\s:]*${fileBase}:(\\d+):(\\d+)\\s+-\\s+(error|warning)\\s+TS\\d+:\\s*\\[([\\w][\\w/-]*)\\]`,
  );
  const out: ILintDiagnostic[] = [];
  for (const line of lines) {
    const match = line.match(banner);
    if (!match) continue;
    const lineNo = match[1];
    const category = match[3];
    const rule = match[4];
    if (!lineNo || !category || !rule) continue;
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
function setupLintProject(name: string): string {
  const root = TestProject.copyProject(name);
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  const target = path.join(TestProject.WORKSPACE_ROOT, "packages", "lint");
  const link = path.join(linkDir, "lint");
  try {
    fs.symlinkSync(target, link, "junction");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
  }
  return root;
}

function goPath(): string | undefined {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

function commonJsProject(files: Record<string, string>, options?: any) {
  return TestProject.commonJsProject(files, options);
}

function copyProject(name: string) {
  return TestProject.copyProject(name);
}

function spawn(command: string, args: string[], options?: any) {
  return TestProject.spawn(command, args, options);
}

const NATIVE_BINARY = TestProject.NATIVE_BINARY;
const REQUIRE_FROM_TEST = TestProject.REQUIRE_FROM_TEST;
const TSGO_BINARY = TestProject.TSGO_BINARY;
const TTSC_BIN = TestProject.TTSC_BIN;
const TTSX_BIN = TestProject.TTSX_BIN;
const WORKSPACE_ROOT = TestProject.WORKSPACE_ROOT;

export {
  INTERNAL_DIR as __dirname,
  assert,
  child_process,
  commonJsProject,
  copyDirectory,
  copyProject,
  fs,
  goPath,
  NATIVE_BINARY as nativeBinary,
  nativePlugin,
  os,
  parseDiagnostics,
  parseExpectations,
  path,
  pluginCacheEntryDirs,
  pluginProject,
  REQUIRE_FROM_TEST as requireFromTest,
  setupLintProject,
  spawn,
  TSGO_BINARY as tsgoBinary,
  TTSC_BIN as ttscBin,
  TTSX_BIN as ttsxBin,
  WORKSPACE_ROOT as workspaceRoot,
  writeRelativePackagePlugin,
};
