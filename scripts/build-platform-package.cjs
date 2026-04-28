const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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
const buildGo = resolveBuildGo(pathValue);

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

function resolveBuildGo(envPath) {
  if (process.env.TTSC_GO_BINARY) {
    return process.env.TTSC_GO_BINARY;
  }
  return "go";
}

function embedGoToolchain() {
  const currentMatchesTarget = npmOs === process.platform && npmArch === process.arch;
  const explicitGoRoot = process.env.TTSC_GO_ROOT;
  if (!currentMatchesTarget && !explicitGoRoot) {
    throw new Error(
      `build-platform-package: cannot embed Go compiler for ${manifest.name}: ` +
        `build host is ${process.platform}/${process.arch}. ` +
        `Set TTSC_GO_ROOT to a ${npmOs}/${npmArch} Go SDK root when cross-packaging.`,
    );
  }

  const goroot = explicitGoRoot ?? readGoRoot();
  if (!goroot || !fs.existsSync(path.join(goroot, "bin", npmOs === "win32" ? "go.exe" : "go"))) {
    throw new Error(
      `build-platform-package: Go compiler root not found for ${manifest.name}. ` +
        `Set TTSC_GO_ROOT to a Go SDK root containing bin/${npmOs === "win32" ? "go.exe" : "go"}.`,
    );
  }

  console.log(`Embedding Go compiler ${goroot} -> ${path.relative(root, bundledGoDir)}`);
  fs.cpSync(goroot, bundledGoDir, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      if (base === ".git") return false;
      return true;
    },
  });
  chmodGoExecutables(bundledGoDir);
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
