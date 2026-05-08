import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { requireFromTest, testPackageRoot, workspaceRoot } from "../project";

// Spawn the real `ttsc` binary against an isolated TypeScript fixture
// and parse the rendered stderr diagnostics into structured records.
//
// Each rule's e2e test passes one `.ts` file (the violation case) and a
// rules-map. The helper:
//   1. mkdtemp's a fixture project with the supplied source as
//      `src/main.ts` and a synthesized `tsconfig.json`.
//   2. Symlinks `node_modules/@ttsc/lint` to the workspace package so
//      the plugin resolver finds it the same way it would for an npm
//      install.
//   3. Spawns `ttsc --noEmit --cwd <tmpdir>`, sharing a single
//      TTSC_CACHE_DIR across calls so the Go plugin builds once per
//      test run, not per case.
//   4. Strips ANSI escapes from stderr and parses the
//      `path:LINE:COL - <category> TS<code>: [<rule>] <message>` banner
//      tsgo's renderer prints.
//
// Tests assert on the parsed records. Anything stderr-shaped that
// doesn't match the banner regex is preserved as `result.stderr` so
// failure messages can include the raw output.

const __dirname = path.join(testPackageRoot, "src", "lint");
const testingPackageRoot = testPackageRoot;
const ttscBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const ttsxBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsx.js",
);
const lintPkgDir = path.join(workspaceRoot, "packages", "lint");

// The fixture tmpdir doesn't `pnpm install` its own deps — that would be
// far too slow. Instead we resolve the tsgo binary from the workspace
// once and forward it to every spawned ttsc via env vars (matches the
// the shared testing project helper's strategy).
const tsgoBinary = (function resolveTsgoBinary() {
  const packageJson = requireFromTest.resolve(
    "@typescript/native-preview/package.json",
    { paths: [workspaceRoot] },
  );
  const requireFromNativePreview = createRequire(packageJson);
  const platformPackageJson = requireFromNativePreview.resolve(
    `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
})();

// Plugin builds (Go) take ~1-2s the first time; share the cache dir
// across the whole test run so subsequent cases reuse the binary.
const sharedCacheDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "ttsc-lint-e2e-cache-"),
);
process.on("exit", () => {
  try {
    fs.rmSync(sharedCacheDir, { recursive: true, force: true });
  } catch {}
});

export type LintSeverity = "warn" | "error";
export type LintRuleConfigSeverity = "off" | "warning" | LintSeverity;

export interface ILintDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: LintSeverity;
  rule: string;
  message: string;
}

export interface ILintExpectation {
  rule: string;
  severity: LintSeverity;
  line: number;
}

export interface IRunLintOptions {
  name: string;
  source: string;
  rules?: Record<string, LintRuleConfigSeverity>;
  pluginConfig?: Record<string, unknown>;
  extraSources?: Record<string, string>;
  linkNodeModules?: string[];
}

export interface IRunLintProject {
  tmpdir: string;
  cleanup(): void;
}

export interface IRunLintResult {
  status: number;
  stderr: string;
  diagnostics: ILintDiagnostic[];
}

function runLint(options: IRunLintOptions): IRunLintResult {
  const project = createLintProject(options);
  try {
    return runLintProject(project.tmpdir);
  } finally {
    project.cleanup();
  }
}

function createLintProject(options: IRunLintOptions): IRunLintProject {
  const { name, source, rules, pluginConfig, extraSources, linkNodeModules } =
    options;
  const tmpdir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ttsc-lint-case-${sanitizeForFsName(name)}-`),
  );
  try {
    writeFixtureProject(
      tmpdir,
      source,
      pluginConfig ?? { config: rules ?? {} },
    );
    if (extraSources) {
      for (const [relPath, content] of Object.entries(extraSources) as [
        string,
        string,
      ][]) {
        const target = path.join(tmpdir, relPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, "utf8");
      }
    }
    seedNodeModulesLink(tmpdir);
    if (linkNodeModules) {
      for (const packageName of linkNodeModules) {
        linkNodeModulePackage(tmpdir, packageName);
      }
    }
    return {
      tmpdir,
      cleanup: () => fs.rmSync(tmpdir, { recursive: true, force: true }),
    };
  } catch (error) {
    fs.rmSync(tmpdir, { recursive: true, force: true });
    throw error;
  }
}

function runLintProject(tmpdir: string, args: string[] = []): IRunLintResult {
  const result = spawnSync(
    process.execPath,
    [ttscBin, "--cwd", tmpdir, ...args, "--noEmit"],
    {
      cwd: tmpdir,
      env: {
        ...process.env,
        TTSC_CACHE_DIR: sharedCacheDir,
        TTSC_TTSX_BINARY: ttsxBin,
        TTSC_TSGO_BINARY: tsgoBinary,
        PATH: prependGoToPath(),
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 32,
      windowsHide: true,
    },
  );

  const stderr = result.stderr ?? "";
  return {
    status: result.status ?? 1,
    stderr,
    diagnostics: parseDiagnostics(stderr),
  };
}

function writeFixtureProject(
  tmpdir: string,
  source: string,
  pluginConfig: Record<string, unknown>,
): void {
  fs.mkdirSync(path.join(tmpdir, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmpdir, "src", "main.ts"), source, "utf8");
  fs.writeFileSync(
    path.join(tmpdir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          noEmit: true,
          rootDir: "src",
          plugins: [
            {
              transform: "@ttsc/lint",
              ...pluginConfig,
            },
          ],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
}

function seedNodeModulesLink(tmpdir: string): void {
  const linkParent = path.join(tmpdir, "node_modules", "@ttsc");
  fs.mkdirSync(linkParent, { recursive: true });
  const link = path.join(linkParent, "lint");
  try {
    fs.symlinkSync(lintPkgDir, link, "junction");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
  }
}

function linkNodeModulePackage(tmpdir: string, packageName: string): void {
  const packageJson = requireFromTest.resolve(`${packageName}/package.json`, {
    paths: [testingPackageRoot, workspaceRoot],
  });
  const source = path.dirname(packageJson);
  const target = path.join(tmpdir, "node_modules", ...packageName.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.symlinkSync(source, target, "junction");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
  }
}

const ansiPattern = /\x1b\[[0-9;]*[A-Za-z]/g;
const bannerPattern =
  /(?:^|[\s/])([^\s:]+\.ts):(\d+):(\d+)\s+-\s+(error|warning)\s+TS\d+:\s*\[([^\]]+)\]\s*(.*)$/;

/**
 * Parse the renderer's stderr into structured records.
 * @param {string} stderr
 * @returns {Array<{file:string,line:number,column:number,severity:"warn"|"error",rule:string,message:string}>}
 */
function parseDiagnostics(stderr: string): ILintDiagnostic[] {
  const stripped = stderr.replace(ansiPattern, "");
  const out: ILintDiagnostic[] = [];
  for (const line of stripped.split(/\r?\n/)) {
    const match = line.match(bannerPattern);
    if (!match) continue;
    const [, file, lineStr, columnStr, category, rule, message] = match;
    if (
      !file ||
      !lineStr ||
      !columnStr ||
      !category ||
      !rule ||
      message === undefined
    )
      continue;
    out.push({
      file,
      line: parseInt(lineStr, 10),
      column: parseInt(columnStr, 10),
      severity: category === "warning" ? "warn" : "error",
      rule,
      message: message.trim(),
    });
  }
  return out;
}

/**
 * Read `// expect: <rule> <severity>` comments and return the line each
 * one anchors to (the next non-comment, non-blank line after the
 * annotation). Mirrors the ttsc plugin corpus expectation format.
 * @param {string} source
 * @returns {Array<{rule:string,severity:"warn"|"error",line:number}>}
 */
function parseExpectations(source: string): ILintExpectation[] {
  const lines = source.split(/\r?\n/);
  const expected: ILintExpectation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = line.match(/\/\/\s*expect:\s*([\w-]+)\s+(error|warn)\s*$/);
    if (!match) continue;
    const rule = match[1];
    const severity = match[2] as LintSeverity | undefined;
    if (!rule || !severity) continue;
    // Skip blank lines and other `// expect:` annotations stacked
    // above the same target, but NOT regular comment lines — rules
    // like ban-ts-comment / triple-slash-reference fire on a comment
    // itself, and the convention is to put the annotation right above
    // the line it pins.
    let target = i + 1;
    while (
      target < lines.length &&
      (/^\s*$/.test(lines[target] ?? "") ||
        /^\s*\/\/\s*expect:/.test(lines[target] ?? "") ||
        (rule !== "ban-ts-comment" &&
          /^\s*\/\/\s*@ts-(?:expect-error|ignore)\b/.test(lines[target] ?? "")))
    ) {
      target++;
    }
    if (target < lines.length) {
      expected.push({ rule, severity, line: target + 1 });
    }
  }
  return expected;
}

/** Build a `rules` map for tsconfig from the expectations parsed out
 *  of a fixture file. Every rule that appears in `// expect:`
 *  annotations is enabled at its annotated severity; everything else
 *  is implicitly off (the default for unconfigured rules). */
function rulesFromExpectations(
  expected: ILintExpectation[],
): Record<string, LintSeverity> {
  const out: Record<string, LintSeverity> = {};
  for (const exp of expected) {
    out[exp.rule] = exp.severity;
  }
  return out;
}

function sanitizeForFsName(s: string): string {
  return s.replace(/[^\w.-]/g, "_").slice(0, 64);
}

function prependGoToPath(): string | undefined {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

export {
  __dirname,
  ansiPattern,
  bannerPattern,
  createLintProject,
  createRequire,
  fs,
  linkNodeModulePackage,
  lintPkgDir,
  os,
  parseDiagnostics,
  parseExpectations,
  path,
  prependGoToPath,
  requireFromTest,
  rulesFromExpectations,
  runLint,
  runLintProject,
  sanitizeForFsName,
  seedNodeModulesLink,
  sharedCacheDir,
  spawnSync,
  tsgoBinary,
  ttscBin,
  ttsxBin,
  workspaceRoot,
  writeFixtureProject,
};
