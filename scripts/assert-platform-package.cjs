const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const sourceMode = args.includes("--source");
const targets = args.filter((arg) => !arg.startsWith("--"));
const failures = [];
const baseExecutablePaths = [
  "bin/ttsc",
  "bin/ttscserver",
  "bin/ttscgraph",
  "bin/go/bin/go",
  "bin/go/bin/gofmt",
];
const requiredExecutableConfigPaths = baseExecutablePaths.map(
  (rel) => `./${rel}`,
);

if (sourceMode) {
  for (const dir of listPlatformPackageDirs()) {
    inspectPackageDir(dir);
  }
} else if (targets.length > 0) {
  for (const target of targets) {
    const resolved = path.resolve(target);
    if (resolved.endsWith(".tgz") || resolved.endsWith(".tar.gz")) {
      inspectTarball(resolved);
    } else {
      inspectPackageDir(resolved);
    }
  }
} else {
  throw new Error(
    "Usage: node scripts/assert-platform-package.cjs --source | <package-dir-or-tgz>...",
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

function listPlatformPackageDirs() {
  const packagesDir = path.join(root, "packages");
  return fs
    .readdirSync(packagesDir)
    .filter((entry) =>
      /^ttsc-(linux|darwin|win32)-(x64|arm|arm64)$/.test(entry),
    )
    .sort()
    .map((entry) => path.join(packagesDir, entry));
}

function inspectPackageDir(dir) {
  const manifestPath = path.join(dir, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const platform = platformFromPackageName(manifest.name);
  if (platform === null || platform.os === "win32") return;

  const executablePaths = requiredExecutablePaths(dir);
  inspectExecutablePublishConfig(manifest, executablePaths);
  for (const rel of executablePaths) {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) {
      failures.push(`${manifest.name}: missing executable ${rel}`);
      continue;
    }
    const mode = fs.statSync(file).mode & 0o777;
    if (!hasExecutableMode(mode)) {
      failures.push(
        `${manifest.name}: ${rel} has mode ${formatMode(mode)}, expected executable mode`,
      );
    }
  }
}

function inspectTarball(file) {
  const entries = readTarball(file);
  const packageJson = entries.get("package/package.json");
  if (!packageJson) {
    failures.push(`${file}: missing package/package.json`);
    return;
  }
  const manifest = JSON.parse(packageJson.content.toString("utf8"));
  const platform = platformFromPackageName(manifest.name);
  if (platform === null || platform.os === "win32") return;

  for (const rel of requiredExecutablePathsFromEntries(entries)) {
    const name = `package/${rel}`;
    const entry = entries.get(name);
    if (!entry) {
      failures.push(`${manifest.name}: tarball missing executable ${rel}`);
      continue;
    }
    if (!hasExecutableMode(entry.mode)) {
      failures.push(
        `${manifest.name}: tarball ${rel} has mode ${formatMode(entry.mode)}, expected executable mode`,
      );
    }
  }
}

function platformFromPackageName(name) {
  const match = /^@ttsc\/(linux|darwin|win32)-(x64|arm|arm64)$/.exec(name);
  return match ? { os: match[1], arch: match[2] } : null;
}

function inspectExecutablePublishConfig(manifest, executablePaths) {
  const executableFiles = new Set(
    Array.isArray(manifest.publishConfig?.executableFiles)
      ? manifest.publishConfig.executableFiles
      : [],
  );
  const required = [
    ...requiredExecutableConfigPaths,
    ...executablePaths
      .filter((rel) => rel.startsWith("bin/go/pkg/tool/"))
      .map((rel) => `./${rel}`),
  ];
  for (const rel of required) {
    if (!executableFiles.has(rel)) {
      failures.push(
        `${manifest.name}: publishConfig.executableFiles missing ${rel}`,
      );
    }
  }
}

function requiredExecutablePaths(packageDir) {
  const paths = [...baseExecutablePaths];
  const toolDir = path.join(packageDir, "bin", "go", "pkg", "tool");
  if (fs.existsSync(toolDir)) {
    for (const file of walkFiles(toolDir)) {
      paths.push(path.relative(packageDir, file).replace(/\\/g, "/"));
    }
  }
  return paths;
}

function requiredExecutablePathsFromEntries(entries) {
  const paths = [...baseExecutablePaths];
  for (const [name, entry] of entries) {
    if (
      entry.file &&
      name.startsWith("package/bin/go/pkg/tool/") &&
      !name.endsWith("/")
    ) {
      paths.push(name.slice("package/".length));
    }
  }
  return paths;
}

function hasExecutableMode(mode) {
  return (mode & 0o111) === 0o111;
}

function formatMode(mode) {
  return mode.toString(8).padStart(3, "0");
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

function readTarball(file) {
  const data =
    file.endsWith(".gz") || file.endsWith(".tgz")
      ? zlib.gunzipSync(fs.readFileSync(file))
      : fs.readFileSync(file);
  const entries = new Map();
  for (let offset = 0; offset + 512 <= data.length; ) {
    const header = data.subarray(offset, offset + 512);
    if (isZeroBlock(header)) break;

    const name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const mode = parseOctal(readString(header, 100, 8));
    const size = parseOctal(readString(header, 124, 12));
    const typeflag = readString(header, 156, 1) || "0";
    const contentStart = offset + 512;
    const content = data.subarray(contentStart, contentStart + size);

    entries.set(fullName, {
      content,
      file: typeflag === "0" || typeflag === "\0" || typeflag === "",
      mode,
      size,
      typeflag,
    });
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function isZeroBlock(block) {
  for (const byte of block) {
    if (byte !== 0) return false;
  }
  return true;
}

function readString(buffer, start, length) {
  return buffer
    .subarray(start, start + length)
    .toString("utf8")
    .replace(/\0.*$/g, "")
    .trim();
}

function parseOctal(text) {
  const normalized = text.replace(/\0/g, "").trim();
  return normalized === "" ? 0 : Number.parseInt(normalized, 8);
}
