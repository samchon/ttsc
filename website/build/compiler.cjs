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
//   • node_modules/.pnpm/typia*/native/adapter — typia's wasm adapter Go.
// We also fold typia's package.json version into the cache key so a bump
// (lockfile change) busts cache even if the adapter Go source didn't move.
const TYPIA_PKG_JSON = path.join(
  ROOT,
  "compiler-dependencies",
  "node_modules",
  "typia",
  "package.json",
);
let typiaPkgVersion = "unknown";
try {
  typiaPkgVersion = JSON.parse(fs.readFileSync(TYPIA_PKG_JSON, "utf8")).version;
} catch {
  /* compiler-dependencies may not be installed yet on a fresh checkout */
}
const TYPIA_NATIVE_ADAPTER = (() => {
  const candidates = [
    path.join(ROOT, "compiler-dependencies", "node_modules", "typia", "native", "adapter"),
    path.join(REPO_ROOT, "node_modules", "typia", "native", "adapter"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fall back: walk node_modules/.pnpm for the first typia/native/adapter.
  const pnpmStore = path.join(REPO_ROOT, "node_modules", ".pnpm");
  if (fs.existsSync(pnpmStore)) {
    for (const entry of fs.readdirSync(pnpmStore)) {
      const candidate = path.join(
        pnpmStore,
        entry,
        "node_modules",
        "typia",
        "native",
        "adapter",
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
})();
const wasmSourceMtime = Math.max(
  newestMtime(COMPILER_DIR),
  newestMtime(path.join(REPO_ROOT, "packages", "wasm")),
  newestMtime(path.join(REPO_ROOT, "packages", "ttsc")),
  newestMtime(path.join(REPO_ROOT, "packages", "lint", "linthost")),
  newestMtime(path.join(REPO_ROOT, "packages", "lint", "rule")),
  TYPIA_NATIVE_ADAPTER ? newestMtime(TYPIA_NATIVE_ADAPTER) : 0,
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
// under `node_modules/typia` (plus @typia/{interface,utils,core}) into one
// JSON blob the worker fetches at boot. Without it, the wasm-side compiler
// can't resolve `import typia, { tags } from "typia"`.
require("./pack-typia-sources.cjs");

log("done.");
