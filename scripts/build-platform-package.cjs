const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const cwd = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
const match = /^@ttsc\/(linux|darwin|win32)-(x64|arm|arm64)$/.exec(manifest.name);

if (!match) {
  throw new Error(`build-platform-package: unsupported package name ${manifest.name}`);
}

const [, npmOs, npmArch] = match;
const goos = npmOs === "win32" ? "windows" : npmOs;
const goarch = npmArch === "x64" ? "amd64" : npmArch;
const root = path.resolve(cwd, "../..");
const source = path.join(root, "packages", "ttsc");
const outDir = path.join(cwd, "bin");
const outFile = path.join(outDir, npmOs === "win32" ? "ttsc.exe" : "ttsc");
const bundledGoDir = path.join(outDir, "go");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const localGoBin = path.join(process.env.HOME ?? "", "go-sdk", "go", "bin");
const pathValue = fs.existsSync(localGoBin)
  ? `${localGoBin}${path.delimiter}${process.env.PATH ?? ""}`
  : process.env.PATH;
const buildGo = resolveBuildGo();

console.log(`Building ${manifest.name} -> ${path.relative(root, outFile)}`);
cp.execFileSync(buildGo, ["build", "-o", outFile, "./cmd/platform"], {
  cwd: source,
  env: {
    ...process.env,
    CGO_ENABLED: "0",
    GOARCH: goarch,
    GOOS: goos,
    PATH: pathValue,
  },
  stdio: "inherit",
});

embedGoToolchain();

if (npmOs !== "win32") {
  fs.chmodSync(outFile, 0o755);
}

function resolveBuildGo() {
  if (process.env.TTSC_GO_BINARY) {
    return process.env.TTSC_GO_BINARY;
  }
  return "go";
}

function embedGoToolchain() {
  const goroot = resolveTargetGoRoot();
  if (!goroot || !fs.existsSync(goroot)) {
    throw new Error(
      `build-platform-package: Go compiler root not found for ${manifest.name}. ` +
        `Set TTSC_GO_ROOT to a Go SDK root containing bin/${npmOs === "win32" ? "go.exe" : "go"}.`,
    );
  }
  const realGoRoot = goroot ? fs.realpathSync(goroot) : "";
  const goBinary = path.join(realGoRoot, "bin", npmOs === "win32" ? "go.exe" : "go");
  if (!realGoRoot || !fs.existsSync(goBinary)) {
    throw new Error(
      `build-platform-package: Go compiler root not found for ${manifest.name}. ` +
        `Set TTSC_GO_ROOT to a Go SDK root containing bin/${npmOs === "win32" ? "go.exe" : "go"}.`,
    );
  }

  console.log(`Embedding Go compiler ${realGoRoot} -> ${path.relative(root, bundledGoDir)}`);
  copyPrunedGoRoot(realGoRoot, bundledGoDir);
  verifyEmbeddedGoToolchain();
  chmodGoExecutables(bundledGoDir);
}

function resolveTargetGoRoot() {
  const platformEnv = `TTSC_GO_ROOT_${npmOs.toUpperCase()}_${npmArch.toUpperCase()}`;
  if (process.env[platformEnv]) {
    return process.env[platformEnv];
  }
  if (process.env.TTSC_GO_ROOT) {
    return process.env.TTSC_GO_ROOT;
  }
  if (npmOs === process.platform && npmArch === process.arch) {
    return readGoRoot();
  }
  return ensureDownloadedGoRoot();
}

function ensureDownloadedGoRoot() {
  const version = process.env.TTSC_GO_VERSION || readGoVersion();
  const archive = goArchiveName(version);
  const cacheRoot = path.join(root, ".cache", "go-sdk", version);
  const extractDir = path.join(cacheRoot, archive.replace(/\.tar\.gz$|\.zip$/g, ""));
  const goroot = path.join(extractDir, "go");
  const goBinary = path.join(goroot, "bin", npmOs === "win32" ? "go.exe" : "go");
  if (fs.existsSync(goBinary)) {
    return goroot;
  }

  fs.mkdirSync(cacheRoot, { recursive: true });
  const archivePath = path.join(cacheRoot, archive);
  const url = `https://go.dev/dl/${archive}`;
  if (!fs.existsSync(archivePath)) {
    console.log(`Downloading Go compiler ${url}`);
    cp.execFileSync("curl", ["-L", "--fail", "-o", archivePath, url], {
      stdio: "inherit",
    });
  }

  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  if (archive.endsWith(".tar.gz")) {
    cp.execFileSync("tar", ["-xzf", archivePath, "-C", extractDir], {
      stdio: "inherit",
    });
  } else {
    extractZipArchive(archivePath, extractDir);
  }
  if (!fs.existsSync(goBinary)) {
    throw new Error(`build-platform-package: downloaded Go compiler missing: ${goBinary}`);
  }
  return goroot;
}

function readGoVersion() {
  return cp
    .execFileSync(buildGo, ["env", "GOVERSION"], {
      cwd: source,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: pathValue,
      },
    })
    .trim();
}

function goArchiveName(version) {
  const target = goArchiveTarget();
  return `${version}.${target}${npmOs === "win32" ? ".zip" : ".tar.gz"}`;
}

function goArchiveTarget() {
  const os = npmOs === "win32" ? "windows" : npmOs;
  const arch =
    npmArch === "x64" ? "amd64" :
    npmArch === "arm" ? "armv6l" :
    npmArch;
  return `${os}-${arch}`;
}

function extractZipArchive(archivePath, extractDir) {
  const data = fs.readFileSync(archivePath);
  const eocd = findEndOfCentralDirectory(data);
  const entries = data.readUInt16LE(eocd + 10);
  let offset = data.readUInt32LE(eocd + 16);

  for (let i = 0; i < entries; i++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`build-platform-package: invalid zip central directory: ${archivePath}`);
    }
    const method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    const name = data
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8")
      .replace(/\\/g, "/");
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    const target = path.resolve(extractDir, name);
    if (!target.startsWith(path.resolve(extractDir) + path.sep)) {
      throw new Error(`build-platform-package: refusing zip entry outside target: ${name}`);
    }
    if (data.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`build-platform-package: invalid zip local header: ${name}`);
    }
    const localNameLength = data.readUInt16LE(localOffset + 26);
    const localExtraLength = data.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.subarray(dataStart, dataStart + compressedSize);
    const contents =
      method === 0 ? compressed :
      method === 8 ? zlib.inflateRawSync(compressed) :
      unsupportedZipMethod(method, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
}

function findEndOfCentralDirectory(data) {
  const min = Math.max(0, data.length - 0xffff - 22);
  for (let i = data.length - 22; i >= min; --i) {
    if (data.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("build-platform-package: zip end-of-central-directory record not found");
}

function unsupportedZipMethod(method, name) {
  throw new Error(`build-platform-package: unsupported zip compression method ${method}: ${name}`);
}

function copyPrunedGoRoot(sourceRoot, targetRoot) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  copyRecursive(sourceRoot, targetRoot, sourceRoot);
}

function copyRecursive(current, target, rootDir) {
  const rel = path.relative(rootDir, current).replace(/\\/g, "/");
  const stat = fs.lstatSync(current);
  if (stat.isDirectory()) {
    if (!shouldCopyGoPath(rel, true)) return;
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(current)) {
      copyRecursive(path.join(current, entry), path.join(target, entry), rootDir);
    }
    return;
  }
  if (!stat.isFile()) return;
  if (!shouldCopyGoPath(rel, false)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(current, target);
}

function shouldCopyGoPath(rel, isDir) {
  if (rel === "") return true;
  const parts = rel.split("/");
  const first = parts[0];

  if (parts.includes(".git")) return false;
  if (parts.includes("testdata")) return false;
  if (!isDir && rel.endsWith("_test.go")) return false;

  if (parts.length === 1) {
    if (isDir) return ["bin", "pkg", "src", "lib"].includes(first);
    return ["VERSION", "go.env", "LICENSE", "PATENTS"].includes(first);
  }

  if (first === "bin") {
    if (isDir) return true;
    const base = path.basename(rel);
    return base === "go" || base === "go.exe" || base === "gofmt" || base === "gofmt.exe";
  }
  if (first === "pkg") {
    return parts[1] === "tool" || parts[1] === "include";
  }
  if (first === "src") {
    if (!isDir && parts.length === 2) {
      return ["go.mod", "go.sum"].includes(parts[1]);
    }
    return parts[1] !== "cmd";
  }
  if (first === "lib") {
    return parts[1] === "time";
  }
  return false;
}

function readGoRoot() {
  return cp
    .execFileSync(buildGo, ["env", "GOROOT"], {
      cwd: source,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: pathValue,
      },
    })
    .trim();
}

function chmodGoExecutables(rootDir) {
  if (npmOs === "win32") return;
  for (const rel of ["bin/go", "bin/gofmt"]) {
    const file = path.join(rootDir, rel);
    if (fs.existsSync(file)) fs.chmodSync(file, 0o755);
  }
  const toolDir = path.join(rootDir, "pkg", "tool");
  if (!fs.existsSync(toolDir)) return;
  for (const file of walkFiles(toolDir)) {
    fs.chmodSync(file, 0o755);
  }
}

function verifyEmbeddedGoToolchain() {
  const stat = fs.lstatSync(bundledGoDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      `build-platform-package: bundled Go compiler must be copied as real files, not a symlink: ${bundledGoDir}`,
    );
  }
  const embeddedGo = path.join(
    bundledGoDir,
    "bin",
    npmOs === "win32" ? "go.exe" : "go",
  );
  if (!fs.existsSync(embeddedGo)) {
    throw new Error(
      `build-platform-package: bundled Go compiler missing after copy: ${embeddedGo}`,
    );
  }
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(file));
    } else if (entry.isFile()) {
      out.push(file);
    }
  }
  return out;
}
