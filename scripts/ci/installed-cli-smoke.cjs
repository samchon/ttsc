const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const repository = path.resolve(__dirname, "../..");
const reuse = process.argv.includes("--reuse");
const keep = process.argv.includes("--keep");
const workspace = reuse
  ? process.env.TTSC_INSTALLED_SMOKE_ROOT
  : fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-cli-smoke-"));
assert(workspace, "--reuse requires TTSC_INSTALLED_SMOKE_ROOT");
const marker = path.join(workspace, ".ttsc-cli-smoke");

try {
  if (reuse) assert.equal(fs.readFileSync(marker, "utf8"), repository);
  else {
    fs.writeFileSync(marker, repository);
    const platform = `ttsc-${process.platform}-${process.arch}`;
    for (const name of ["ttsc", platform])
      runPnpm(["pack", "--out", path.join(workspace, `${name}.tgz`)], path.join(repository, "packages", name));
    fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({
      private: true,
      dependencies: {
        ttsc: "file:./ttsc.tgz",
        [`@ttsc/${process.platform}-${process.arch}`]: `file:./${platform}.tgz`,
        typescript: "7.0.2",
      },
    }));
    runPnpm(["install", "--ignore-scripts", "--no-frozen-lockfile"], workspace);
    fs.mkdirSync(path.join(workspace, "src"));
    fs.writeFileSync(path.join(workspace, "tsconfig.json"), JSON.stringify({
      compilerOptions: { target: "ES2022", module: "commonjs", strict: true, rootDir: "src", outDir: "dist" },
      include: ["src"],
    }));
    fs.writeFileSync(path.join(workspace, "src", "message.ts"), 'export const message: string = "installed-cli-ok";\n');
    fs.writeFileSync(path.join(workspace, "src", "main.ts"), 'import { message } from "./message";\nconsole.log(message);\n');
  }
  const requireInstalled = createRequire(path.join(workspace, "package.json"));
  const manifestPath = requireInstalled.resolve("ttsc/package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const launcher = (name) => path.join(path.dirname(manifestPath), manifest.bin[name]);
  const platform = path.dirname(
    requireInstalled.resolve(`@ttsc/${process.platform}-${process.arch}/package.json`),
  );
  const native = (name) =>
    path.join(platform, "bin", `${name}${process.platform === "win32" ? ".exe" : ""}`);
  assert.match(runNode([launcher("ttsc"), "--version"]), /^ttsc /m);
  assert.match(runNode([launcher("ttsx"), "--version"]), /^ttsx /m);
  assert.match(
    runInstalledBinary(native("ttscserver"), ["--version"]),
    /^ttscserver /m,
  );
  assert.match(
    runInstalledBinary(native("ttscgraph"), ["--version"]),
    /^ttscgraph /m,
  );
  const bundledGo = path.join(
    platform,
    "bin",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  assert.match(runInstalledBinary(bundledGo, ["version"]), /^go version go/m);
  runNode([launcher("ttsc"), "--emit"]);
  assert.equal(runNode([path.join(workspace, "dist", "main.js")]).trim(), "installed-cli-ok");
  assert.equal(runNode([launcher("ttsx"), "src/main.ts"]).trim(), "installed-cli-ok");
  if (keep && process.env.GITHUB_ENV)
    fs.appendFileSync(process.env.GITHUB_ENV, `TTSC_INSTALLED_SMOKE_ROOT=${workspace}\n`);
  console.log(`Installed CLI smoke passed on ${process.platform}/${process.arch}, Node ${process.versions.node}`);
} finally {
  // Fresh scratch directories are owned by this invocation. A reused consumer
  // stays for the next Node-version probe in the same job.
  if (!keep && !reuse) fs.rmSync(workspace, { recursive: true, force: true });
}

function runNode(args) {
  const environment = { ...process.env };
  // Exercise the installed package's resolution, never a checkout override.
  for (const key of ["TTSC_BINARY", "TTSC_TSGO_BINARY", "TTSC_CACHE_DIR", "TTSC_GO_CACHE_DIR", "TTSC_TEST_CACHE_DIR", "NODE_OPTIONS", "TTSX_RUNTIME_MANIFEST"])
    delete environment[key];
  const result = cp.spawnSync(process.execPath, args, { cwd: workspace, env: environment, encoding: "utf8", windowsHide: true, timeout: 120_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function runInstalledBinary(binary, args) {
  const result = cp.spawnSync(binary, args, {
    cwd: workspace,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function runPnpm(args, cwd) {
  const entry = process.env.npm_execpath;
  const command = entry ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = cp.spawnSync(command, entry ? [entry, ...args] : args, {
    cwd, stdio: "inherit", windowsHide: true,
    shell: !entry && process.platform === "win32",
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `pnpm ${args[0]} failed`);
}
