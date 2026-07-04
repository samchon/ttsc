import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Two modes:
//
//   default — used by `pnpm package:tgz` for release rehearsals. Builds every
//             workspace tarball + every platform tarball (~15-20 min on CI).
//
//   --current / TTSC_TARBALLS_CURRENT=1 — used by PR CI (typia.yml today, plus
//             any future workflow that just needs ttsc + the local platform
//             tarball). Calls `pnpm run build:current` instead of the full
//             `pnpm run build`, and only packs the current-platform package.
//             Drops typical CI time from ~20 min to ~3 min.

const CURRENT_ONLY =
  process.argv.includes("--current") ||
  process.env.TTSC_TARBALLS_CURRENT === "1";

const root = path.resolve(import.meta.dirname, "../..");
const outputDir = import.meta.dirname;
const platformKey = `${process.platform}-${process.arch}`;
const targets = listTargets(path.join(root, "packages"));

preparePackages();
clearOutputDirectory();
for (const target of targets) build(target);

function preparePackages() {
  const script = CURRENT_ONLY ? "build:current" : "build";
  console.log(`Preparing packages (pnpm run ${script})`);
  cp.execSync(`pnpm run ${script}`, {
    cwd: root,
    stdio: "inherit",
  });
}

function build(target: { dir: string; name: string; tarballName: string }) {
  for (const entry of fs.readdirSync(target.dir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(target.dir, entry), { force: true });
    }
  }

  console.log("Building package (tgz):", target.name);
  const out = path.join(outputDir, `${target.tarballName}.tgz`);
  fs.rmSync(out, { force: true });

  const result = cp.spawnSync("pnpm", ["pack", "--out", out], {
    cwd: target.dir,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr);
    const cause =
      result.signal === null
        ? `status ${result.status}`
        : `signal ${result.signal}`;
    throw new Error(`pnpm pack failed for ${target.name}: ${cause}`);
  }
  if (!fs.existsSync(out)) {
    throw new Error(`package tarball was not created: ${target.name}`);
  }
  if (target.tarballName === "vscode") {
    cp.execFileSync("node", ["scripts/assert-vscode-package.cjs", out], {
      cwd: root,
      stdio: "inherit",
    });
  }
  if (/^ttsc-(linux|darwin|win32)-(x64|arm|arm64)$/.test(target.tarballName)) {
    cp.execFileSync("node", ["scripts/assert-platform-package.cjs", out], {
      cwd: root,
      stdio: "inherit",
    });
  }
}

function clearOutputDirectory() {
  for (const entry of fs.readdirSync(outputDir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(outputDir, entry), { force: true });
    }
  }
}

function listTargets(baseDir: string) {
  const platformDirs = fs
    .readdirSync(baseDir)
    .filter((entry) =>
      /^ttsc-(linux|darwin|win32)-(x64|arm|arm64)$/.test(entry),
    );
  const selectedPlatforms = CURRENT_ONLY
    ? platformDirs.filter((entry) => entry === `ttsc-${platformKey}`)
    : platformDirs.slice().sort();
  if (CURRENT_ONLY && selectedPlatforms.length === 0) {
    throw new Error(
      `Unsupported current-only platform: no packages/ttsc-${platformKey} directory`,
    );
  }
  // In current-only mode `@ttsc/wasm` is intentionally skipped — its only
  // PR-CI consumer would be a website build, and the website is not part of
  // the typia / bun smoke flow. Full mode packs everything (release).
  const corePackages = CURRENT_ONLY
    ? ["ttsc", "banner", "lint", "paths", "strip", "unplugin"]
    : [
        "ttsc",
        "banner",
        "lint",
        "paths",
        "strip",
        "unplugin",
        "vscode",
        "wasm",
      ];
  const names = [...corePackages, ...selectedPlatforms];
  return names.map((name) => {
    const dir = path.join(baseDir, name);
    if (!fs.existsSync(path.join(dir, "package.json"))) {
      throw new Error(`package target does not exist: ${name}`);
    }
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf8"),
    );
    return {
      dir,
      name: manifest.name,
      tarballName: name,
    };
  });
}
