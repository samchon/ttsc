// Builds one native platform package for its target.
//
// `@ttsc/{os}-{arch}` carries the ttsc helper, the ttscserver LSP proxy, the
// local Go cache helper and the bundled Go compiler that source plugins build
// with. `@ttsc/graph-{os}-{arch}`
// carries only the ttscgraph producer that `@ttsc/graph` spawns, so a project
// without the graph downloads none of it. Both build from packages/ttsc with
// the same flags and the same version stamp.
//
// Every 32-bit arm executable is built with GOARM=6: the arm package bundles the
// armv6l SDK, and without it Go defaults to ARMv7, which that baseline cannot run.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const cwd = process.cwd();
const manifestPath = path.join(cwd, "package.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (
  manifest.artifactManifestSHA256 !== undefined ||
  manifest.artifactNoticesSHA256 !== undefined
) {
  delete manifest.artifactManifestSHA256;
  delete manifest.artifactNoticesSHA256;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
const [, graphPrefix, npmOs, npmArch] =
  /^@ttsc\/(graph-)?(linux|darwin|win32)-(x64|arm|arm64)$/.exec(
    manifest.name,
  ) ?? [];
if (!npmOs) throw new Error(`unsupported platform package ${manifest.name}`);
const graph = graphPrefix !== undefined;
const commands = graph
  ? [["ttscgraph", "./cmd/ttscgraph"]]
  : [
      ["ttsc", "./cmd/platform"],
      ["ttscserver", "./cmd/ttscserver"],
      ["ttsc-cache", "./cmd/ttsc-cache"],
    ];

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
for (const [name, pkg] of commands) {
  cp.execFileSync(
    "go",
    [
      "build",
      "-trimpath",
      `-ldflags=${ldflags}`,
      "-o",
      path.join(bin, name + exe),
      pkg,
    ],
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

const executables = commands.map(([name]) => `./bin/${name}`);
if (!graph) {
  copyGo(targetGoRoot());
  copyApprovedArtifactManifest();
  const tools = path.join(bundledGo, "pkg", "tool");
  const files = [...(fs.existsSync(tools) ? walk(tools) : [])];
  if (npmOs !== "win32")
    for (const file of [
      path.join(bundledGo, "bin", "go"),
      path.join(bundledGo, "bin", "gofmt"),
      ...files,
    ])
      if (fs.existsSync(file)) fs.chmodSync(file, 0o755);
  executables.push(
    "./bin/go/bin/go",
    "./bin/go/bin/gofmt",
    ...files
      .map((file) => `./${path.relative(cwd, file).replace(/\\/g, "/")}`)
      .sort(),
  );
}

// A release operator supplies the exact manifest bytes and their independently
// approved digest. Artifact coverage is optional for every platform package.
function copyApprovedArtifactManifest() {
  const manifestSource = process.env.TTSC_RELEASE_ARTIFACT_MANIFEST;
  const expected = process.env.TTSC_RELEASE_ARTIFACT_SHA256;
  const noticesSource = process.env.TTSC_RELEASE_ARTIFACT_NOTICES;
  const noticesExpected = process.env.TTSC_RELEASE_ARTIFACT_NOTICES_SHA256;
  if (
    manifestSource === undefined &&
    expected === undefined &&
    noticesSource === undefined &&
    noticesExpected === undefined
  ) return;
  if (
    !manifestSource ||
    !path.isAbsolute(manifestSource) ||
    !/^[0-9a-f]{64}$/.test(expected ?? "") ||
    !noticesSource ||
    !path.isAbsolute(noticesSource) ||
    !/^[0-9a-f]{64}$/.test(noticesExpected ?? "")
  )
    throw new Error(
      "release artifacts require absolute manifest and notices paths with approved SHA-256 digests",
    );
  const info = fs.lstatSync(manifestSource);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size < 1 ||
    info.size > 16 << 20
  )
    throw new Error(
      "release artifact manifest is not an ordinary bounded file",
    );
  const raw = fs.readFileSync(manifestSource);
  const digest = crypto.createHash("sha256").update(raw).digest("hex");
  if (digest !== expected)
    throw new Error("release artifact manifest differs from approved SHA-256");
  const noticesInfo = fs.lstatSync(noticesSource);
  if (
    !noticesInfo.isFile() ||
    noticesInfo.isSymbolicLink() ||
    noticesInfo.size < 1 ||
    noticesInfo.size > 1 << 20
  )
    throw new Error("artifact notices must be an ordinary bounded file");
  const notices = fs.readFileSync(noticesSource);
  const noticesDigest = crypto.createHash("sha256").update(notices).digest("hex");
  if (noticesDigest !== noticesExpected)
    throw new Error("artifact notices differ from approved SHA-256");
  cp.execFileSync(
    "go",
    ["run", "./cmd/ttsc-cache", "-verify", "-manifest", manifestSource, "-manifest-sha256", expected],
    { cwd: source, stdio: "inherit" },
  );
  const artifact = JSON.parse(raw.toString("utf8"));
  const head = out("git", ["rev-parse", "HEAD"], { cwd: root });
  if (
    artifact.schema !== 1 ||
    artifact.release !== manifest.version ||
    artifact.sourceCommit !== head ||
    artifact.tuple?.goos !== goos ||
    artifact.tuple?.goarch !== goarch ||
    artifact.tuple?.cgoEnabled !== "0" ||
    !Array.isArray(artifact.packs) ||
    artifact.packs.length === 0 ||
    artifact.packs.some(
      (pack) =>
        typeof pack.url !== "string" || !pack.url.startsWith("https://"),
    )
  )
    throw new Error(
      "release artifact manifest does not describe this commit, target and immutable HTTPS transport",
    );
  const directory = path.join(bin, "artifacts");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "manifest.json"), raw, { flag: "wx" });
  fs.writeFileSync(path.join(directory, "THIRD_PARTY_NOTICES.txt"), notices, {
    flag: "wx",
  });
  manifest.artifactManifestSHA256 = digest;
  manifest.artifactNoticesSHA256 = noticesDigest;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
if (npmOs !== "win32") {
  manifest.publishConfig = {
    ...manifest.publishConfig,
    executableFiles: executables,
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
    out(
      "curl",
      [
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "https://go.dev/dl/?mode=json&include=all",
      ],
      {
        maxBuffer: 1 << 28,
      },
    ),
  );
  const checksum = downloads
    .find((release) => release.version === version)
    ?.files.find((file) => file.filename === archive)?.sha256;
  if (!checksum)
    throw new Error(`official Go metadata has no checksum for ${archive}`);

  const file = path.join(cache, archive);
  const digest = () =>
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (!fs.existsSync(file) || digest() !== checksum)
    cp.execFileSync(
      "curl",
      ["-L", "--fail", "-o", file, `https://go.dev/dl/${archive}`],
      {
        stdio: "inherit",
      },
    );
  if (digest() !== checksum)
    throw new Error(`checksum mismatch for ${archive}`);

  fs.rmSync(extracted, { recursive: true, force: true });
  fs.mkdirSync(extracted, { recursive: true });
  // Relative operands: GNU tar on Windows reads `D:\...` as a remote host.
  if (archive.endsWith(".zip") && process.platform !== "win32")
    cp.execFileSync("unzip", ["-q", archive, "-d", target], {
      cwd: cache,
      stdio: "inherit",
    });
  else
    cp.execFileSync("tar", ["-xf", archive, "-C", target], {
      cwd: cache,
      stdio: "inherit",
    });
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
      return (
        directory ||
        ["go", "go.exe", "gofmt", "gofmt.exe"].includes(path.basename(rel))
      );
    if (first === "pkg") return second === "tool" || second === "include";
    if (first === "src")
      return directory || parts.length > 2
        ? second !== "cmd"
        : ["go.mod", "go.sum"].includes(second);
    return first === "lib" && second === "time";
  };
  const copy = (from, to, rel) => {
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
      if (rel && !keep(rel, true)) return;
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from))
        copy(
          path.join(from, entry),
          path.join(to, entry),
          rel ? `${rel}/${entry}` : entry,
        );
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
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
}
