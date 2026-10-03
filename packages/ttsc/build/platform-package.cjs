// Builds one `@ttsc/{os}-{arch}` package: the ttsc, ttscserver and ttscgraph
// executables for its target plus the bundled Go compiler.
//
// The 32-bit arm package bundles the armv6l SDK, so its executables are built
// with GOARM=6; without it Go defaults to ARMv7, which that baseline cannot run.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const cwd = process.cwd();
const manifestPath = path.join(cwd, "package.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const [, npmOs, npmArch] =
  /^@ttsc\/(linux|darwin|win32)-(x64|arm|arm64)$/.exec(manifest.name) ?? [];
if (!npmOs) throw new Error(`unsupported platform package ${manifest.name}`);

const goos = npmOs === "win32" ? "windows" : npmOs;
const goarch = npmArch === "x64" ? "amd64" : npmArch;
const goarm = npmArch === "arm" ? "6" : undefined;
const exe = npmOs === "win32" ? ".exe" : "";
const root = path.resolve(cwd, "../..");
const source = path.join(root, "packages", "ttsc");
const bin = path.join(cwd, "bin");
const bundledGo = path.join(bin, "go");

const out = (command, args, options = {}) =>
  cp.execFileSync(command, args, { encoding: "utf8", ...options }).trim();

fs.rmSync(bin, { recursive: true, force: true });
fs.mkdirSync(bin, { recursive: true });

const commit = (() => {
  try {
    return out("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root });
  } catch {
    return "unknown";
  }
})();
const ldflags = `-s -w -X main.version=${manifest.version} -X main.commit=${commit} -X main.date=${new Date().toISOString()}`;
for (const [name, pkg] of [
  ["ttsc", "./cmd/platform"],
  ["ttscserver", "./cmd/ttscserver"],
  ["ttscgraph", "./cmd/ttscgraph"],
]) {
  cp.execFileSync(
    "go",
    ["build", "-trimpath", `-ldflags=${ldflags}`, "-o", path.join(bin, name + exe), pkg],
    {
      cwd: source,
      stdio: "inherit",
      env: {
        ...process.env,
        CGO_ENABLED: "0",
        GOOS: goos,
        GOARCH: goarch,
        ...(goarm ? { GOARM: goarm } : {}),
      },
    },
  );
  if (npmOs !== "win32") fs.chmodSync(path.join(bin, name), 0o755);
}

copyGo(targetGoRoot());
const tools = path.join(bundledGo, "pkg", "tool");
const files = [...(fs.existsSync(tools) ? walk(tools) : [])];
if (npmOs !== "win32") {
  for (const file of [path.join(bundledGo, "bin", "go"), path.join(bundledGo, "bin", "gofmt"), ...files])
    if (fs.existsSync(file)) fs.chmodSync(file, 0o755);
  manifest.publishConfig = {
    ...manifest.publishConfig,
    executableFiles: [
      "./bin/ttsc",
      "./bin/ttscserver",
      "./bin/ttscgraph",
      "./bin/go/bin/go",
      "./bin/go/bin/gofmt",
      ...files.map((file) => `./${path.relative(cwd, file).replace(/\\/g, "/")}`).sort(),
    ],
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** The Go SDK root for the target: the host's own, or the official archive. */
function targetGoRoot() {
  if (npmOs === process.platform && npmArch === process.arch)
    return out("go", ["env", "GOROOT"], { cwd: source });
  const version = out("go", ["env", "GOVERSION"], { cwd: source });
  const target = `${goos}-${goarm ? `armv${goarm}l` : goarch}`;
  const archive = `${version}.${target}${npmOs === "win32" ? ".zip" : ".tar.gz"}`;
  const cache = path.join(root, ".cache", "go-sdk", version);
  const extracted = path.join(cache, target);
  fs.mkdirSync(cache, { recursive: true });

  const downloads = JSON.parse(
    out("curl", ["-L", "--fail", "--silent", "--show-error", "https://go.dev/dl/?mode=json&include=all"], {
      maxBuffer: 1 << 28,
    }),
  );
  const checksum = downloads
    .find((release) => release.version === version)
    ?.files.find((file) => file.filename === archive)?.sha256;
  if (!checksum) throw new Error(`official Go metadata has no checksum for ${archive}`);

  const file = path.join(cache, archive);
  const digest = () =>
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (!fs.existsSync(file) || digest() !== checksum)
    cp.execFileSync("curl", ["-L", "--fail", "-o", file, `https://go.dev/dl/${archive}`], {
      stdio: "inherit",
    });
  if (digest() !== checksum) throw new Error(`checksum mismatch for ${archive}`);

  fs.rmSync(extracted, { recursive: true, force: true });
  fs.mkdirSync(extracted, { recursive: true });
  // Relative operands: GNU tar on Windows reads `D:\...` as a remote host.
  if (archive.endsWith(".zip") && process.platform !== "win32")
    cp.execFileSync("unzip", ["-q", archive, "-d", target], { cwd: cache, stdio: "inherit" });
  else cp.execFileSync("tar", ["-xf", archive, "-C", target], { cwd: cache, stdio: "inherit" });
  return path.join(extracted, "go");
}

/** Copies the SDK the packages bundle: toolchain, tools and standard library. */
function copyGo(goroot) {
  const keep = (rel, directory) => {
    const parts = rel.split("/");
    if (parts.includes(".git") || parts.includes("testdata")) return false;
    if (!directory && rel.endsWith("_test.go")) return false;
    const [first, second] = parts;
    if (parts.length === 1)
      return directory
        ? ["bin", "pkg", "src", "lib"].includes(first)
        : ["VERSION", "go.env", "LICENSE", "PATENTS"].includes(first);
    if (first === "bin")
      return directory || ["go", "go.exe", "gofmt", "gofmt.exe"].includes(path.basename(rel));
    if (first === "pkg") return second === "tool" || second === "include";
    if (first === "src") return directory || parts.length > 2 ? second !== "cmd" : ["go.mod", "go.sum"].includes(second);
    return first === "lib" && second === "time";
  };
  const copy = (from, to, rel) => {
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
      if (rel && !keep(rel, true)) return;
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from))
        copy(path.join(from, entry), path.join(to, entry), rel ? `${rel}/${entry}` : entry);
    } else if (stat.isFile() && keep(rel, false)) fs.copyFileSync(from, to);
  };
  copy(fs.realpathSync(goroot), bundledGo, "");
  for (const required of [`bin/go${exe}`, "src/fmt", "src/encoding/json"])
    if (!fs.existsSync(path.join(bundledGo, required)))
      throw new Error(`bundled Go compiler is missing ${required}`);
}

function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)],
    );
}
