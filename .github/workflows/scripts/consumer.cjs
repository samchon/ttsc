// Points an upstream consumer workspace (typia, nestia) at the tarballs built
// from this checkout, and optionally binds their Go modules to the checkout.
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const producerRoot = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(producerRoot, "packages/evidence/package.json"))("yaml");
const [consumerArgument, ...rest] = process.argv.slice(2);
const goModules = rest.filter((argument) => argument.startsWith("--go=")).map((argument) => argument.slice(5));
const patches = rest.filter((argument) => argument.startsWith("--patch=")).map((argument) => path.resolve(argument.slice(8)));
const packagePatches = rest.filter((argument) => argument.startsWith("--package-patch=")).map((argument) => {
  const pair = argument.slice(16);
  const separator = pair.indexOf("=");
  if (separator < 1) throw new Error("Expected --package-patch=<package@version>=<patch path>");
  return [pair.slice(0, separator), path.resolve(pair.slice(separator + 1))];
});
const consumer = path.resolve(consumerArgument);
const tarballs = path.join(producerRoot, "experimental", "tarballs");
const platform = `${process.platform}-${process.arch}`;
const artifacts = {
  ttsc: "ttsc.tgz",
  "@ttsc/unplugin": "ttsc-unplugin.tgz",
  [`@ttsc/${platform}`]: `ttsc-${platform}.tgz`,
};
const relative = (to) => path.relative(consumer, to).split(path.sep).join("/");

// Apply reviewed compatibility sources before installation or compilation.
// A changed upstream context fails instead of claiming an unsupported protocol.
for (const patch of patches) {
  cp.execFileSync("git", ["apply", "--check", patch], { cwd: consumer, stdio: "inherit" });
  cp.execFileSync("git", ["apply", patch], { cwd: consumer, stdio: "inherit" });
}

const workspaceFile = path.join(consumer, "pnpm-workspace.yaml");
const workspace = YAML.parse(fs.readFileSync(workspaceFile, "utf8"));
if (packagePatches.length)
  workspace.patchedDependencies = {
    ...workspace.patchedDependencies,
    ...Object.fromEntries(packagePatches.map(([name, file]) => [name, relative(file)])),
  };
workspace.overrides = {
  ...workspace.overrides,
  ...Object.fromEntries(
    Object.entries(artifacts).map(([name, file]) => [name, `file:${relative(path.join(tarballs, file))}`]),
  ),
};
fs.writeFileSync(workspaceFile, YAML.stringify(workspace));

// pnpm's installation hook binds dependency and peer edges to the same
// candidate; a peer with the candidate's version otherwise selects registry code.
fs.writeFileSync(
  path.join(consumer, ".pnpmfile.cjs"),
  `const artifacts = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(artifacts).map(([name, file]) => [name, `file:${path.join(tarballs, file).split(path.sep).join("/")}`]),
    ),
  )};
module.exports = {
  hooks: {
    readPackage(pkg) {
      for (const [name, candidate] of Object.entries(artifacts)) {
        for (const field of ["dependencies", "devDependencies", "optionalDependencies"])
          if (pkg[field]?.[name]) pkg[field][name] = candidate;
        if (pkg.peerDependencies?.[name]) {
          (pkg.dependencies ??= {})[name] = candidate;
          delete pkg.peerDependencies[name];
          if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[name];
        }
      }
      return pkg;
    },
  },
};
`,
);

// Binds the consumer's Go modules (`--go=<dir>`) to this checkout's driver and
// shims, so their Go tests compile against the candidate rather than a release.
if (goModules.length) {
  const driver = path.join(producerRoot, "packages", "ttsc");
  const replaced = [driver];
  const visit = (directory) => {
    if (fs.existsSync(path.join(directory, "go.mod"))) replaced.push(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
      if (entry.isDirectory()) visit(path.join(directory, entry.name));
  };
  visit(path.join(driver, "shim"));
  const replace = replaced.map((directory) => {
    const name = /^module\s+(\S+)/m.exec(fs.readFileSync(path.join(directory, "go.mod"), "utf8"))[1];
    return `\t${name} => ${JSON.stringify(directory)}`;
  });
  const use = goModules.map((module) => `\t${JSON.stringify(path.resolve(module))}`);
  const work = path.join(consumer, "go.work");
  fs.writeFileSync(work, ["use (", ...use, ")", "replace (", ...replace, ")", ""].join("\n"));
  // Raises the go directive to what every listed module requires.
  cp.execFileSync("go", ["work", "use"], { cwd: consumer, env: { ...process.env, GOWORK: work }, stdio: "inherit" });
}
