const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const producerRoot = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(producerRoot, "packages/evidence/package.json"))("yaml");

/**
 * Install the candidate compiler artifacts into an upstream consumer workspace.
 *
 * Compiler and unplugin overrides select the same candidate artifacts. Optional
 * package patches add real native-host behavior without changing upstream versions.
 */
function wireConsumerTarballs(consumerRoot, patchFiles = []) {
  const consumer = path.resolve(consumerRoot);
  const tarballs = path.join(producerRoot, "experimental", "tarballs");
  const relative = (from, to) => path.relative(from, to).split(path.sep).join("/");
  const artifacts = [
    ["ttsc", "ttsc.tgz"],
    ["@ttsc/unplugin", "unplugin.tgz"],
    [`@ttsc/${process.platform}-${process.arch}`, `ttsc-${process.platform}-${process.arch}.tgz`],
  ];
  const overrides = artifacts.map(([name, file]) => {
    const location = path.join(tarballs, file);
    fs.accessSync(location);
    return [name, `file:${relative(consumer, location)}`];
  });
  const patches = patchFiles.map((file) => {
    const absolute = path.resolve(file);
    fs.accessSync(absolute);
    if (!absolute.endsWith(".patch")) throw new Error(`expected package patch: ${file}`);
    return [path.basename(absolute, ".patch"), relative(consumer, absolute)];
  });
  const workspaceFile = path.join(consumer, "pnpm-workspace.yaml");
  const workspace = YAML.parse(fs.readFileSync(workspaceFile, "utf8"));
  workspace.overrides = { ...workspace.overrides, ...Object.fromEntries(overrides) };
  // pnpm 10.6 auto peers bypass file overrides and delete same-name declared
  // dependencies. Keep the compiler hosts' explicit candidate dependency.
  workspace.autoInstallPeers = false;
  workspace.packageExtensions ??= {};
  for (const host of ["typia", "@ttsc/factory", "@ttsc/unplugin"]) {
    const extension = (workspace.packageExtensions[host] ??= {});
    extension.dependencies = { ...extension.dependencies, ttsc: `file:${path.join(tarballs, "ttsc.tgz").split(path.sep).join("/")}` };
  }
  workspace.patchedDependencies ??= {};
  for (const [name, file] of patches) {
    if (workspace.patchedDependencies[name] !== undefined && workspace.patchedDependencies[name] !== file)
      throw new Error(`consumer already has a different package patch: ${name}`);
    workspace.patchedDependencies[name] = file;
  }

  fs.writeFileSync(workspaceFile, YAML.stringify(workspace));
}

const [consumer, ...patches] = process.argv.slice(2);
if (!consumer) throw new Error("expected upstream workspace path");
wireConsumerTarballs(consumer, patches);
