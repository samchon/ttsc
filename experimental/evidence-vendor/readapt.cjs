// Re-adapt freshly copied upstream trees to this workspace.
// Idempotent: safe to run after any re-copy. Ends in a measurement.
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
];
// The two vendored skills nest one level below their host skill, so upstream's
// own shape survives the copy. They take the identifier rewrites of step 1 and
// the root rewrite of step 6, but never the file renames of step 2.
const SKILL_TREES = [
  ".agents/skills/project/evidence",
  ".agents/skills/benchmark/evidence",
];
const TEXT = new Set([
  ".ts",
  ".tsx",
  ".go",
  ".js",
  ".cjs",
  ".mjs",
  ".json",
  ".md",
]);
const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name).split(path.sep).join("/");
    if (e.isDirectory()) {
      if (!["node_modules", "lib", ".git"].includes(e.name)) walk(p, o);
    } else o.push(p);
  }
  return o;
};

// ------------------------------------------------ 0. line endings
// robocopy preserves upstream CRLF; this repository's contract is LF, and an
// anchor written with a bare newline does not match a file that carries CRLF.
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
let normalized = 0;
for (const tree of TREES)
  for (const file of walk(tree)) {
    if (!TEXT.has(path.extname(file))) continue;
    const before = fs.readFileSync(file, "utf8");
    const after = before.split(CR + LF).join(LF);
    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      normalized++;
    }
  }
console.log("0. files normalized to LF:", normalized);

// ---------------------------------------------------------------- 1. renames
const RULES = [
  [/\bIEvidence/g, "ITtscEvidence"],
  [
    /\bEvidenceGraph(Markdown|Prisma|TypeScript)Symbol\b/g,
    "TtscEvidenceGraph$1Symbol",
  ],
  [/@samchon\/lint-plugin-evidence/g, "@ttsc/evidence"],
  [/@samchon\/evidence-benchmark/g, "@ttsc/benchmark-evidence"],
  [
    /github\.com\/samchon\/lint-plugin-evidence\/packages\/evidence/g,
    "github.com/samchon/ttsc/packages/evidence",
  ],
  [/"@samchon",\s*\n(\s*)"lint-plugin-evidence",/g, '"@ttsc",\n$1"evidence",'],
  [
    /"node_modules", "@samchon", "lint-plugin-evidence"/g,
    '"node_modules", "@ttsc", "evidence"',
  ],
  [
    /https:\/\/github\.com\/samchon\/lint-plugin-evidence\/issues/g,
    "https://github.com/samchon/ttsc/issues",
  ],
  [
    /https:\/\/github\.com\/samchon\/lint-plugin-evidence/g,
    "https://github.com/samchon/ttsc",
  ],
  // Upstream issue numbers name unrelated issues here.
  [/\(issue #(\d+)\)/g, "(upstream lint-plugin-evidence#$1)"],
  [
    /\bissue #(\d+) was measured at/g,
    "upstream lint-plugin-evidence#$1 was measured at",
  ],
  [
    /\bthe ones issue #(\d+) measured\b/g,
    "the ones upstream lint-plugin-evidence#$1 measured",
  ],
  // Documents this repository does not have.
  [
    /What this gives up is stated in issue #\d+ and in `\.wiki\/design\/decisions\.md`\n\/\/ beside the decision it reverses: documentation can no longer cite code, and\n\/\/ the inverse obligation is not the same one\./g,
    "What this gives up is the decision it reverses: documentation can no longer\n// cite code, and the inverse obligation is not the same one.",
  ],
  [
    /The\n\/\/ lint-rule-authoring skill forbids/g,
    "The\n// `@ttsc/lint` contributor contract forbids",
  ],
  [
    /lint-rule-authoring skill forbids/g,
    "`@ttsc/lint` contributor contract forbids",
  ],
];
let textChanged = 0;
for (const tree of [...TREES, ...SKILL_TREES, "benchmarks/evidence/README.md"])
  for (const file of fs.statSync(tree).isDirectory() ? walk(tree) : [tree]) {
    if (!TEXT.has(path.extname(file))) continue;
    const before = fs.readFileSync(file, "utf8");
    let after = before;
    for (const [re, to] of RULES) after = after.replace(re, to);
    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      textChanged++;
    }
  }
console.log("1. text rewritten:", textChanged);

// ------------------------------------------------- 1b. the delivered template
// The template is the workspace a measured agent is handed, and the Evidence
// arm's `lint.config.ts` imports the plugin by name. Left at upstream's name it
// asks for `@samchon/lint-plugin-evidence` while `injectEvidence` installs the
// packed `@ttsc/evidence`, so the arm that exists to exercise the plugin cannot
// resolve it.
//
// Only the package identity is rewritten here. The rest of RULES must not run
// over this tree: its path literals describe the workspace the benchmark
// generates rather than this repository, and its prose is a frozen input the
// measured agent reads.
const IDENTITY = [
  [/@samchon\/lint-plugin-evidence/g, "@ttsc/evidence"],
  [/\bIEvidence/g, "ITtscEvidence"],
  [
    /\bEvidenceGraph(Markdown|Prisma|TypeScript)Symbol\b/g,
    "TtscEvidenceGraph$1Symbol",
  ],
];
let templateChanged = 0;
for (const file of walk("benchmarks/evidence/template")) {
  if (!TEXT.has(path.extname(file))) continue;
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [re, to] of IDENTITY) after = after.replace(re, to);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    templateChanged++;
  }
}
console.log("1b. template files re-identified:", templateChanged);

// -------------------------------------------------------------- 2. filenames
const renamed = (base) => {
  if (/^IEvidence/.test(base))
    return base.replace(/^IEvidence/, "ITtscEvidence");
  const m = /^EvidenceGraph(Markdown|Prisma|TypeScript)Symbol(\..+)$/.exec(
    base,
  );
  return m ? `TtscEvidenceGraph${m[1]}Symbol${m[2]}` : null;
};
let moved = 0;
for (const tree of TREES)
  for (const file of walk(tree)) {
    const next = renamed(path.basename(file));
    if (!next) continue;
    fs.renameSync(file, path.join(path.dirname(file), next));
    moved++;
  }
console.log("2. files renamed:", moved);

// ------------------------------------------- 3. the benchmark's two roots
const LAYOUT = `import path from "node:path";

/**
 * Where the benchmark's own files are, separately from the workspace's.
 *
 * Two roots are in play here and they are not the same directory. The
 * repository owns the git history, the pnpm catalog, and \`packages/evidence\`;
 * the templates, requirements, instructions, and run output belong to this
 * package. Upstream the benchmark sat directly at \`<repository>/benchmark\`, so
 * one value answered both questions and every call site spelled the join
 * itself. In this workspace it does not, and a call site that spells the
 * location again is a call site that can drift away from this one.
 */
export namespace EvidenceBenchmarkLayout {
  /** Path of this package relative to the repository that contains it. */
  const PACKAGE_PATH: readonly string[] = ["benchmarks", "evidence"];

  /**
   * Absolute path of the repository this package was loaded from.
   *
   * Anchored on the module rather than on the working directory, so an
   * executable behaves the same however it is launched. Both \`src\` and \`lib\`
   * place this file one directory below the package root.
   */
  export const repositoryRoot: string = path.resolve(
    __dirname,
    "..",
    ...PACKAGE_PATH.map(() => ".."),
  );

  /**
   * Absolute path of the benchmark's asset tree inside \`repository\`.
   *
   * Takes the repository rather than answering from {@link repositoryRoot},
   * because callers hand in the tree they are measuring: the feature suite
   * points every case at the working tree under test, never at a fixture that
   * imitates it.
   */
  export const assetsRoot = (repository: string): string =>
    path.join(repository, ...PACKAGE_PATH);
}
`;
const BENCH = "benchmarks/evidence/src";
fs.writeFileSync(`${BENCH}/EvidenceBenchmarkLayout.ts`, LAYOUT, "utf8");
const joined = /path\.join\(\s*([A-Za-z_$][\w$.]*)\s*,\s*"benchmark"\s*,/g;
const resolved =
  /path\.resolve\(\s*([A-Za-z_$][\w$.]*)\s*,\s*"benchmark\/(template|requirements)"\s*,/g;
const dirnameUp = /path\.resolve\(__dirname,\s*"\.\.\/\.\.\/\.\."\)/g;
let layoutFiles = 0;
for (const f of walk(BENCH)) {
  if (!f.endsWith(".ts") || f.endsWith("EvidenceBenchmarkLayout.ts")) continue;
  const before = fs.readFileSync(f, "utf8");
  let t = before
    .replace(
      joined,
      (_m, r) => `path.join(EvidenceBenchmarkLayout.assetsRoot(${r}),`,
    )
    .replace(
      resolved,
      (_m, r, d) =>
        `path.resolve(EvidenceBenchmarkLayout.assetsRoot(${r}), "${d}",`,
    )
    .replace(dirnameUp, "EvidenceBenchmarkLayout.repositoryRoot");
  if (t === before) continue;
  if (!/import \{ EvidenceBenchmarkLayout \}/.test(t)) {
    let rel = path
      .relative(path.dirname(f), `${BENCH}/EvidenceBenchmarkLayout`)
      .split(path.sep)
      .join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    const line = `import { EvidenceBenchmarkLayout } from "${rel}";`;
    // After the final import STATEMENT, not the final line beginning with
    // `import` — a multi-line `import type { ... }` opens with one.
    const lines = t.split("\n");
    let last = -1;
    let open = false;
    for (let i = 0; i < lines.length; i++) {
      if (open) {
        if (/^\}\s*from\s+["']/.test(lines[i])) {
          open = false;
          last = i;
        }
        continue;
      }
      if (/^import\b/.test(lines[i])) {
        if (/;\s*$/.test(lines[i])) last = i;
        else open = true;
      }
    }
    lines.splice(last + 1, 0, line);
    t = lines.join("\n");
  }
  fs.writeFileSync(f, t, "utf8");
  layoutFiles++;
}
console.log("3. benchmark files re-rooted:", layoutFiles);

// --------------------------------------- 3b. answering {{version:ttsc}} here
// Upstream lists `ttsc` and its plugins in its own pnpm catalog, because they
// are external dependencies there, so a catalog lookup answers every template
// token. In this workspace they ARE the workspace, and a workspace never lists
// itself in a catalog — so the same lookup cannot answer `{{version:ttsc}}` and
// `prepareWorkspace` throws before a cell writes anything. Reading the
// manifests keeps the token answerable without asking this repository to
// duplicate its own version numbers into a catalog that exists for externals.
{
  const f = `${BENCH}/EvidenceBenchmarkWorkspace.ts`;
  let t = fs.readFileSync(f, "utf8");
  if (!t.includes("workspacePackageVersions")) {
    const anchor = `        versions.set(name, version);
      }
    return versions;
  }
`;
    if (!t.includes(anchor))
      throw new Error("workspace catalog anchor not found");
    t = t.replace(
      anchor,
      `        versions.set(name, version);
      }
    for (const [name, version] of workspacePackageVersions(repository))
      if (!versions.has(name)) versions.set(name, \`^\${version}\`);
    return versions;
  }

  /**
   * Every \`name\`/\`version\` pair declared by a package inside \`repository\`.
   *
   * A template asks for a version by package name, and this workspace's own
   * packages answer no catalog lookup, so their manifests answer instead.
   */
  function workspacePackageVersions(repository: string): Map<string, string> {
    const found: Map<string, string> = new Map();
    for (const group of ["packages", "benchmarks"])
      for (const entry of readDirectoryQuietly(path.join(repository, group))) {
        const manifest: string = path.join(
          repository,
          group,
          entry,
          "package.json",
        );
        if (!fs.existsSync(manifest)) continue;
        const parsed: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
        const { name, version } = typia.assert<{
          name?: string;
          version?: string;
        }>(parsed);
        if (name !== undefined && version !== undefined)
          found.set(name, version);
      }
    return found;
  }

  function readDirectoryQuietly(directory: string): string[] {
    try {
      return fs.readdirSync(directory);
    } catch {
      return [];
    }
  }
`,
    );
    fs.writeFileSync(f, t, "utf8");
    console.log("3b. workspace version fallback restored");
  } else console.log("3b. workspace version fallback already present");
}

// ------------------------------------------------- 4. suite-local adaptations
// `marker` is a short string that survives Prettier — comparing the whole
// replacement text is not an idempotency check, because a second run sees a
// reflowed version of what the first run inserted and applies it again.
const edit = (file, pairs, optional = false) => {
  if (!fs.existsSync(file)) {
    if (optional) return;
    throw new Error(`missing ${file}`);
  }
  let t = fs.readFileSync(file, "utf8");
  for (const [from, to, marker] of pairs) {
    // An insertion whose `to` contains its own `from` leaves that anchor in
    // place, so anchor presence proves nothing and a second run duplicates the
    // block. Three edits here had that shape; requiring a marker turns the
    // fourth into an error instead of a duplicate declaration.
    if (marker === undefined && to.includes(from))
      throw new Error(
        `${file}: an insertion that keeps its own anchor needs a marker`,
      );
    if (marker !== undefined && t.includes(marker)) continue;
    if (!t.includes(from)) {
      if (marker === undefined && to !== "" && t.includes(to)) continue;
      throw new Error(`${file}: anchor not found: ${from.slice(0, 60)}`);
    }
    t = t.replace(from, to);
  }
  fs.writeFileSync(file, t, "utf8");
};

// The suites re-base the paths that named upstream's layout.
edit("tests/test-evidence-benchmark/src/internal/suiteRoot.ts", [
  [
    `export const repositoryRoot: string = path.resolve(suiteRoot, "..", "..");`,
    `export const repositoryRoot: string = path.resolve(suiteRoot, "..", "..");

/**
 * Absolute path of the benchmark package inside {@link repositoryRoot}.
 *
 * The repository and the benchmark are two different roots here, and the suite
 * keeps the second in one place for the same reason \`EvidenceBenchmarkLayout\`
 * does on the other side: a case that spells the location itself is a case that
 * can drift away from the runner it drives.
 */
export const benchmarkRoot: string = path.resolve(
  repositoryRoot,
  "benchmarks",
  "evidence",
);`,
    `export const benchmarkRoot`,
  ],
]);
edit(
  "tests/test-evidence-benchmark/src/features/test_benchmark_command_line_runs_from_its_own_entry.ts",
  [
    [`cwd: path.join(repositoryRoot, "benchmark"),`, `cwd: benchmarkRoot,`],
    [
      `import { repositoryRoot } from "../internal/suiteRoot";`,
      `import { benchmarkRoot } from "../internal/suiteRoot";`,
    ],
    [`import path from "node:path";\n\n`, ``, `import type { IRunResult }`],
  ],
);
for (const f of [
  "tests/test-evidence-benchmark/src/features/test_benchmark_evidence_backend_gates_activate_each_claim.ts",
  "tests/test-evidence-benchmark/src/features/test_benchmark_evidence_frontend_gates_activate_each_claim.ts",
])
  edit(f, [[`"benchmark/template/`, `"benchmarks/evidence/template/`]]);
for (const [f, from, to] of [
  [
    "tests/test-evidence-benchmark/src/internal/benchmarkWorkspace.ts",
    "`benchmark/requirements/<subject>/`",
    "`benchmarks/evidence/requirements/<subject>/`",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/benchmarkWorkspace.ts",
    "`benchmark/output/` is where",
    "`benchmarks/evidence/output/` is where",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/requirementDocuments.ts",
    "`benchmark/requirements/<subject>/`",
    "`benchmarks/evidence/requirements/<subject>/`",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/workspaceLayer.ts",
    "`benchmark/template/**`",
    "`benchmarks/evidence/template/**`",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/suiteRoot.ts",
    "`EvidenceBenchmarkWorkspace.prepareWorkspace` resolves `benchmark/template`\n * and `benchmark/requirements` under whatever repository it is handed, so every\n * case hands it this one",
    "`EvidenceBenchmarkWorkspace.prepareWorkspace` resolves the template and the\n * requirements under whatever repository it is handed, so every case hands it\n * this one",
  ],
])
  edit(f, [[from, to]]);

// The fixture builder links every runtime dependency the package declares.
edit("tests/test-evidence/src/internal/createProject.ts", [
  [
    `  const modules: string = path.join(directory, "node_modules");
  fs.mkdirSync(path.join(modules, "@samchon"), { recursive: true });
  fs.mkdirSync(path.join(modules, "@ttsc"), { recursive: true });
  linkEvidencePackage(modules);`,
    `  const modules: string = path.join(directory, "node_modules");
  fs.mkdirSync(path.join(modules, "@ttsc"), { recursive: true });
  linkEvidencePackage(modules);
  linkEvidenceRuntimeDependencies(modules);`,
  ],
  [
    `const linkEvidencePackage = (modules: string): void => {`,
    `/** Absolute path to the workspace's \`packages/evidence\`. */
const evidencePackageRoot = (): string =>
  path.resolve(suiteRoot, "..", "..", "packages", "evidence");

/**
 * Links every runtime dependency \`@ttsc/evidence\` declares into the fixture.
 *
 * The package's \`lib\` is junctioned in, and a fixture cannot rely on Node
 * walking that link back into the workspace to resolve them: the loaders are
 * reached through ttsc's runtime hooks, which serve a module under the path it
 * was requested by rather than its physical one.
 *
 * The list comes from the manifest rather than being written here, so a
 * dependency the package gains upstream arrives with it instead of surfacing
 * later as one more "cannot find module" in a single failing case.
 */
const linkEvidenceRuntimeDependencies = (modules: string): void => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(evidencePackageRoot(), "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const scope: string | undefined = name.startsWith("@")
      ? name.slice(0, name.indexOf("/"))
      : undefined;
    if (scope !== undefined)
      fs.mkdirSync(path.join(modules, scope), { recursive: true });
    linkDirectory(resolveDependency(name), path.join(modules, ...name.split("/")));
  }
};

const linkEvidencePackage = (modules: string): void => {`,
    `const linkEvidenceRuntimeDependencies`,
  ],
  [
    `  const source: string = path.resolve(
    suiteRoot,
    "..",
    "..",
    "packages",
    "evidence",
  );`,
    `  const source: string = evidencePackageRoot();`,
  ],
]);
edit("tests/test-evidence/src/internal/pluginCacheDirectory.ts", [
  [
    ` * The repository's own self-lint step shares this directory for the same
 * reason, which is why the path is derived here rather than written out at each
 * caller — see \`scripts/lint.mjs\`.`,
    ` * Every fixture must agree on that location, which is why the path is derived
 * here rather than written out at each caller.`,
  ],
]);
// The benchmark suite reaches the runner across the workspace, and the runner
// no longer sits at `<repository>/benchmark`.
let rebased = 0;
for (const f of walk("tests/test-evidence-benchmark/src")) {
  if (!/\.tsx?$/.test(f)) continue;
  const before = fs.readFileSync(f, "utf8");
  const after = before.replace(
    /(\.\.\/)+benchmark\/src\//g,
    "../../../../benchmarks/evidence/src/",
  );
  if (after !== before) {
    fs.writeFileSync(f, after, "utf8");
    rebased++;
  }
}
console.log("4. suite adaptations applied | import paths re-based:", rebased);

// ---------------------------------------------------------------- 5. verify
const SUF = ["", ".ts", ".tsx", ".d.ts", ".json", "/index.ts", "/index.tsx"];
let checked = 0;
const missing = [];
for (const tree of TREES)
  for (const file of walk(tree)) {
    if (!/\.tsx?$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(
      /^\s*(?:import|export)[\s\S]{0,400}?from\s+["'](\.[^"']+)["']/gm,
    )) {
      checked++;
      const target = path.resolve(path.dirname(file), m[1]);
      if (!SUF.some((s) => fs.existsSync(target + s)))
        missing.push(`${file} -> ${m[1]}`);
    }
  }
console.log(
  "5. relative specifiers:",
  checked,
  "| unresolved:",
  missing.length,
);
for (const m of missing.slice(0, 12)) console.log("   ", m);

// ------------------------------------------------------------- 6. skill roots
// Upstream's benchmark sits at `<repository>/benchmark`, so one root answered
// both "which repository" and "where are the benchmark's own assets". Here the
// package is `benchmarks/evidence`, and a skill that still says
// `benchmark/requirements/**` sends an operator to a path this repository does
// not have. Anchored edits cannot cover this: upstream restructures these
// documents, and a file that did not exist on the previous copy carries no
// anchor. The rewrite is therefore a sweep, and `audit.cjs` re-measures it.
const SKILL_ASSETS =
  /(?<![\w/-])benchmark\/(aggregate|instructions|output|requirements|src|template)\b/g;
const ROOTED_DOCS = [
  ...SKILL_TREES.flatMap((tree) => walk(tree)),
  "benchmarks/evidence/README.md",
];
let skillPaths = 0;
for (const file of ROOTED_DOCS) {
  if (path.extname(file) !== ".md") continue;
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(SKILL_ASSETS, "benchmarks/evidence/$1");
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    skillPaths++;
  }
}

// Two skills named `evidence` would collide, and the benchmark skill's upstream
// name is the host skill's name here. Both take their path from
// `.agents/skills/` instead.
const FRONTMATTER = [
  [
    ".agents/skills/benchmark/evidence/SKILL.md",
    "name: benchmark\n",
    "name: benchmark/evidence\n",
  ],
  [
    ".agents/skills/project/evidence/SKILL.md",
    "name: evidence-graph\n",
    "name: project/evidence\n",
  ],
  // The Go rule API is owned here by the `@ttsc/lint` contributor contract;
  // upstream's `lint-rule-authoring` skill is not vendored.
  [
    ".agents/skills/project/evidence/SKILL.md",
    "which the lint-rule-authoring skill owns",
    "which the `@ttsc/lint` contributor contract in packages/lint/README.md owns",
  ],
  // Upstream keeps its prior-art notes and its decision record in a `.wiki`
  // this repository does not have. A pointer at a document nobody can open is
  // worse than none: it reads as a citation and answers nothing.
  [
    ".agents/skills/project/evidence/SKILL.md",
    "Read `.wiki/references/autobe-mcp.md` before generalizing behavior from that prior art, and `.wiki/design/decisions.md` for settled repository decisions and their costs.\n",
    "",
  ],
  [
    ".agents/skills/project/evidence/SKILL.md",
    " — `.wiki/design/decisions.md` records the reversal and its cost.",
    ", and the reversal was deliberate.",
  ],
];
for (const [file, from, to] of FRONTMATTER) {
  const text = fs.readFileSync(file, "utf8");
  // A deletion has an empty replacement, and every string contains the empty
  // string, so the already-applied test has to be the absence of the anchor.
  if (to === "" ? !text.includes(from) : text.includes(to)) continue;
  if (!text.includes(from))
    throw new Error(`${file}: anchor not found: ${from}`);
  fs.writeFileSync(file, text.replace(from, to), "utf8");
}
console.log("6. skill files re-rooted:", skillPaths, "| frontmatter re-named");
