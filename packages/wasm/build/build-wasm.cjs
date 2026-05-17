// Build the base `ttsc.wasm` and stage the matching `wasm_exec.js`.
//
// Usage: node build/build-wasm.cjs [--force]
//
// Behavior:
//   * Skips the Go build when `dist/ttsc.wasm` is newer than every .go file
//     under `packages/{ttsc,wasm}/`. Pass `--force` or set
//     `TTSC_WASM_FORCE=1` to rebuild unconditionally.
//   * Hard failure if the Go toolchain is missing.
//
// Outputs:
//   * packages/wasm/dist/ttsc.wasm
//   * packages/wasm/dist/wasm_exec.js
//
// Downstream consumers (the website, plugin-author playgrounds) point their
// own bundle pipelines at `node_modules/@ttsc/wasm/dist/wasm_exec.js` and
// build their own .wasm against the same Go module.

const cp = require("child_process");
const fs = require("fs");
const path = require("path");

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
const forceRebuild =
  process.argv.includes("--force") || !!process.env.TTSC_WASM_FORCE;

fs.mkdirSync(outDir, { recursive: true });

function hasGoToolchain() {
  try {
    cp.execSync("go env GOROOT", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function locateWasmExec() {
  if (!hasGoToolchain()) return null;
  const goroot =
    process.env.GOROOT ??
    cp.execSync("go env GOROOT", { encoding: "utf8" }).trim();
  // Go 1.24+ ships wasm_exec.js under lib/wasm/. Older releases kept it
  // under misc/wasm/. Try both so the build works across Go installs.
  const candidates = [
    path.join(goroot, "lib", "wasm", "wasm_exec.js"),
    path.join(goroot, "misc", "wasm", "wasm_exec.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function newestMtime(...roots) {
  let max = 0;
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    walk(root, (_file, stat) => {
      if (stat.mtimeMs > max) max = stat.mtimeMs;
    });
  }
  return max;
}

function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let stat;
    try {
      stat = fs.statSync(cur);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const base = path.basename(cur);
      if (
        base === "node_modules" ||
        base === ".ttsc" ||
        base === ".git" ||
        base === "lib" ||
        base === "dist"
      )
        continue;
      for (const entry of fs.readdirSync(cur)) {
        stack.push(path.join(cur, entry));
      }
    } else if (stat.isFile() && cur.endsWith(".go")) {
      visit(cur, stat);
    }
  }
}

function buildWasm() {
  console.log(`build/build-wasm.cjs: building ${wasmOut}`);
  cp.execFileSync(
    "go",
    [
      "build",
      "-trimpath",
      "-ldflags",
      "-s -w",
      "-o",
      wasmOut,
      "./cmd/ttsc-wasm",
    ],
    {
      cwd: packageRoot,
      env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
      stdio: "inherit",
    },
  );
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
    `build/build-wasm.cjs: vendored shim/* → ${path.relative(packageRoot, vendorShimDir)}`,
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

// Rewrite go.mod so the published copy points at ./shim-vendor/shim/* instead of
// ../ttsc/shim/*. The `replace github.com/samchon/ttsc/packages/ttsc => ...`
// line is dropped: consumers of the published tarball who want to compile
// their own wasm binary must supply that module themselves (documented in
// README.md). The working-tree go.mod is untouched.
function rewritePublishedGoMod() {
  const src = fs.readFileSync(goModPath, "utf8");
  const lines = src.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Drop the ../ttsc consumer-module replace (handled at consumer side).
    if (
      /^github\.com\/samchon\/ttsc\/packages\/ttsc\s+=>\s+\.\.\/ttsc\b/.test(
        trimmed,
      )
    ) {
      continue;
    }
    // Rewrite each shim replace from ../ttsc/shim/X to ./shim-vendor/shim/X.
    const shimMatch = trimmed.match(
      /^(github\.com\/microsoft\/typescript-go\/shim\/[A-Za-z0-9_/]+)\s+=>\s+\.\.\/ttsc\/shim\/([A-Za-z0-9_/]+)$/,
    );
    if (shimMatch) {
      const indent = line.match(/^\s*/)[0];
      out.push(`${indent}${shimMatch[1]} => ./shim-vendor/shim/${shimMatch[2]}`);
      continue;
    }
    out.push(line);
  }
  fs.writeFileSync(publishedGoModOut, out.join("\n"));
  console.log(
    `build/build-wasm.cjs: emitted published go.mod → ${path.relative(packageRoot, publishedGoModOut)}`,
  );
}

const wasmExecSrc = locateWasmExec();

if (!forceRebuild && fs.existsSync(wasmOut)) {
  const wasmMtime = fs.statSync(wasmOut).mtimeMs;
  const sourceMtime = newestMtime(packageRoot, ttscDir);
  if (sourceMtime > 0 && wasmMtime >= sourceMtime) {
    console.log(
      `build/build-wasm.cjs: cached ttsc.wasm is up to date (${(
        fs.statSync(wasmOut).size /
        1024 /
        1024
      ).toFixed(2)} MiB) — skipping rebuild`,
    );
    if (wasmExecSrc && !fs.existsSync(wasmExecOut)) {
      fs.copyFileSync(wasmExecSrc, wasmExecOut);
    }
    // Even on cache hit, refresh the vendored shim + published go.mod so
    // `pnpm pack` always sees up-to-date publish artifacts.
    vendorShim();
    rewritePublishedGoMod();
    return;
  }
}

if (!wasmExecSrc) {
  console.error(
    "build/build-wasm.cjs: wasm_exec.js not located. Install Go 1.24+.",
  );
  process.exit(1);
}

vendorShim();
rewritePublishedGoMod();
buildWasm();
fs.copyFileSync(wasmExecSrc, wasmExecOut);

console.log(
  `build/build-wasm.cjs: done. ttsc.wasm = ${(
    fs.statSync(wasmOut).size /
    1024 /
    1024
  ).toFixed(2)} MiB`,
);
