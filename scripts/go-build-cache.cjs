const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE_FIELDS = [
  "GoFiles",
  "CgoFiles",
  "CFiles",
  "CXXFiles",
  "MFiles",
  "HFiles",
  "FFiles",
  "SFiles",
  "SysoFiles",
  "EmbedFiles",
];

function createGoBuildCache({
  artifactPaths,
  buildArguments,
  cachePath,
  cwd,
  dependencyPackages,
  environment,
  extraFiles = [],
  force = false,
  inputDirectories = [],
  execFileSync = cp.execFileSync,
}) {
  const identity = createInputIdentity({
    buildArguments,
    cwd,
    dependencyPackages,
    environment,
    extraFiles,
    inputDirectories,
    execFileSync,
  });

  return {
    identity,
    isCurrent() {
      if (force) return false;
      const record = readRecord(cachePath);
      if (record?.identity !== identity.hash) return false;
      try {
        return (
          stableJson(record.artifacts) ===
          stableJson(snapshotPaths(artifactPaths))
        );
      } catch {
        return false;
      }
    },
    write() {
      const record = {
        schema: 1,
        identity: identity.hash,
        artifacts: snapshotPaths(artifactPaths),
      };
      writeAtomically(cachePath, `${JSON.stringify(record, null, 2)}\n`);
    },
  };
}

function createInputIdentity({
  buildArguments,
  cwd,
  dependencyPackages,
  environment,
  extraFiles,
  inputDirectories,
  execFileSync,
}) {
  const runGo = (args) =>
    execFileSync("go", args, {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...environment },
      windowsHide: true,
    });
  const packages = parseJsonStream(
    runGo(["list", "-deps", "-json", ...dependencyPackages]),
  );
  const modules = parseJsonStream(runGo(["list", "-m", "-json", "all"]));
  const toolchain = JSON.parse(
    runGo([
      "env",
      "-json",
      "GOVERSION",
      "GOROOT",
      "GOOS",
      "GOARCH",
      "GOFLAGS",
      "GOEXPERIMENT",
      "GOTOOLCHAIN",
      "GOWASM",
      "CGO_ENABLED",
      "GOWORK",
    ]),
  );
  addToolchainBinaryIdentity(toolchain);
  const files = new Set([path.resolve(__filename)]);

  for (const pkg of packages) {
    if (!pkg.Dir) continue;
    for (const field of SOURCE_FIELDS) {
      for (const file of pkg[field] ?? []) {
        files.add(path.join(pkg.Dir, file));
      }
    }
    if (pkg.Module?.GoMod) addIfFile(files, pkg.Module.GoMod);
  }
  for (const mod of modules) {
    if (!mod.GoMod) continue;
    addIfFile(files, mod.GoMod);
    addIfFile(files, path.join(path.dirname(mod.GoMod), "go.sum"));
  }
  if (toolchain.GOWORK && toolchain.GOWORK !== "off") {
    addIfFile(files, toolchain.GOWORK);
    addIfFile(files, path.join(path.dirname(toolchain.GOWORK), "go.work.sum"));
  }
  for (const file of extraFiles) files.add(path.resolve(file));
  for (const directory of inputDirectories) addDirectory(files, directory);

  const inputs = [...files]
    .sort((a, b) =>
      normalizedPath(a, cwd).localeCompare(normalizedPath(b, cwd)),
    )
    .map((file) => ({
      path: normalizedPath(file, cwd),
      sha256: fileDigest(file),
    }));
  const payload = {
    schema: 1,
    buildArguments,
    environment,
    toolchain,
    inputs,
  };
  return {
    hash: digest(stableJson(payload)),
    payload,
  };
}

function addToolchainBinaryIdentity(toolchain) {
  const goroot = toolchain.GOROOT;
  delete toolchain.GOROOT;
  if (!goroot) return;
  const executable = path.join(
    goroot,
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  try {
    toolchain.goBinarySha256 = fileDigest(executable);
  } catch {
    // `go env` supplied a toolchain root, but the compiler binary vanished
    // before its identity could be read. Keep the miss deterministic instead
    // of reusing an artifact built by an unknown compiler.
    toolchain.goBinarySha256 = null;
  }
}

function parseJsonStream(source) {
  const records = [];
  let start = 0;
  while (start < source.length) {
    while (/\s/.test(source[start] ?? "")) start += 1;
    if (start >= source.length) break;
    if (source[start] !== "{") {
      throw new Error("go command returned a non-JSON record");
    }
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = start;
    for (; end < source.length; end += 1) {
      const character = source[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) throw new Error("go command returned incomplete JSON");
    records.push(JSON.parse(source.slice(start, end + 1)));
    start = end + 1;
  }
  return records;
}

function snapshotPaths(paths) {
  return paths.map((entry) => snapshotPath(entry));
}

function snapshotPath(entry) {
  const target = path.resolve(entry);
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    throw new Error(`cache artifact is missing: ${target}`);
  }
  if (stat.isFile())
    return { path: target, type: "file", sha256: fileDigest(target) };
  if (!stat.isDirectory())
    throw new Error(`cache artifact is not a file or directory: ${target}`);
  const files = new Set();
  addDirectory(files, target);
  return {
    path: target,
    type: "directory",
    files: [...files].sort().map((file) => ({
      path: path.relative(target, file),
      sha256: fileDigest(file),
    })),
  };
}

function addDirectory(files, directory) {
  const root = path.resolve(directory);
  let stat;
  try {
    stat = fs.statSync(root);
  } catch {
    throw new Error(`cache input directory is missing: ${root}`);
  }
  if (!stat.isDirectory())
    throw new Error(`cache input is not a directory: ${root}`);
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(file);
      else if (entry.isFile()) files.add(file);
    }
  }
}

function addIfFile(files, file) {
  try {
    if (fs.statSync(file).isFile()) files.add(file);
  } catch {
    // A module can be in the graph without a colocated go.sum. Its go.mod is
    // still tracked; absent optional sums must not make every cache lookup fail.
  }
}

function readRecord(cachePath) {
  try {
    const record = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return record?.schema === 1 ? record : null;
  } catch {
    return null;
  }
}

function writeAtomically(destination, content) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.rmSync(destination, { force: true });
  fs.renameSync(temporary, destination);
}

function normalizedPath(file, cwd) {
  const relative = path.relative(cwd, file);
  return (relative.startsWith("..") ? path.resolve(file) : relative).replaceAll(
    path.sep,
    "/",
  );
}

function fileDigest(file) {
  return digest(fs.readFileSync(file));
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  return JSON.stringify(value);
}

module.exports = {
  createGoBuildCache,
  createInputIdentity,
  parseJsonStream,
};
