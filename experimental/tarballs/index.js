const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const outputDir = __dirname;
const platformKey = `${process.platform}-${process.arch}`;
const targets = listTargets(path.join(root, "packages"), platformKey);

preparePackages();
clearOutputDirectory();
for (const target of targets) build(target);

function preparePackages() {
  console.log("Preparing packages");
  cp.execSync("pnpm run build:current", {
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
  cp.execSync("pnpm pack", {
    cwd: target.dir,
    stdio: "inherit",
  });

  const file = fs.readdirSync(target.dir).find((entry) => entry.endsWith(".tgz"));
  if (!file) {
    throw new Error(`package tarball was not created: ${target.name}`);
  }
  fs.copyFileSync(
    path.join(target.dir, file),
    path.join(outputDir, `${target.tarballName}.tgz`),
  );
}

function clearOutputDirectory() {
  for (const entry of fs.readdirSync(outputDir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(outputDir, entry), { force: true });
    }
  }
}

function listTargets(baseDir, key) {
  return ["ttsc", `ttsc-${key}`].map((name) => {
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
