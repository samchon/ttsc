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

const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// tests/lint/helpers/runLint.cjs lives 3 levels deep (tests/lint/helpers/);
// resolve up to the workspace root so both the ttsc launcher and the
// lint package source are reachable regardless of the temporary CWD
// the test runner uses.
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const ttscBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const lintPkgDir = path.join(workspaceRoot, "packages", "lint");

// The fixture tmpdir doesn't `pnpm install` its own deps — that would be
// far too slow. Instead we resolve the tsgo binary from the workspace
// once and forward it to every spawned ttsc via env vars (matches the
// `tests/smoke` helper's strategy).
const tsgoBinary = (function resolveTsgoBinary() {
  const packageJson = require.resolve(
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

/**
 * @param {object} opts
 * @param {string} opts.name        — used to name the tmpdir for diagnostic output
 * @param {string} opts.source      — TypeScript source written to `src/main.ts`
 * @param {Record<string, "off"|"warn"|"error">} opts.rules — `tsconfig.json` plugin rules map
 * @param {Record<string, string>=} opts.extraSources — relative-path → content for additional fixture files (paths are interpreted relative to the project root)
 * @returns {{ status: number, stderr: string, diagnostics: Array<{file:string,line:number,column:number,severity:"warn"|"error",rule:string}> }}
 */
function runLint({ name, source, rules, extraSources }) {
  const tmpdir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ttsc-lint-case-${sanitizeForFsName(name)}-`),
  );
  try {
    writeFixtureProject(tmpdir, source, rules);
    if (extraSources) {
      for (const [relPath, content] of Object.entries(extraSources)) {
        const target = path.join(tmpdir, relPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, "utf8");
      }
    }
    seedNodeModulesLink(tmpdir);

    const result = spawnSync(
      process.execPath,
      [ttscBin, "--cwd", tmpdir, "--noEmit"],
      {
        cwd: tmpdir,
        env: {
          ...process.env,
          TTSC_CACHE_DIR: sharedCacheDir,
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
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }
}

function writeFixtureProject(tmpdir, source, rules) {
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
              rules,
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

function seedNodeModulesLink(tmpdir) {
  const linkParent = path.join(tmpdir, "node_modules", "@ttsc");
  fs.mkdirSync(linkParent, { recursive: true });
  const link = path.join(linkParent, "lint");
  try {
    fs.symlinkSync(lintPkgDir, link, "junction");
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}

const ansiPattern = /\x1b\[[0-9;]*[A-Za-z]/g;
const bannerPattern =
  /(?:^|[\s/])([^\s:]+\.ts):(\d+):(\d+)\s+-\s+(error|warning)\s+TS\d+:\s*\[([\w-]+)\]\s*(.*)$/;

/**
 * Parse the renderer's stderr into structured records.
 * @param {string} stderr
 * @returns {Array<{file:string,line:number,column:number,severity:"warn"|"error",rule:string,message:string}>}
 */
function parseDiagnostics(stderr) {
  const stripped = stderr.replace(ansiPattern, "");
  const out = [];
  for (const line of stripped.split(/\r?\n/)) {
    const match = line.match(bannerPattern);
    if (!match) continue;
    const [, file, lineStr, columnStr, category, rule, message] = match;
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
 * annotation). Mirrors tests/smoke/test/plugin-corpus.test.cjs.
 * @param {string} source
 * @returns {Array<{rule:string,severity:"warn"|"error",line:number}>}
 */
function parseExpectations(source) {
  const lines = source.split(/\r?\n/);
  const expected = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /\/\/\s*expect:\s*([\w-]+)\s+(error|warn)\s*$/,
    );
    if (!match) continue;
    const [, rule, severity] = match;
    // Skip blank lines and other `// expect:` annotations stacked
    // above the same target, but NOT regular comment lines — rules
    // like ban-ts-comment / triple-slash-reference fire on a comment
    // itself, and the convention is to put the annotation right above
    // the line it pins.
    let target = i + 1;
    while (
      target < lines.length &&
      (/^\s*$/.test(lines[target]) ||
        /^\s*\/\/\s*expect:/.test(lines[target]))
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
function rulesFromExpectations(expected) {
  const out = {};
  for (const exp of expected) {
    out[exp.rule] = exp.severity;
  }
  return out;
}

function sanitizeForFsName(s) {
  return s.replace(/[^\w.-]/g, "_").slice(0, 64);
}

function prependGoToPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

module.exports = {
  runLint,
  parseExpectations,
  parseDiagnostics,
  rulesFromExpectations,
  workspaceRoot,
  ttscBin,
  lintPkgDir,
};
