// Build the base `ttsc.wasm` and stage the matching `wasm_exec.js`.
//
// Usage: node build/build-wasm.cjs [--force]
//
// The cache records a content identity for every effective Go dependency,
// module manifest, build flag, toolchain bridge, and published shim artifact.
// It never accepts a partially staged publication directory as a cache hit.

const cp = require("child_process");
const fs = require("fs");
const path = require("path");

const { createGoBuildCache } = require("../../../scripts/go-build-cache.cjs");

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");
const shimSrc = path.join(ttscDir, "shim");
const vendorDir = path.join(packageRoot, "shim-vendor");
const vendorShimDir = path.join(vendorDir, "shim");
const outDir = path.join(packageRoot, "dist");
const wasmOut = path.join(outDir, "ttsc.wasm");
const wasmExecOut = path.join(outDir, "wasm_exec.js");
const goModPath = path.join(packageRoot, "go.mod");
const publishedGoModOut = path.join(outDir, "go.mod");
const cachePath = path.join(outDir, ".ttsc-wasm-build.json");
const buildArguments = [
  "go",
  "build",
  "-trimpath",
  "-ldflags",
  "-s -w",
  "-o",
  wasmOut,
  "./cmd/ttsc-wasm",
];
const buildEnvironment = { GOOS: "js", GOARCH: "wasm" };

function locateWasmExec() {
  let goroot;
  try {
    goroot =
      process.env.GOROOT ??
      cp.execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
  // Go 1.24+ ships wasm_exec.js under lib/wasm/. Older releases kept it
  // under misc/wasm/. Try both so the build works across Go installs.
  for (const candidate of [
    path.join(goroot, "lib", "wasm", "wasm_exec.js"),
    path.join(goroot, "misc", "wasm", "wasm_exec.js"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function createCacheOptions({ force, wasmExecSrc }) {
  return {
    artifactPaths: [wasmOut, wasmExecOut, publishedGoModOut, vendorShimDir],
    buildArguments,
    cachePath,
    cwd: packageRoot,
    dependencyPackages: ["./cmd/ttsc-wasm"],
    environment: buildEnvironment,
    extraFiles: [__filename, goModPath, wasmExecSrc],
    force,
    inputDirectories: [shimSrc],
  };
}

function buildWasm() {
  console.log(`build/build-wasm.cjs: building ${wasmOut}`);
  cp.execFileSync("go", buildArguments.slice(1), {
    cwd: packageRoot,
    env: { ...process.env, ...buildEnvironment },
    stdio: "inherit",
  });
}

// Mirror packages/ttsc/shim/* into packages/wasm/shim-vendor/shim/* so the
// published @ttsc/wasm tarball is self-contained: consumers extending the
// wasm binary against the @ttsc/wasm Go module no longer need a sibling
// `packages/ttsc/shim/` working tree. The vendored copy is checked in so
// `pnpm pack --dry-run` agrees with what `go build` would see at install
// time. The working-tree `go.mod` still points at `../ttsc/shim/*` for
// local dev; the published `go.mod` is rewritten into `dist/go.mod` and
// swapped in via prepack/postpack.
function vendorShim() {
  if (!fs.existsSync(shimSrc)) {
    throw new Error(
      `build/build-wasm.cjs: shim source missing at ${shimSrc}; run from a full repo checkout`,
    );
  }
  fs.rmSync(vendorShimDir, { recursive: true, force: true });
  fs.mkdirSync(vendorShimDir, { recursive: true });
  copyTree(shimSrc, vendorShimDir);
  console.log(
    `build/build-wasm.cjs: vendored shim/* -> ${path.relative(packageRoot, vendorShimDir)}`,
  );
}

function copyTree(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const base = path.basename(src);
    if (base === "node_modules" || base === ".git") return;
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dst, entry));
    }
  } else if (stat.isFile()) {
    fs.copyFileSync(src, dst);
  }
}

// Rewrite go.mod so the published copy points at ./shim-vendor/shim/* instead
// of ../ttsc/shim/*. The ../ttsc consumer-module replacement is intentionally
// removed: consumers compiling their own wasm binary supply it themselves.
function rewritePublishedGoMod() {
  const lines = fs.readFileSync(goModPath, "utf8").split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^github\.com\/samchon\/ttsc\/packages\/ttsc\s+=>\s+\.\.\/ttsc\b/.test(
        trimmed,
      )
    ) {
      continue;
    }
    const shimMatch = trimmed.match(
      /^(github\.com\/microsoft\/typescript-go\/shim\/[A-Za-z0-9_/]+)\s+=>\s+\.\.\/ttsc\/shim\/([A-Za-z0-9_/]+)$/,
    );
    if (shimMatch) {
      const indent = line.match(/^\s*/)[0];
      out.push(
        `${indent}${shimMatch[1]} => ./shim-vendor/shim/${shimMatch[2]}`,
      );
      continue;
    }
    out.push(line);
  }
  fs.writeFileSync(publishedGoModOut, out.join("\n"));
  console.log(
    `build/build-wasm.cjs: emitted published go.mod -> ${path.relative(packageRoot, publishedGoModOut)}`,
  );
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const wasmExecSrc = locateWasmExec();
  if (!wasmExecSrc) {
    throw new Error(
      "build/build-wasm.cjs: wasm_exec.js not located. Install Go 1.24+.",
    );
  }
  const cache = createGoBuildCache(
    createCacheOptions({
      force: process.argv.includes("--force") || !!process.env.TTSC_WASM_FORCE,
      wasmExecSrc,
    }),
  );
  if (cache.isCurrent()) {
    console.log(
      `build/build-wasm.cjs: cached ttsc.wasm is up to date (${(
        fs.statSync(wasmOut).size /
        1024 /
        1024
      ).toFixed(2)} MiB) -> skipping rebuild`,
    );
    return;
  }

  vendorShim();
  rewritePublishedGoMod();
  buildWasm();
  fs.copyFileSync(wasmExecSrc, wasmExecOut);
  cache.write();
  console.log(
    `build/build-wasm.cjs: done. ttsc.wasm = ${(
      fs.statSync(wasmOut).size /
      1024 /
      1024
    ).toFixed(2)} MiB`,
  );
}

if (require.main === module) main();

module.exports = { createCacheOptions, locateWasmExec };
