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
const repoRoot = path.resolve(websiteRoot, "..");
const outFile = path.join(websiteRoot, "public", "compiler", "typia-pack.json");

// CRITICAL: source the pack from the SAME typia install the wasm Go binary
// links against. The compiler/go.mod has
//   replace github.com/samchon/typia/packages/typia/native => ../node_modules/typia/native
// which resolves to website/node_modules/typia/native — the pnpm-hoisted
// typia install (may be a newer dev version than compiler-dependencies/).
// If the pack's TypeScript surface drifts from the Go adapter's expectations,
// CollectCallSites returns zero, transform becomes a no-op, and the
// playground emits literal `typia.is(member)`.
//
// The script prefers website/node_modules/typia, then falls back to the
// pnpm virtual store (pnpm puts the real files under
// node_modules/.pnpm/typia@VERSION_.../node_modules/typia), then to the
// website's compiler-dependencies/ tree.
function resolveTypiaRoot(packageName) {
  const candidates = [
    path.join(websiteRoot, "node_modules", ...packageName.split("/")),
  ];
  // pnpm virtual store: walk node_modules/.pnpm for the first matching entry
  const pnpmStore = path.join(repoRoot, "node_modules", ".pnpm");
  if (fs.existsSync(pnpmStore)) {
    for (const entry of fs.readdirSync(pnpmStore)) {
      if (!entry.startsWith(packageName.replace("@", "+").replace("/", "+") + "@") && !entry.startsWith(packageName.split("/")[0] + "+" + packageName.split("/")[1] + "@") && !entry.startsWith(packageName.replace("/", "+") + "@") && !entry.startsWith(packageName + "@")) continue;
      const candidate = path.join(pnpmStore, entry, "node_modules", ...packageName.split("/"));
      candidates.push(candidate);
    }
  }
  candidates.push(
    path.join(websiteRoot, "compiler-dependencies", "node_modules", ...packageName.split("/")),
  );
  for (const c of candidates) {
    try {
      // Resolve symlinks so we end up at the real source the Go module sees.
      const real = fs.realpathSync(c);
      if (fs.existsSync(path.join(real, "package.json"))) return real;
    } catch {
      /* keep trying */
    }
  }
  return candidates[0]; // last-ditch — the warn-on-missing below will catch it
}

// Each entry copies one published package's `src/` tree into the pack under
// `<dest>/src/`. The skip predicate prunes files that pull in build-tool
// imports the playground wasm can't satisfy (e.g. the typia transformer
// entry, which imports its `transformers/` directory — only useful in a
// build pipeline that runs `ttsc-typia`, not inside the wasm).
const SOURCES = [
  {
    dest: "typia",
    pkgRoot: resolveTypiaRoot("typia"),
    // Skip only the truly build-tool-only entries. `transformers/` is NOT
    // skipped: typia's runtime entries (functional.ts, json.ts, http.ts,
    // misc.ts, module.ts, llm.ts, protobuf.ts, notations.ts, reflect.ts) all
    // import `./transformers/NoTransformConfigurationError`, and dropping
    // that file produces TS2307/TS2534/TS2355 errors when the wasm's tsgo
    // loads the typia package. Those errors poison the type checker the
    // typia adapter relies on — every typia.X() call site falls out of
    // CollectCallSites, every transform becomes a no-op, and the playground
    // emits literal `typia.is(member)`.
    skip: (rel) =>
      rel.startsWith("executable/") ||
      rel === "transform.ts",
  },
  {
    dest: "@typia/interface",
    pkgRoot: resolveTypiaRoot("@typia/interface"),
    skip: () => false,
  },
  {
    dest: "@typia/utils",
    pkgRoot: resolveTypiaRoot("@typia/utils"),
    skip: () => false,
  },
  // typia 13.0.0-dev imports StandardSchemaV1 from @standard-schema/spec in
  // _createStandardSchema.ts and module.ts. Without the package on the MemFS
  // those imports emit TS2307 and poison the type checker → typia adapter
  // can't resolve typia.X() call sites → transform is a no-op.
  {
    dest: "@standard-schema/spec",
    pkgRoot: resolveTypiaRoot("@standard-schema/spec"),
    skip: () => false,
    fromDist: true, // ships built dist/, not src/
  },
];

// NOTE: @typia/core is intentionally NOT in SOURCES. typia 13.0.0-dev does
// not import from @typia/core directly (verified via `grep "@typia/core"
// typia/src/`). Including it pulls in @typia/core/src/programmers/*, every
// one of which `import ts from "typescript"` — and no `typescript` package
// is in the MemFS. The resulting TS2307 errors poison the type checker the
// typia adapter depends on.

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

function copyPackageSrc(pack, { dest, pkgRoot, skip, fromDist }) {
  // `fromDist` packages (like @standard-schema/spec) ship the .d.ts under
  // dist/ already — the wasm's tsgo can consume those declarations directly,
  // so we just mount them as-is without the lib/→src/ rewrite.
  if (fromDist) {
    const distRoot = path.join(pkgRoot, "dist");
    if (!fs.existsSync(distRoot)) {
      console.warn(`[pack-typia-sources] missing dist tree for ${dest} at ${distRoot}`);
      return;
    }
    for (const file of walk(distRoot)) {
      const rel = path.relative(distRoot, file).split(path.sep).join("/");
      // include declarations + JS + esm so resolver finds whatever it asks for
      if (!/\.(d\.ts|d\.cts|d\.mts|js|cjs|mjs|ts)$/.test(rel)) continue;
      const key = path.posix.join(dest, "dist", rel);
      pack[key] = fs.readFileSync(file, "utf8");
    }
    const pkgJsonPath = path.join(pkgRoot, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      pack[`${dest}/package.json`] = fs.readFileSync(pkgJsonPath, "utf8");
    }
    return;
  }

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

// Stub `typescript` so `@typia/interface`'s `import type ts from "typescript"`
// resolves without dragging the entire TypeScript Compiler API onto the
// MemFS. We only need the *types* to be reachable — runtime never touches
// this path inside the playground. Any unresolved-symbol use the typia
// adapter triggers against the stub falls back to `any`, which is fine for
// the call sites typia actually emits in the playground examples.
function installTypeScriptStub(pack) {
  pack["typescript/package.json"] = JSON.stringify(
    {
      name: "typescript",
      version: "0.0.0-stub",
      types: "lib/typescript.d.ts",
      main: "lib/typescript.js",
    },
    null,
    2,
  );
  pack["typescript/lib/typescript.d.ts"] = `// Minimal stub used by the playground's typia pack.\n// Real consumers ship their own typescript install; this stub only exists so\n// \`import type ts from "typescript"\` in @typia/interface compiles cleanly\n// inside the wasm's tsgo. The members listed here are the EXACT ts.* types\n// the runtime-relevant typia source files reference (audit: grep "ts\\." in\n// @typia/interface/src/ and typia/src/).\n\ndeclare namespace ts {\n  type Expression = any;\n  type Node = any;\n  type TypeNode = any;\n  type Type = any;\n  type Symbol = any;\n  type SourceFile = any;\n  type Statement = any;\n  type Declaration = any;\n  type TypeChecker = any;\n  type Program = any;\n  type CallExpression = any;\n  type Identifier = any;\n  type StringLiteral = any;\n  type NumericLiteral = any;\n  type ObjectLiteralExpression = any;\n  type ArrayLiteralExpression = any;\n  type PropertyAssignment = any;\n  type Modifier = any;\n  type ImportDeclaration = any;\n  type ImportSpecifier = any;\n  type NamedImports = any;\n  type CompilerOptions = any;\n}\nexport = ts;\nexport as namespace ts;\n`;
  pack["typescript/lib/typescript.js"] = `// Stub. The playground never executes this module at runtime.\nmodule.exports = {};\n`;
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
  installTypeScriptStub(pack);
  fs.writeFileSync(outFile, JSON.stringify(pack));
  const stats = fs.statSync(outFile);
  console.log(
    `[pack-typia-sources] wrote ${Object.keys(pack).length} files (${(
      stats.size / 1024
    ).toFixed(1)} KB) to ${path.relative(websiteRoot, outFile)}`,
  );
}

main();
