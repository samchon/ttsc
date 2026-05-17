// Packs typia's d.ts surface into a JSON file consumed by Monaco's
// `addExtraLib` so the playground source editor can resolve
// `import typia, { tags } from "typia"` without red squigglies.
//
// We walk every `.d.ts` file under the packages typia's public types depend
// on. Anything Monaco still can't resolve is shimmed with an ambient module
// declaration (see the AMBIENT_MODULE_STUBS list below). The output goes to
// `src/compiler/typia-types.json` keyed by `file:///node_modules/...` paths.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "src/compiler/typia-types.json");

// Packages whose `lib/` (or fallback `dist/`) d.ts trees we copy in full.
// Order matters only for readability; Monaco resolves by path.
const PACKAGES = [
  { name: "typia", subdir: "lib" },
  { name: "@typia/interface", subdir: "lib" },
  { name: "@typia/utils", subdir: "lib" },
  { name: "@standard-schema/spec", subdir: "dist" },
];

// Ambient stubs for transitive references that appear in typia .d.ts files
// (mostly inside JSDoc-tagged example imports) but whose real packages aren't
// shipped to the browser.
const AMBIENT_MODULE_STUBS = [
  "@typia/mcp",
  "@typia/core",
  "@modelcontextprotocol/sdk/server/mcp.js",
  "node-fetch",
  "ttsc",
];

function findPackageDir(name) {
  // We walk node_modules trees starting at known roots — the website, the
  // monorepo root, and typia's own pnpm folder so that peer deps like
  // `@standard-schema/spec` are reachable. `require.resolve` is unreliable
  // for sibling packages whose `exports` map blocks `./package.json`.
  const typiaRoot = (() => {
    try {
      return path.dirname(
        require.resolve("typia/package.json", { paths: [ROOT] }),
      );
    } catch {
      return null;
    }
  })();
  const seeds = [
    ROOT,
    path.join(ROOT, ".."),
    ...(typiaRoot ? [typiaRoot, path.join(typiaRoot, "..")] : []),
  ];
  for (const seed of seeds) {
    let current = seed;
    while (true) {
      const candidate = path.join(current, "node_modules", name);
      if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

function collectDtsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(".d.ts")) out.push(full);
    }
  }
  return out;
}

function main() {
  const packed = {};
  for (const { name, subdir } of PACKAGES) {
    const pkgDir = findPackageDir(name);
    if (!pkgDir) {
      console.warn(`[build:typia-types] could not resolve ${name}, skipping`);
      continue;
    }
    const root = path.join(pkgDir, subdir);
    if (!fs.existsSync(root)) {
      console.warn(`[build:typia-types] ${name}/${subdir} missing, skipping`);
      continue;
    }
    const files = collectDtsFiles(root);
    for (const file of files) {
      const rel = path.relative(pkgDir, file).split(path.sep).join("/");
      const key = `file:///node_modules/${name}/${rel}`;
      packed[key] = fs.readFileSync(file, "utf8");
    }
    // Also expose package.json so Monaco's resolver can pick up
    // the `types`/`exports` field.
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      packed[`file:///node_modules/${name}/package.json`] =
        fs.readFileSync(pkgJsonPath, "utf8");
    }
  }

  for (const moduleName of AMBIENT_MODULE_STUBS) {
    const key = `file:///node_modules/__ttsc_playground_stub_${moduleName.replace(
      /[^a-z0-9]+/gi,
      "_",
    )}.d.ts`;
    packed[key] = `declare module "${moduleName}" {\n  const value: any;\n  export = value;\n}\n`;
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(packed), "utf8");

  const fileCount = Object.keys(packed).length;
  const bytes = fs.statSync(OUT_FILE).size;
  console.log(
    `[build:typia-types] wrote ${fileCount} entries (${(bytes / 1024).toFixed(
      1,
    )} KB) to ${path.relative(ROOT, OUT_FILE)}`,
  );
}

main();
