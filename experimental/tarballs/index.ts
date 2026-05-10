import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const outputDir = import.meta.dirname;
const targets = listTargets(path.join(root, "packages"));

preparePackages();
clearOutputDirectory();
for (const target of targets) build(target);

function preparePackages() {
  console.log("Preparing packages");
  cp.execSync("pnpm run build", {
    cwd: root,
    stdio: "inherit",
  });
}

function build(target) {
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
}

function clearOutputDirectory() {
  for (const entry of fs.readdirSync(outputDir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(outputDir, entry), { force: true });
    }
  }
}

function listTargets(baseDir) {
  const names = [
    "ttsc",
    "banner",
    "lint",
    "paths",
    "strip",
    "unplugin",
    ...fs
      .readdirSync(baseDir)
      .filter((entry) =>
        /^ttsc-(linux|darwin|win32)-(x64|arm|arm64)$/.test(entry),
      )
      .sort(),
  ];
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
