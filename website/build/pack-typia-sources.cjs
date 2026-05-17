// Builds website/public/compiler/typia-pack.json — the source pack the
// playground worker mounts at `/work/node_modules/` so the in-browser ttsc
// wasm can resolve `import typia, { tags } from "typia"`.
//
// We ship the original TypeScript source (not the published `.d.ts`/`.js`)
// because the typescript-go compiler embedded in the wasm runs over the
// same code the published package uses; typia's transformer wants to see
// the real call signatures, not their type-only declarations.
//
// Output shape: { [relativePath]: contents }. Mount path is
// `/work/node_modules/<relativePath>`. The companion runtime helper
// `installTypiaPack` (in `src/compiler/typia-pack.ts`) does the mount.
//
// Mirrors typia's own `website/build/typia-pack.js` strategy. Differences:
//
//   - We source from the website's installed `node_modules/typia/src/` (and
//     the @typia/interface, @typia/utils peer packages) — these are the
//     versions the website's package-lock pinned.
//   - We rewrite each package's `package.json` so `main`/`types`/`exports`
//     point at `src/*.ts` instead of the published `lib/*.js`. tsgo's
//     module resolver follows `types` when present.

const fs = require("fs");
const path = require("path");

const websiteRoot = path.resolve(__dirname, "..");
const outFile = path.join(websiteRoot, "public", "compiler", "typia-pack.json");

// Each entry copies one published package's `src/` tree into the pack under
// `<dest>/src/`. The skip predicate prunes files that pull in build-tool
// imports the playground wasm can't satisfy (e.g. the typia transformer
// entry, which imports its `transformers/` directory — only useful in a
// build pipeline that runs `ttsc-typia`, not inside the wasm).
const SOURCES = [
  {
    dest: "typia",
    pkgRoot: path.join(websiteRoot, "node_modules", "typia"),
    skip: (rel) =>
      rel.startsWith("executable/") ||
      rel.startsWith("transformers/") ||
      rel === "transform.ts",
  },
  {
    dest: "@typia/interface",
    pkgRoot: path.join(websiteRoot, "node_modules", "@typia", "interface"),
    skip: () => false,
  },
  {
    dest: "@typia/utils",
    pkgRoot: path.join(websiteRoot, "node_modules", "@typia", "utils"),
    skip: () => false,
  },
  {
    // typia's source imports `@typia/core` for shared runtime helpers; ship
    // it as source too so the compiler can resolve the same names typia's
    // transformer emits.
    dest: "@typia/core",
    pkgRoot: path.join(websiteRoot, "node_modules", "@typia", "core"),
    skip: () => false,
  },
];

// File extensions we copy. `.tsx`/`.mts`/`.cts` are kept for symmetry; in
// practice the trees we pack are all plain `.ts`.
const FILE_FILTER = /\.(ts|tsx|mts|cts)$/;

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out;
}

function copyPackageSrc(pack, { dest, pkgRoot, skip }) {
  const srcRoot = path.join(pkgRoot, "src");
  if (!fs.existsSync(srcRoot)) {
    console.warn(`[pack-typia-sources] missing src tree for ${dest} at ${srcRoot}`);
    return;
  }
  for (const file of walk(srcRoot)) {
    const rel = path.relative(srcRoot, file).split(path.sep).join("/");
    if (skip(rel)) continue;
    if (!FILE_FILTER.test(rel)) continue;
    const key = path.posix.join(dest, "src", rel);
    pack[key] = fs.readFileSync(file, "utf8");
  }

  // Rewrite the package.json so `types`/`main`/`exports` all point at the
  // source tree. tsgo's resolver respects `types`/`exports` like tsc does.
  const pkgJsonPath = path.join(pkgRoot, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    console.warn(`[pack-typia-sources] missing package.json for ${dest}`);
    return;
  }
  const original = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const exportsMap =
    typeof original.exports === "object" && original.exports !== null
      ? rewriteExports(original.exports)
      : {
          ".": "./src/index.ts",
          "./package.json": "./package.json",
        };
  pack[`${dest}/package.json`] = JSON.stringify(
    {
      name: original.name,
      version: original.version,
      type: original.type,
      main: "src/index.ts",
      types: "src/index.ts",
      exports: exportsMap,
    },
    null,
    2,
  );
}

// rewriteExports maps a published `exports` map ({ ".": { "types": "./lib/x.d.ts", ... } })
// onto the equivalent source path ({ ".": "./src/x.ts" }). Preserves the
// subpath conditions so deep imports like `typia/lib/internal/_isFormatUuid`
// still resolve.
function rewriteExports(exports) {
  const out = {};
  for (const [subpath, value] of Object.entries(exports)) {
    if (typeof value === "string") {
      out[subpath] = mapLibToSrc(value);
      continue;
    }
    if (value && typeof value === "object") {
      // Conditional exports: prefer `types` (declaration file) since the
      // wasm's compile reads .ts/.d.ts. Fall back to `import` then `default`.
      const candidate = value.types ?? value.import ?? value.default;
      if (typeof candidate === "string") {
        out[subpath] = mapLibToSrc(candidate);
        continue;
      }
    }
  }
  // Always expose package.json for resolvers that probe it.
  out["./package.json"] = "./package.json";
  return out;
}

function mapLibToSrc(relPath) {
  // ./lib/foo.d.ts → ./src/foo.ts. Wildcards in subpaths (`./lib/internal/*`)
  // are preserved verbatim — the resolver replaces the `*` from the
  // request side.
  let p = relPath.replace(/^\.\/lib\//, "./src/");
  p = p.replace(/\.d\.ts$/, ".ts");
  p = p.replace(/\.mjs$/, ".ts");
  p = p.replace(/\.js$/, ".ts");
  return p;
}

function main() {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const pack = {};
  for (const source of SOURCES) {
    if (!fs.existsSync(source.pkgRoot)) {
      console.warn(
        `[pack-typia-sources] missing package ${source.dest} at ${source.pkgRoot}`,
      );
      continue;
    }
    copyPackageSrc(pack, source);
  }
  fs.writeFileSync(outFile, JSON.stringify(pack));
  const stats = fs.statSync(outFile);
  console.log(
    `[pack-typia-sources] wrote ${Object.keys(pack).length} files (${(
      stats.size / 1024
    ).toFixed(1)} KB) to ${path.relative(websiteRoot, outFile)}`,
  );
}

main();
