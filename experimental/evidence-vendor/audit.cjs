// One sweep over every assumption the vendored tree can carry from upstream.
const fs = require("node:fs");
const path = require("node:path");
// Two directories below the repository root, derived rather than spelled.
const ROOT = path.resolve(__dirname, "..", "..");
process.chdir(ROOT);

const TREES = [
  "packages/evidence/src",
  "packages/evidence/native",
  "benchmarks/evidence/src",
  "tests/test-evidence/src",
  "tests/test-evidence-benchmark/src",
  ".agents/skills/project/evidence",
  ".agents/skills/benchmark/evidence",
];
const DOCS = [
  "packages/evidence/README.md",
  "benchmarks/evidence/README.md",
  "website/src/content/docs/evidence/index.mdx",
  "website/src/content/docs/evidence/claims.mdx",
  "website/src/content/docs/evidence/tags.mdx",
  "website/src/content/docs/evidence/rules.mdx",
  "website/src/content/docs/evidence/wiring.mdx",
  "website/src/content/docs/evidence/adoption.mdx",
  "website/src/content/docs/setup/evidence.mdx",
];
const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name).split(path.sep).join("/");
    if (e.isDirectory()) {
      if (
        !["node_modules", "lib", ".git", "output", "aggregate"].includes(e.name)
      )
        walk(p, o);
    } else o.push(p);
  }
  return o;
};
const findings = [];
const add = (kind, where, what) => findings.push({ kind, where, what });
const ALL = [...TREES.flatMap((t) => walk(t)), ...DOCS];

// A. repository-relative path literals that must exist on disk
const PATHY =
  /["'`(\[]((?:packages|tests|experimental|scripts|website|config|\.agents|\.github|benchmark)\/[A-Za-z0-9_./*<>-]+)/g;
for (const f of ALL) {
  if (!/\.(ts|tsx|go|md|mdx|json|cjs|mjs)$/.test(f)) continue;
  for (const m of fs.readFileSync(f, "utf8").matchAll(PATHY)) {
    const raw = m[1];
    if (/[*<>]/.test(raw)) {
      const fixed = raw.split(/[*<]/)[0].replace(/\/+$/, "");
      if (fixed.split("/").length >= 2 && !fs.existsSync(fixed))
        add("path", f, raw);
      continue;
    }
    if (!fs.existsSync(raw)) add("path", f, raw);
  }
}

// B. bare specifiers versus the manifest that must declare them
const OWNER = {
  "packages/evidence/src": "packages/evidence/package.json",
  "benchmarks/evidence/src": "benchmarks/evidence/package.json",
  "tests/test-evidence/src": "tests/test-evidence/package.json",
  "tests/test-evidence-benchmark/src":
    "tests/test-evidence-benchmark/package.json",
};
// A suite that imports another package's source inherits that package's imports.
const INHERITS = {
  "tests/test-evidence-benchmark/src": ["benchmarks/evidence/src"],
};
const declared = (mf) => {
  const m = JSON.parse(fs.readFileSync(mf, "utf8"));
  return new Set([
    ...Object.keys(m.dependencies || {}),
    ...Object.keys(m.devDependencies || {}),
    ...Object.keys(m.peerDependencies || {}),
  ]);
};
const bareOf = (tree) => {
  const out = new Set();
  for (const f of walk(tree)) {
    if (!/\.tsx?$/.test(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(
      /^\s*(?:import|export)[\s\S]{0,400}?from\s+["']([^."'][^"']*)["']/gm,
    )) {
      const s = m[1];
      if (s.startsWith("node:")) continue;
      out.add(
        s.startsWith("@")
          ? s.split("/").slice(0, 2).join("/")
          : s.split("/")[0],
      );
    }
    for (const m of text.matchAll(/^\s*import\s+["']([^."'][^"']*)["']/gm))
      out.add(m[1]);
  }
  return out;
};
for (const [tree, mf] of Object.entries(OWNER)) {
  const have = declared(mf);
  const need = new Set(bareOf(tree));
  for (const inherited of INHERITS[tree] || [])
    for (const b of bareOf(inherited)) need.add(b);
  for (const b of [...need].sort()) if (!have.has(b)) add("dependency", mf, b);
}

// C. package scripts invoking a bin that install cannot create
for (const mf of Object.values(OWNER)) {
  const m = JSON.parse(fs.readFileSync(mf, "utf8"));
  for (const [name, cmd] of Object.entries(m.scripts || {})) {
    const head = String(cmd).trim().split(/\s+/)[0];
    if (
      ["ttsx", "ttsc", "ttscserver", "ttsc-lint", "ttsc-graph"].includes(head)
    )
      add(
        "bin",
        mf,
        name +
          ': "' +
          head +
          '" is linked from ttsc/lib, absent at install time',
      );
  }
}

// D. cross-references to things this repository does not have
for (const f of ALL) {
  if (!/\.(ts|tsx|go|md|mdx)$/.test(f)) continue;
  const text = fs.readFileSync(f, "utf8");
  const lines = text.split("\n");
  for (const m of text.matchAll(/\.wiki\/[A-Za-z0-9_./-]+/g))
    if (!fs.existsSync(m[0])) add("xref", f, m[0]);
  for (const m of text.matchAll(/`?([a-z][a-z-]{2,})`? skill\b/g)) {
    const s = m[1];
    if (
      ![
        "the",
        "this",
        "that",
        "one",
        "same",
        "other",
        "own",
        "each",
        "its",
      ].includes(s) &&
      !fs.existsSync(".agents/skills/" + s)
    )
      add("xref", f, s + " skill");
  }
  for (const m of text.matchAll(/#(\d{1,4})\b/g)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (/lint-plugin-evidence|ttsc/.test(before)) continue;
    const line = lines[text.slice(0, m.index).split("\n").length - 1] || "";
    if (/issue|PR\b|pull/i.test(line)) add("xref", f, "bare #" + m[1]);
  }
  for (const m of text.matchAll(
    /raw\.githubusercontent\.com\/samchon\/([a-z-]+)/g,
  ))
    if (!["sponsor-images", "ttsc"].includes(m[1]))
      add("xref", f, "upstream asset host: " + m[1]);
  for (const m of text.matchAll(/@samchon\/[a-z-]+/g)) add("xref", f, m[0]);
}

// E. skill links
for (const dir of [
  ".agents/skills/project/evidence",
  ".agents/skills/benchmark/evidence",
])
  for (const f of walk(dir))
    for (const m of fs
      .readFileSync(f, "utf8")
      .matchAll(/\]\(([^)#:]+\.mdx?)(#[^)]*)?\)/g))
      if (!fs.existsSync(path.resolve(path.dirname(f), m[1])))
        add("link", f, m[1]);

// F. TypeScript sources no suite reads
const read = new Set();
const norm = (p) => path.resolve(p).split(path.sep).join("/");
const resolveRel = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec);
  for (const s of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"])
    if (fs.existsSync(base + s) && fs.statSync(base + s).isFile())
      return norm(base + s);
  return null;
};
const visit = (f) => {
  if (read.has(f)) return;
  read.add(f);
  for (const m of fs
    .readFileSync(f, "utf8")
    .matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const t = resolveRel(f, m[1]);
    if (t) visit(t);
  }
};
for (const entry of [
  "tests/test-evidence/src/index.ts",
  "tests/test-evidence-benchmark/src/index.ts",
])
  if (fs.existsSync(entry)) visit(norm(entry));
for (const tree of ["benchmarks/evidence/src", "packages/evidence/src"])
  for (const f of walk(tree)) {
    if (!/\.tsx?$/.test(f)) continue;
    if (!read.has(norm(f))) add("unread", tree, f.slice(tree.length + 1));
  }

const by = {};
for (const f of findings) (by[f.kind] ||= []).push(f);
for (const k of Object.keys(by).sort()) {
  const seen = new Set();
  const rows = by[k].filter((f) => {
    const key = f.where + "|" + f.what;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(
    "\n=== " +
      k +
      " (" +
      rows.length +
      " distinct / " +
      by[k].length +
      " total) ===",
  );
  for (const f of rows) console.log("  " + f.where + "  ->  " + f.what);
}
console.log("\nTOTAL " + findings.length);
