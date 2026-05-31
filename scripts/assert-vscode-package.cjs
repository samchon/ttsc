#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const target = process.argv[2];
if (!target) {
  console.error(
    "Usage: node scripts/assert-vscode-package.cjs <package.tgz|package-dir>",
  );
  process.exit(2);
}

function fail(message) {
  console.error(`@ttsc/vscode package assertion failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readTarEntries(file) {
  const data = zlib.gunzipSync(fs.readFileSync(file));
  const entries = new Map();
  for (let offset = 0; offset + 512 <= data.length; ) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header
      .subarray(345, 500)
      .toString("utf8")
      .replace(/\0.*$/, "");
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeText = header
      .subarray(124, 136)
      .toString("utf8")
      .replace(/\0.*$/, "")
      .trim();
    const size = Number.parseInt(sizeText || "0", 8);
    offset += 512;
    entries.set(fullName, data.subarray(offset, offset + size));
    offset += Math.ceil(size / 512) * 512;
  }
  return entries;
}

function readPackageTarget(input) {
  const stat = fs.statSync(input);
  if (stat.isDirectory()) {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(input, "package.json"), "utf8"),
    );
    const vsix = path.join(input, "dist", `ttsc-vscode-${pkg.version}.vsix`);
    return {
      kind: "directory",
      packageJSON: pkg,
      version: pkg.version,
      entries: undefined,
      hasInstall: fs.existsSync(path.join(input, "bin", "install.js")),
      hasLicense: fs.existsSync(path.join(input, "LICENSE")),
      hasLibSourceMap: fs.existsSync(
        path.join(input, "lib", "extension.js.map"),
      ),
      binBytes: fs.existsSync(path.join(input, "bin", "install.js"))
        ? fs.readFileSync(path.join(input, "bin", "install.js"))
        : undefined,
      iconBytes: fs.existsSync(path.join(input, "icon.png"))
        ? fs.readFileSync(path.join(input, "icon.png"))
        : undefined,
      vsixBytes: fs.existsSync(vsix) ? fs.readFileSync(vsix) : undefined,
      vsixPath: vsix,
    };
  }
  const entries = readTarEntries(input);
  const packageJSONBytes = entries.get("package/package.json");
  assert(packageJSONBytes, "tarball missing package/package.json");
  const pkg = JSON.parse(packageJSONBytes.toString("utf8"));
  const vsixName = `package/dist/ttsc-vscode-${pkg.version}.vsix`;
  return {
    kind: "tarball",
    packageJSON: pkg,
    version: pkg.version,
    entries: [...entries.keys()].sort(),
    hasInstall: entries.has("package/bin/install.js"),
    hasLicense: entries.has("package/LICENSE"),
    hasLibSourceMap: entries.has("package/lib/extension.js.map"),
    binBytes: entries.get("package/bin/install.js"),
    iconBytes: undefined,
    vsixBytes: entries.get(vsixName),
    vsixPath: vsixName,
  };
}

function readZipEntries(bytes) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  assert(eocd >= 0, "VSIX central directory not found");
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert(
      bytes.readUInt32LE(offset) === 0x02014b50,
      `bad central directory entry ${i}`,
    );
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let content;
    if (method === 0) {
      content = Buffer.from(compressed);
    } else if (method === 8) {
      content = zlib.inflateRawSync(compressed);
    } else {
      fail(`unsupported VSIX compression method ${method} for ${name}`);
    }
    assert(
      content.length === uncompressedSize,
      `bad VSIX entry size for ${name}`,
    );
    entries.set(name, content);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readPngDimensions(bytes, label) {
  assert(bytes, `missing ${label}`);
  assert(
    bytes.length >= 24 &&
      bytes.readUInt32BE(0) === 0x89504e47 &&
      bytes.readUInt32BE(4) === 0x0d0a1a0a &&
      bytes.toString("ascii", 12, 16) === "IHDR",
    `${label} must be a PNG`,
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

const pkg = readPackageTarget(path.resolve(target));
const iconPath = pkg.packageJSON.icon;
assert(typeof iconPath === "string", "package.json must declare icon");
assert(!path.isAbsolute(iconPath), "package.json icon must be relative");
assert(
  !iconPath.split(/[\\/]/).includes(".."),
  "package.json icon must stay inside the package",
);
pkg.iconBytes =
  pkg.kind === "directory"
    ? fs.existsSync(path.join(path.resolve(target), iconPath))
      ? fs.readFileSync(path.join(path.resolve(target), iconPath))
      : undefined
    : readTarEntries(path.resolve(target)).get(`package/${iconPath}`);
assert(
  pkg.packageJSON.name === "@ttsc/vscode",
  `unexpected npm package name ${pkg.packageJSON.name}`,
);
assert(
  pkg.packageJSON.bin?.["ttsc-vscode"] === "./bin/install.js",
  'package.json must expose bin.ttsc-vscode as "./bin/install.js"',
);
assert(
  JSON.stringify(pkg.packageJSON.extensionKind) ===
    JSON.stringify(["workspace"]),
  'package.json must declare extensionKind ["workspace"]',
);
assert(
  !pkg.packageJSON.dependencies ||
    Object.keys(pkg.packageJSON.dependencies).length === 0,
  "package.json must not declare runtime dependencies",
);
assert(
  !pkg.packageJSON.dependencies?.["vscode-languageclient"],
  "package.json must not depend on vscode-languageclient at runtime",
);
assert(pkg.hasInstall, "missing bin/install.js");
assert(pkg.hasLicense, "missing LICENSE");
assert(!pkg.hasLibSourceMap, "npm package must not ship lib/extension.js.map");
const npmIcon = readPngDimensions(pkg.iconBytes, `npm ${iconPath}`);
assert(
  npmIcon.width === 128 && npmIcon.height === 128,
  `npm ${iconPath} must be 128x128, got ${npmIcon.width}x${npmIcon.height}`,
);
assert(
  pkg.binBytes?.toString("utf8").startsWith("#!/usr/bin/env node\n"),
  "bin/install.js must keep its node shebang",
);
assert(pkg.vsixBytes, `missing ${pkg.vsixPath}`);
if (pkg.entries) {
  const expectedEntries = [
    "package/LICENSE",
    "package/README.md",
    "package/bin/install.js",
    `package/dist/ttsc-vscode-${pkg.version}.vsix`,
    `package/${iconPath}`,
    "package/images/screenshot.png",
    "package/lib/extension.js",
    "package/package.json",
  ].sort();
  assert(
    JSON.stringify(pkg.entries) === JSON.stringify(expectedEntries),
    `unexpected npm tarball entries: ${JSON.stringify(pkg.entries)}`,
  );
}

const vsix = readZipEntries(pkg.vsixBytes);
for (const name of vsix.keys()) {
  assert(
    !name.endsWith(".tgz"),
    `VSIX must not ship local pack artifact ${name}`,
  );
}
for (const required of [
  "extension/package.json",
  "extension/lib/extension.js",
  "extension/LICENSE.txt",
]) {
  assert(vsix.has(required), `VSIX missing ${required}`);
}
assert(
  !vsix.has("extension/lib/extension.js.map"),
  "VSIX must not ship lib/extension.js.map",
);
const manifest = JSON.parse(
  vsix.get("extension/package.json").toString("utf8"),
);
assert(manifest.name === "ttsc", `VSIX manifest name is ${manifest.name}`);
assert(manifest.icon === iconPath, `VSIX manifest icon is ${manifest.icon}`);
assert(vsix.has(`extension/${iconPath}`), `VSIX missing extension/${iconPath}`);
assert(
  vsix.has("extension/images/screenshot.png"),
  "VSIX missing extension/images/screenshot.png",
);
assert(
  manifest.publisher === "samchon",
  `VSIX manifest publisher is ${manifest.publisher}`,
);
assert(
  manifest.version === pkg.version,
  `VSIX version ${manifest.version} does not match package ${pkg.version}`,
);
assert(
  JSON.stringify(manifest.extensionKind) === JSON.stringify(["workspace"]),
  'VSIX manifest must declare extensionKind ["workspace"]',
);
assert(!("bin" in manifest), "VSIX manifest must not include npm bin field");
assert(
  !("files" in manifest),
  "VSIX manifest must not include npm files field",
);
assert(
  !("publishConfig" in manifest),
  "VSIX manifest must not include npm publishConfig field",
);
const vsixIcon = readPngDimensions(
  vsix.get(`extension/${iconPath}`),
  `VSIX ${iconPath}`,
);
assert(
  vsixIcon.width === 128 && vsixIcon.height === 128,
  `VSIX ${iconPath} must be 128x128, got ${vsixIcon.width}x${vsixIcon.height}`,
);

const extensionJS = vsix.get("extension/lib/extension.js").toString("utf8");
assert(
  !/require\((["'])vscode-languageclient(?:\/[^"']*)?\1\)/.test(extensionJS),
  "VSIX extension.js still requires vscode-languageclient at runtime",
);

console.log(
  `@ttsc/vscode package assertions passed (${pkg.kind}, version ${pkg.version})`,
);
