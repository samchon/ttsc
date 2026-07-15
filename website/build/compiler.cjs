// Build pipeline for the playground compiler worker.
//
// Produces three artifacts the playground depends on:
//
//   1. `public/compiler/playground.wasm` — the website's consumer wasm.
//      Built from `website/compiler/cmd/playground` against `@ttsc/wasm`'s
//      host helper, with banner / paths / strip wired in.
//   2. `public/compiler/wasm_exec.js` — Go's bootstrap shim. Copied from
//      `node_modules/@ttsc/wasm/dist/wasm_exec.js` so the worker can
//      `importScripts` it before instantiating the wasm.
//   3. `public/compiler/index.js` — the rspack-bundled Web Worker that
//      drives the in-browser compile through tgrid's WorkerServer.
//
// `build/typia-types.cjs` keeps populating Monaco's `addExtraLib` source so
// red-squigglies stay quiet inside the editor.

const cp = require("child_process");
const fs = require("fs");
const path = require("path");

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

const newestMtime = (root) => {
  let max = 0;
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
        base === ".git" ||
        base === "lib" ||
        base === "dist" ||
        base === ".ttsc"
      )
        continue;
      for (const entry of fs.readdirSync(cur)) {
        stack.push(path.join(cur, entry));
      }
    } else if (stat.isFile() && cur.endsWith(".go")) {
      if (stat.mtimeMs > max) max = stat.mtimeMs;
    }
  }
  return max;
};

// ── 1. Build playground.wasm ──────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });

const force =
  process.argv.includes("--force") || !!process.env.TTSC_PLAYGROUND_FORCE;

// The cache key has to track every Go source the playground links in:
//   • compiler/ — the playground entry itself.
//   • packages/wasm — the host helper.
//   • packages/ttsc — the compiler + driver.
//   • packages/lint/linthost + rule — the lint engine the playground exposes.
//   • typia/native/adapter — typia's wasm adapter Go (resolved through the
//     same go.mod replace the compiler module uses, so the cache key tracks
//     the EXACT typia install the wasm is compiled against, not a different
//     install that happens to share a major version).
//
// Resolve the one website/node_modules/typia install named by compiler/go.mod.
// The same graph object owns the version stamp and all generated packs.
const { createTypiaDependencyGraph } = require("./typia-dependency-graph.cjs");
const typiaGraph = createTypiaDependencyGraph({ websiteRoot: ROOT });
const typiaPkgVersion = typiaGraph.version;
const TYPIA_NATIVE_ADAPTER = typiaGraph.goAdapterRoot;
const wasmSourceMtime = Math.max(
  newestMtime(COMPILER_DIR),
  newestMtime(path.join(REPO_ROOT, "packages", "wasm")),
  newestMtime(path.join(REPO_ROOT, "packages", "ttsc")),
  newestMtime(path.join(REPO_ROOT, "packages", "lint", "linthost")),
  newestMtime(path.join(REPO_ROOT, "packages", "lint", "rule")),
  newestMtime(TYPIA_NATIVE_ADAPTER),
);
// Stamp the typia version into a sidecar file so a version bump alone busts
// the cache. The wasm itself doesn't carry the version, so without this a
// floor-mtime cache hit would silently keep using yesterday's typia.
const TYPIA_VERSION_STAMP = path.join(OUT_DIR, ".typia-version");
let lastTypiaVersion = null;
try {
  lastTypiaVersion = fs.readFileSync(TYPIA_VERSION_STAMP, "utf8").trim();
} catch {
  /* first run — no stamp yet */
}
const typiaVersionChanged = lastTypiaVersion !== typiaPkgVersion;
const cached =
  !force &&
  !typiaVersionChanged &&
  fs.existsSync(WASM_OUT) &&
  fs.statSync(WASM_OUT).mtimeMs >= wasmSourceMtime;

if (cached) {
  log(
    `playground.wasm is up to date (${(
      fs.statSync(WASM_OUT).size /
      1024 /
      1024
    ).toFixed(2)} MiB) — skipping Go build`,
  );
} else {
  log(`building playground.wasm`);
  if (typiaVersionChanged && lastTypiaVersion !== null) {
    log(
      `typia version changed (${lastTypiaVersion} → ${typiaPkgVersion}); rebuilding`,
    );
  }
  run(
    `go build -trimpath -ldflags "-s -w" -o ${JSON.stringify(WASM_OUT)} ./cmd/playground`,
    {
      cwd: COMPILER_DIR,
      env: { GOOS: "js", GOARCH: "wasm" },
    },
  );
  log(
    `playground.wasm = ${(
      fs.statSync(WASM_OUT).size /
      1024 /
      1024
    ).toFixed(2)} MiB`,
  );
  fs.writeFileSync(TYPIA_VERSION_STAMP, typiaPkgVersion);
}

// ── 2. Stage wasm_exec.js ────────────────────────────────────────────────
if (!fs.existsSync(WASM_EXEC_SRC)) {
  log(
    `@ttsc/wasm dist not built yet; running its build to source wasm_exec.js`,
  );
  run("pnpm run build:wasm", {
    cwd: path.join(REPO_ROOT, "packages", "wasm"),
  });
}
fs.copyFileSync(WASM_EXEC_SRC, WASM_EXEC_OUT);
log(
  `copied wasm_exec.js (${(
    fs.statSync(WASM_EXEC_OUT).size / 1024
  ).toFixed(1)} KB)`,
);

// ── 3. Bundle the worker entry with rspack ────────────────────────────────
log(`bundling the playground compiler worker with rspack`);
run("npx --no-install rspack");

// ── 4. Keep typia type definitions for Monaco's editor squigglies ──────────
require("./typia-types.cjs");

// ── 5. Build the typia source pack the worker mounts into MemFS ────────────
// Mirrors typia's own `typia-pack.js` flow: copies the published source tree
// under `node_modules/typia` with its discovered dependency closure into one
// JSON blob the worker fetches at boot. Without it, the wasm-side compiler
// can't resolve `import typia, { tags } from "typia"`.
require("./pack-typia-sources.cjs");

// ── 6. Build the typia runtime pack the Execute sandbox uses ──────────────
// The playground's "Execute" button runs the transformed bundle inside a
// `new Function(...)` sandbox. The bundle does `require("typia/lib/internal/X")`
// for the per-feature helpers typia's transform emits (validators, random
// generators, JSON encoders). Without resolvable modules, every Execute
// throws. The runtime pack follows those real requires transitively.
require("./pack-typia-runtime.cjs");

log("done.");
