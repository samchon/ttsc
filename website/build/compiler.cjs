// Build pipeline for the playground compiler worker.
//
// Produces three artifacts the playground depends on:
//
//   1. public/compiler/playground.wasm, the website's consumer wasm.
//   2. public/compiler/wasm_exec.js, Go's matching bootstrap shim.
//   3. public/compiler/index.js, the rspack-bundled Web Worker.

const cp = require("child_process");
const fs = require("fs");
const path = require("path");

const { createGoBuildCache } = require("../../scripts/go-build-cache.cjs");

const ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ROOT, "..");
const COMPILER_DIR = path.join(ROOT, "compiler");
const OUT_DIR = path.join(ROOT, "public/compiler");
const WASM_OUT = path.join(OUT_DIR, "playground.wasm");
const WASM_EXEC_OUT = path.join(OUT_DIR, "wasm_exec.js");
const WASM_EXEC_SRC = path.join(
  REPO_ROOT,
  "packages",
  "wasm",
  "dist",
  "wasm_exec.js",
);

const log = (message) => {
  // eslint-disable-next-line no-console
  console.log(`[build:compiler] ${message}`);
};

const run = (command, opts = {}) => {
  cp.execSync(command, {
    stdio: "inherit",
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
  });
};

function createCacheOptions({ force, typiaGraph }) {
  return {
    artifactPaths: [WASM_OUT, WASM_EXEC_OUT],
    buildArguments: [
      "go",
      "build",
      "-trimpath",
      "-ldflags",
      "-s -w",
      "-o",
      WASM_OUT,
      "./cmd/playground",
    ],
    cachePath: path.join(OUT_DIR, ".playground-wasm-build.json"),
    cwd: COMPILER_DIR,
    dependencyPackages: ["./cmd/playground"],
    environment: { GOOS: "js", GOARCH: "wasm" },
    extraFiles: [
      __filename,
      WASM_EXEC_SRC,
      path.join(typiaGraph.typiaRoot, "package.json"),
    ],
    force,
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const force =
    process.argv.includes("--force") || !!process.env.TTSC_PLAYGROUND_FORCE;
  const {
    createTypiaDependencyGraph,
  } = require("./typia-dependency-graph.cjs");
  const typiaGraph = createTypiaDependencyGraph({ websiteRoot: ROOT });

  // The bridge belongs to the same Go toolchain as both wasm files. Running
  // @ttsc/wasm's identity-aware build first makes its staged bridge a valid
  // input instead of copying a stale bridge after a website cache hit.
  run("pnpm run build:wasm", {
    cwd: path.join(REPO_ROOT, "packages", "wasm"),
  });
  if (!fs.existsSync(WASM_EXEC_SRC)) {
    throw new Error(
      `@ttsc/wasm did not stage wasm_exec.js at ${WASM_EXEC_SRC}`,
    );
  }

  const cache = createGoBuildCache(createCacheOptions({ force, typiaGraph }));
  if (cache.isCurrent()) {
    log(
      `playground.wasm is up to date (${(
        fs.statSync(WASM_OUT).size /
        1024 /
        1024
      ).toFixed(2)} MiB) -> skipping Go build`,
    );
  } else {
    log("building playground.wasm");
    run(
      `go build -trimpath -ldflags "-s -w" -o ${JSON.stringify(WASM_OUT)} ./cmd/playground`,
      {
        cwd: COMPILER_DIR,
        env: { GOOS: "js", GOARCH: "wasm" },
      },
    );
    fs.copyFileSync(WASM_EXEC_SRC, WASM_EXEC_OUT);
    cache.write();
    log(
      `playground.wasm = ${(fs.statSync(WASM_OUT).size / 1024 / 1024).toFixed(
        2,
      )} MiB`,
    );
    log(
      `copied wasm_exec.js (${(fs.statSync(WASM_EXEC_OUT).size / 1024).toFixed(
        1,
      )} KB)`,
    );
  }

  // 3. Bundle the worker entry with rspack.
  log("bundling the playground compiler worker with rspack");
  run("npx --no-install rspack");

  // 4. Keep typia type definitions for Monaco's editor squigglies.
  require("./typia-types.cjs");

  // 5. Build the typia source pack the worker mounts into MemFS.
  require("./pack-typia-sources.cjs");

  // 6. Build the typia runtime pack the Execute sandbox uses.
  require("./pack-typia-runtime.cjs");

  log("done.");
}

if (require.main === module) main();

module.exports = { createCacheOptions };
