// Prove that every difference between the vendored trees and upstream is a
// declared adaptation.
//
// `audit.cjs` sweeps for assumptions the copy carried over. This asks the
// opposite and stricter question: given upstream's bytes plus exactly the
// rewrites `readapt.cjs` declares, is anything left over? A residual is either
// an upstream change the copy missed or a local edit nobody recorded, and both
// are silent until something breaks.
//
// Formatting is not content. Upstream Go is tab-indented and this repository
// pins two spaces; Prettier reflows prose and wraps arguments differently after
// an identifier grows by four characters. Comparing bytes would report hundreds
// of differences that mean nothing. The comparison therefore runs over the
// whitespace-collapsed token stream of each file, which still catches any
// changed word, identifier, number, or punctuation mark.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// This file sits two directories below the repository root, so the root is
// derived rather than spelled. A path written into the source is a path that
// stops being true without anything saying so.
const ROOT = path.resolve(__dirname, "..", "..");
// Where the upstream checkout is, which is a property of the machine rather
// than of the vendoring. The directory does not have to be named after the
// repository, and this one is not: `samchon/lint-plugin-evidence` is cloned as
// `evidence`.
//
// The argument wins over the environment, because it is the more specific
// statement: an exported variable is ambient and easy to forget, and a run that
// names a path on the command line means that path. An empty value is unset
// rather than a location, since `path.resolve("")` is the current directory,
// which would point the whole comparison at this repository.
const supplied = (value) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;
const UP = path.resolve(
  supplied(process.argv[2]) ??
    supplied(process.env.EVIDENCE_UPSTREAM) ??
    "D:/github/samchon/evidence",
);
// Upstream PR #189 carries live logic fixes on top of master, and it is a live
// campaign branch that moves. Resolving the ref each run rather than pinning a
// commit is deliberate: a stale pin compares clean against bytes upstream has
// already replaced, which is the exact failure this script exists to catch.
const BRANCH_REF = "origin/campaign-luna-0.6.0-cont";
const BRANCH = upstreamCommit();
process.chdir(ROOT);

/**
 * Resolve the campaign ref, and say what to do when the checkout is not there.
 *
 * This runs before any comparison, so its failure is the first thing a reader
 * sees. Surfacing git's own message would report a missing ref inside a
 * directory that does not exist, which sends the reader after the wrong thing.
 */
function upstreamCommit() {
  const hint =
    `Pass the checkout as the first argument, or export EVIDENCE_UPSTREAM:\n` +
    `  node ${path.relative(process.cwd(), __filename).replaceAll("\\", "/")} <path-to-lint-plugin-evidence>`;
  if (fs.existsSync(path.join(UP, ".git")) === false)
    throw new Error(
      `No git checkout at ${UP}, which is where samchon/lint-plugin-evidence is expected.\n${hint}`,
    );
  try {
    // git's own stderr is captured rather than inherited. Letting it through
    // printed `fatal: ambiguous argument` above the explanation below it, which
    // is the raw report this wrapper exists to replace.
    return execFileSync("git", ["-C", UP, "rev-parse", BRANCH_REF], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new Error(
      `${UP} has no ${BRANCH_REF}. Fetch it, or point this at the checkout that has it.\n${hint}\n${String(error)}`,
    );
  }
}

// ------------------------------------------------------------------ mappings
const TREES = [
  ["packages/evidence/src", "packages/evidence/src"],
  ["packages/evidence/native", "packages/evidence/native"],
  ["benchmark/src", "benchmarks/evidence/src"],
  ["benchmark/template", "benchmarks/evidence/template"],
  ["benchmark/requirements", "benchmarks/evidence/requirements"],
  ["benchmark/instructions", "benchmarks/evidence/instructions"],
  ["tests/test-evidence/src", "tests/test-evidence/src"],
  ["tests/test-benchmark/src", "tests/test-evidence-benchmark/src"],
  [".agents/skills/benchmark", ".agents/skills/benchmark/evidence"],
];
const FILES = [
  ["benchmark/README.md", "benchmarks/evidence/README.md"],
  [
    ".agents/skills/evidence-graph/SKILL.md",
    ".agents/skills/project/evidence/SKILL.md",
  ],
];

// Upstream basenames that `readapt.cjs` step 2 renames.
const renamed = (base) => {
  if (/^IEvidence/.test(base))
    return base.replace(/^IEvidence/, "ITtscEvidence");
  const m = /^EvidenceGraph(Markdown|Prisma|TypeScript)Symbol(\..+)$/.exec(
    base,
  );
  return m ? `TtscEvidenceGraph${m[1]}Symbol${m[2]}` : base;
};

// ---------------------------------------------------------------- adaptations
// The identifier and URL rewrites of `readapt.cjs` step 1, applied to upstream
// before comparison. Kept as one list so a rule added there and forgotten here
// shows up as a residual rather than passing silently.
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
  [/\(issue #(\d+)\)/g, "(upstream lint-plugin-evidence#$1)"],
  [
    /\bissue #(\d+) was measured at/g,
    "upstream lint-plugin-evidence#$1 was measured at",
  ],
  [
    /\bthe ones issue #(\d+) measured\b/g,
    "the ones upstream lint-plugin-evidence#$1 measured",
  ],
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
  // step 6: the benchmark's asset root
  [
    /(?<![\w/-])benchmark\/(aggregate|instructions|output|requirements|src|template)\b/g,
    "benchmarks/evidence/$1",
  ],
  [/name: benchmark\n/g, "name: benchmark/evidence\n"],
  [/name: evidence-graph\n/g, "name: project/evidence\n"],
  [
    /which the lint-rule-authoring skill owns/g,
    "which the `@ttsc/lint` contributor contract in packages/lint/README.md owns",
  ],
  // upstream keeps its prior art and decision record in a .wiki this
  // repository does not have
  [
    "Read `.wiki/references/autobe-mcp.md` before generalizing behavior from that prior art, and `.wiki/design/decisions.md` for settled repository decisions and their costs.\n",
    "",
  ],
  [
    " — `.wiki/design/decisions.md` records the reversal and its cost.",
    ", and the reversal was deliberate.",
  ],
];

// A file this workspace deliberately does not hold identical to upstream, with
// the reason it differs. Anything not listed here must compare clean.
const EXCEPTIONS = new Map([
  [
    "benchmarks/evidence/src/EvidenceBenchmarkLayout.ts",
    "local only: upstream's benchmark sits at `<repository>/benchmark`, so one root answered both questions and no such module exists there",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkChart.ts",
    "local only: upstream renders inside its report writer, which reaches the charts only through the ignored run tree. Rendering is separated here so the tracked aggregate is a first-class input, and the coverage figures it draws are read from that aggregate rather than from a table hardcoded in the renderer",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkChart.ts",
    "local only: the entry point for redrawing the charts from the tracked aggregate, which upstream has no equivalent of",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_chart_reports_what_it_cannot_draw.ts",
    "local only: covers the chart renderer above, so it exists here for the same reason that module does",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkReport.ts",
    "rendering moved to EvidenceBenchmarkChart, re-rooted through EvidenceBenchmarkLayout, an empty collection is refused rather than published over the tracked aggregate, and ttsc#1108 refuses a publication that would leave a coverage file from another cohort beside it",
  ],
  [
    "benchmarks/evidence/README.md",
    "documents the chart set this repository publishes, `summary.svg` and a per-subject `arms.svg`, plus the `charts` command upstream has no equivalent of; ttsc#1107, ttsc#1108, ttsc#1110, ttsc#1111, and ttsc#1094 add the aggregate origin, the one-cohort-per-directory refusal, the corrected supplementation bound, the subject inventory, and the browser server",
  ],
  [
    ".agents/skills/benchmark/evidence/measurement/aggregate.md",
    "same as the README: four published artifacts rather than upstream's three, and the redraw command beside them; ttsc#1107 and ttsc#1108 add the origin and the one-cohort-per-directory rules, ttsc#1109 the number cross-check, and ttsc#1088 the coverage composition, which upstream applied by hand while writing it up rather than publishing as a command",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_chart_draws_every_published_chart_from_the_tracked_aggregate.ts",
    "local only: upstream has no render path that takes the tracked aggregate, so it has nothing to prove here",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_chart_closes_a_bar_against_the_total_its_row_prints.ts",
    "local only: pins both directions of the stage-to-total mismatch, which upstream's renderer handles in one direction and does not test",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_chart_omits_coverage_it_was_not_given.ts",
    "local only: upstream's coverage figures are a table in its renderer, so there is no data-driven block for it to test",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkCoverage.ts",
    "local only: composes the provenance graph's thirteen measured edges into one coverage figure for issue #1088, whose method upstream applied by hand while writing it up",
  ],
  [
    "benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkCoverage.ts",
    "local only: the coverage composition's measurement input and composed result",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkCoverage.ts",
    "local only: publishes the coverage composition beside the aggregate",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_coverage_composes_over_the_reference_graph.ts",
    "local only: locks the coverage composition's operators, since the arithmetic is the only thing that module contains",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkWorkspace.ts",
    "re-rooted through EvidenceBenchmarkLayout, `workspacePackageVersions` is restored because a workspace never lists itself in a catalog, and the delivered workspace overrides the toolchain to locally packed archives because this repository is ttsc, where upstream's registry resolution would measure a published release",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkToolchain.ts",
    "local only: this repository publishes the compiler a cell runs, so a launch packs `ttsc`, `@ttsc/lint`, `@ttsc/unplugin`, and the platform package, and the feature suite reads the set from here rather than spelling it a second time",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkCheckpoint.ts",
    "re-rooted through EvidenceBenchmarkLayout",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkDashboard.ts",
    "re-rooted through EvidenceBenchmarkLayout, and ttsc#1107 records the repository the collection read from",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkSuspensionAudit.ts",
    "re-rooted through EvidenceBenchmarkLayout",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkCommandLine.ts",
    "re-rooted through EvidenceBenchmarkLayout, and packs the workspace toolchain per cell through EvidenceBenchmarkToolchain because this repository is ttsc, so the benchmark installs `ttsc`, `@ttsc/lint`, `@ttsc/unplugin`, and the platform package from locally packed archives rather than the registry; and it no longer refuses to resume a quality-failed run",
  ],
  [
    "benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkWorkspaceArtifact.ts",
    "no longer Evidence-only: this repository is ttsc, so the same archive shape also carries the workspace toolchain both arms install locally",
  ],
  [
    "benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkWorkspaceRequest.ts",
    "carries the toolchain archives because this repository is ttsc, so the benchmark installs the workspace toolchain from locally packed archives rather than the registry",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkDashboard.ts",
    "re-rooted through EvidenceBenchmarkLayout, and ttsc#1110 refuses an argument this command cannot honor rather than ignoring one",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkReconcile.ts",
    "re-rooted through EvidenceBenchmarkLayout",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkReport.ts",
    "re-rooted through EvidenceBenchmarkLayout",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkSupervision.ts",
    "re-rooted through EvidenceBenchmarkLayout",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkSuspensionAudit.ts",
    "re-rooted through EvidenceBenchmarkLayout",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkWarning.ts",
    "re-rooted through EvidenceBenchmarkLayout",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/suiteRoot.ts",
    "the suite holds the benchmark root for the same reason EvidenceBenchmarkLayout does on the runner side",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/benchmarkWorkspace.ts",
    "imports the benchmark source across a package boundary at this workspace's depth, and packs this repository's toolchain once per process so every prepared arm is the workspace a launch here delivers rather than one resolved from the registry",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/IBenchmarkWorkspace.ts",
    "imports the benchmark source across a package boundary at this workspace's depth, and carries the packed toolchain because a prepared workspace here binds this repository's own compiler",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkRunner.ts",
    "a scope that exhausts its supplementations continues into its Final here, and a run retained as quality-failed resumes into it",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkSupervision.ts",
    "the supplementation bound chooses the continuation rather than ending the run",
  ],
  [
    "benchmarks/evidence/template/base/.gitignore",
    "ignores the packed toolchain this repository delivers; upstream installs ttsc from the registry and has no such directory",
  ],
  [
    "tests/test-evidence/src/internal/createProject.ts",
    "links every dependency the manifest declares rather than a hardcoded list",
  ],
  [
    "tests/test-evidence/src/internal/pluginCacheDirectory.ts",
    "upstream cites `scripts/lint.mjs`, which this repository does not have",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_command_line_runs_from_its_own_entry.ts",
    "runs the command line from `benchmarkRoot` rather than the repository root, which are the same directory upstream and not here, so the `node:path` import upstream needs to compute that root is gone with it",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_workspace_resolves_the_packed_toolchain.ts",
    "local only: upstream consumes `ttsc` from a catalog, so it has no local toolchain binding for a case to prove",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_plain_workspace_builds_without_evidence.ts",
    "`.benchmark-deps/` exists in both arms here, because both install this repository's packed compiler, so Plain is held to carrying the toolchain archives exactly rather than to carrying no archive at all",
  ],

  // ttsc#1096 round-two preparation. Everything below is this repository's own
  // correction to a defect the first cohort exposed, made here rather than
  // upstream because round two runs here. Each entry names the issue that owns
  // it, so a later refresh can decide per file whether upstream has caught up
  // rather than treating the whole set as one unexplained residual.
  [
    "benchmarks/evidence/template/base/config/lint.config.ts",
    "ttsc#1090: the generated SDK's separate type import is accepted in the shared config every package extends, because the api package's own ignore does not travel with files a source-consuming workspace pulls into another Program",
  ],
  [
    "benchmarks/evidence/template/base/packages/backend/lint.config.ts",
    "ttsc#1090: the package-local `no-duplicate-imports` override the shared config makes redundant",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkRuntime.ts",
    "ttsc#1111: a port bound derived from the populations rather than written down, so adding a subject moves the message with it",
  ],
  [
    "benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkReport.ts",
    "ttsc#1107: the aggregate records the repository it was collected from, because a bare revision resolves nowhere",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_report_refuses_coverage_from_another_cohort.ts",
    "ttsc#1108: local only, upstream has no cohort refusal to prove",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_report_records_a_resolvable_origin_or_none.ts",
    "ttsc#1107: local only, upstream records no origin",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkInstruction.ts",
    "ttsc#1095: the Evidence arm has no Overall Review stage, because `evidence/review` proves a citation was reviewed and Frontend Review is the last scope",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkRunner.ts",
    "ttsc#1094: every cell is spawned into a generated Codex home, so the operator's own AGENTS.md, hooks, and MCP table cannot reach a measured thread",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkRuntime.ts",
    "ttsc#1094 and ttsc#1111: the isolated Codex home carrying the pinned browser server, and a port bound derived from the populations rather than written down",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/.env.example",
    "ttsc#1091: simulation is decided by the build mode, so the example no longer carries the flag a cell could edit",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/api/SKILL.md",
    "ttsc#1091: the simulation clause no longer selects for assertions that prove nothing",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/architecture.md",
    "ttsc#1094: the interactive review record joins the wiki listing",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/screens.md",
    "ttsc#1105: a screen needs a requirement, which is the direction coverage from the evidence side cannot see",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/sdk.md",
    "ttsc#1091: the typed-client smoke pass runs against the live backend",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/SKILL.md",
    "ttsc#1105 and ttsc#1091: the requirement enumeration and the contract suite join the gates",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/verification.md",
    "ttsc#1091, ttsc#1094 and ttsc#1105: the live contract pass, the interactive browser review, and the requirement-section count",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/project/SKILL.md",
    "ttsc#1091 and ttsc#1105: the layout and command list carry tests/contract/ and pnpm plan",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/package.json",
    "ttsc#1091 and ttsc#1105: build:contract, test:contract, and plan",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/src/lib/config.ts",
    "ttsc#1091: simulation is read from the build mode rather than from a file a cell may write",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/vite.config.ts",
    "ttsc#1091: the mode decides simulation in both directions",
  ],
  [
    "benchmarks/evidence/template/evidence/.agents/skills/review/frontend.md",
    "ttsc#1095 and ttsc#1105: the cross-layer deferral check the removed Overall scope owned, and the requirement-section count",
  ],
  [
    "benchmarks/evidence/template/evidence/.agents/skills/review/SKILL.md",
    "ttsc#1095: two review scopes and no third",
  ],
  ["benchmarks/evidence/template/evidence/AGENTS.md", "ttsc#1095: as above"],
  [
    "benchmarks/evidence/template/plain/.agents/skills/review/frontend.md",
    "ttsc#1105: requirement coverage propagates in the shape source propagation already did",
  ],
  [
    "benchmarks/evidence/template/plain/.agents/skills/review/overall.md",
    "ttsc#1105: requirement coverage joins the Plain overall scope, mirroring the frontend one",
  ],
  [
    "benchmarks/evidence/instructions/evidence/frontend/review.md",
    "ttsc#1095 and ttsc#1105: the cross-layer deferral check and the requirement count, since Frontend Review is now the last scope",
  ],
  [
    "benchmarks/evidence/instructions/evidence/frontend/start.md",
    "ttsc#1094 and ttsc#1105: the interactive browser record and the requirement enumeration join the gates",
  ],
  [
    "benchmarks/evidence/instructions/evidence/overall/final.md",
    "ttsc#1095: reached straight from Frontend Final, so it names that scope rather than a review stage the arm no longer runs",
  ],
  [
    "benchmarks/evidence/instructions/plain/frontend/start.md",
    "ttsc#1094 and ttsc#1105: as above, held identical across the arms",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/scripts/screen-plan.mjs",
    "ttsc#1105: local only, upstream has no requirement-section count to run",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/tests/contract/scaffold.spec.ts",
    "ttsc#1091: local only, upstream runs no simulated suite separate from the live one",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_template_screen_plan_refuses_a_pasted_enumeration.ts",
    "ttsc#1105: local only, upstream has no requirement-section count to defeat",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_runtime_isolates_the_codex_home.ts",
    "ttsc#1094: local only, upstream's runner does not generate the home a cell reads",
  ],
  [
    "benchmarks/evidence/template/evidence/.agents/skills/evidence/frontend.md",
    "ttsc#1091: the live suite is named by its script, because the build mode decides simulation and no environment variable can disagree",
  ],
  [
    "benchmarks/evidence/instructions/evidence/frontend/final.md",
    "ttsc#1091: as above",
  ],
  [
    "benchmarks/evidence/instructions/plain/frontend/final.md",
    "ttsc#1091: as above, held identical across the arms",
  ],
  [
    "benchmarks/evidence/instructions/plain/overall/final.md",
    "ttsc#1091: as above",
  ],
]);

// ------------------------------------------------------------------ compare
const TEXT = new Set([
  ".ts",
  ".tsx",
  ".go",
  ".js",
  ".cjs",
  ".mjs",
  ".mts",
  ".json",
  ".md",
  ".prisma",
  ".yaml",
  ".yml",
  ".css",
]);
const SKIP_DIR = new Set(["node_modules", ".git", ".next", "dist"]);

const walk = (dir, base = dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      // The template ships frontend sources in `src/lib`; only a build output
      // directory named `lib` is skipped.
      if (e.name === "lib" && !p.includes("template")) continue;
      walk(p, base, out);
    } else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
};

// The delivered template takes only the package identity, never the path or
// prose rules, matching `readapt.cjs` step 1b: its literals describe the
// workspace the benchmark generates rather than this repository, and its bytes
// are a frozen input the measured agent reads.
const IDENTITY = RULES.slice(0, 3);
const adapt = (text, localRel) => {
  let t = text.replace(/\r\n/g, "\n");
  const rules = localRel.startsWith("benchmarks/evidence/template/")
    ? IDENTITY
    : RULES;
  for (const [re, to] of rules) t = t.replace(re, to);
  return t;
};
// Formatting is not content: collapse every whitespace run to one space.
const tokens = (text) => text.replace(/\s+/g, " ").trim();

// Collapsing whitespace is not enough on its own. This repository's Prettier
// sorts imports, hoists a union's leading `|` to the line start, adds a
// trailing comma whenever it breaks an argument list, and rewraps JSDoc prose.
// Every one of those moves a token without changing a word, and comparing the
// raw stream reports each as a difference. So the adapted upstream text is run
// through the same Prettier this repository pins before it is compared: two
// files that Prettier agrees on differ only in content.
const PRETTIER_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".cjs",
  ".mjs",
  ".mts",
  ".json",
  ".md",
  ".css",
  ".yaml",
  ".yml",
]);
// Not under node_modules: Prettier ignores that path unconditionally, and a
// staging tree it silently skips makes every formatting difference look real.
const STAGE = path.join(ROOT, ".work", "evidence-parity");
const staged = [];
const stage = (localRel, text) => {
  const target = path.join(STAGE, localRel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, "utf8");
  staged.push(localRel);
  return target;
};
const normalizeStaged = () => {
  if (staged.length === 0) return;
  // Copied in so its relative patterns resolve against the staging tree, which
  // mirrors the repository layout, rather than against the repository itself.
  fs.copyFileSync(
    path.join(ROOT, ".prettierignore"),
    path.join(STAGE, ".prettierignore"),
  );
  // One Prettier process over the whole staging tree; per-file invocation of a
  // 436-file comparison is minutes of process startup.
  try {
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, "node_modules", "prettier", "bin", "prettier.cjs"),
        "--write",
        "--log-level",
        "error",
        "--config",
        path.join(ROOT, "prettier.config.js"),
        "--ignore-path",
        ".prettierignore",
        ".",
      ],
      { cwd: STAGE, encoding: "utf8", maxBuffer: 1 << 26, stdio: "pipe" },
    );
  } catch (error) {
    // A file Prettier cannot parse is itself worth knowing about, but it must
    // not take the whole comparison down: the rest still compares.
    process.stdout.write(
      "prettier reported errors while normalizing upstream:\n" +
        String(error.stderr ?? error.message)
          .split("\n")
          .slice(0, 6)
          .join("\n") +
        "\n",
    );
  }
};

const upstreamFiles = new Set(
  execFileSync("git", ["-C", UP, "ls-files"], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  })
    .split("\n")
    .filter(Boolean),
);
// Every path the branch touches, not only the ones it adds. Taking a modified
// file from the working tree instead of from the branch is how four frozen
// instruction files and the arm review skill stayed at master while the branch
// had already rewritten them.
const branchChanged = new Set(
  execFileSync("git", ["-C", UP, "diff", "--name-only", "master..." + BRANCH], {
    encoding: "utf8",
    maxBuffer: 1 << 24,
  })
    .split("\n")
    .filter(Boolean),
);
const readUpstream = (rel) =>
  branchChanged.has(rel)
    ? execFileSync("git", ["-C", UP, "show", `${BRANCH}:${rel}`], {
        encoding: "utf8",
        maxBuffer: 1 << 24,
      })
    : fs.readFileSync(path.join(UP, rel), "utf8");

const differing = [];
const missing = [];
const extra = [];
const excused = [];
let compared = 0;
let skippedBinary = 0;

const localTracked = new Set(
  execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 26 })
    .split("\n")
    .filter(Boolean),
);

const pending = [];
const collect = (upRel, localRel) => {
  const localPath = path.join(ROOT, localRel);
  if (!fs.existsSync(localPath)) {
    missing.push(`${localRel}   (upstream ${upRel})`);
    return;
  }
  if (!TEXT.has(path.extname(localRel))) {
    // The byte branch has to answer the same two questions the text branch
    // does, or an extension outside TEXT is an extension no entry can cover.
    // That is not hypothetical: the trees carry `.gitignore`, `.gitattributes`,
    // `.node-version`, five `.gitkeep` files, `index.html`, and
    // `exclude.schema`, all of them text this campaign could have had to
    // declare, and one of them was edited and reverted inside this cycle.
    //
    // It reads through `readUpstream` for the same reason the text branch does:
    // a file the upstream campaign branch adds exists in no working tree, and
    // reading the working-tree path directly would throw and take the whole
    // report with it.
    const a = Buffer.from(readUpstream(upRel), "utf8");
    const b = fs.readFileSync(localPath);
    skippedBinary++;
    // A declared adaptation is declared whatever the extension. `.gitignore`
    // and its siblings carry no extension at all, so they reach this branch
    // rather than the text one, and an exception listed for them must be
    // honoured here too.
    if (a.equals(b)) {
      if (EXCEPTIONS.has(localRel))
        excused.push(`${localRel}: listed as adapted but compares clean`);
      return;
    }
    if (EXCEPTIONS.has(localRel)) return;
    differing.push({ localRel, upRel, note: "binary bytes" });
    return;
  }
  pending.push({ upRel, localRel, text: adapt(readUpstream(upRel), localRel) });
};

const compare = ({ upRel, localRel, text }) => {
  compared++;
  const stagedPath = path.join(STAGE, localRel);
  const want = tokens(
    fs.existsSync(stagedPath) ? fs.readFileSync(stagedPath, "utf8") : text,
  );
  const have = tokens(
    fs.readFileSync(path.join(ROOT, localRel), "utf8").replace(/\r\n/g, "\n"),
  );
  if (want === have) {
    if (EXCEPTIONS.has(localRel))
      excused.push(`${localRel}: listed as adapted but compares clean`);
    return;
  }
  if (EXCEPTIONS.has(localRel)) return;
  // First differing word, for a report that points at something.
  const w = want.split(" ");
  const h = have.split(" ");
  let i = 0;
  while (i < w.length && i < h.length && w[i] === h[i]) i++;
  differing.push({
    localRel,
    upRel,
    note: `word ${i}: upstream "${w.slice(i, i + 8).join(" ")}" | here "${h.slice(i, i + 8).join(" ")}"`,
  });
};

for (const [upTree, localTree] of TREES) {
  // Files upstream PR #189 adds exist only on that branch, so walking the
  // upstream working tree never sees them and every one would be reported as
  // tracked-here-absent-upstream.
  const upAll = [
    ...new Set([
      ...walk(path.join(UP, upTree)),
      ...[...branchChanged]
        .filter((f) => f.startsWith(`${upTree}/`))
        .map((f) => f.slice(upTree.length + 1)),
    ]),
  ];
  const seen = new Set();
  for (const rel of upAll) {
    const upRel = `${upTree}/${rel}`;
    if (!upstreamFiles.has(upRel) && !branchChanged.has(upRel)) continue;
    const localRel = `${localTree}/${rel
      .split("/")
      .map((s, i, a) => (i === a.length - 1 ? renamed(s) : s))
      .join("/")}`;
    seen.add(localRel);
    collect(upRel, localRel);
  }
  for (const rel of walk(path.join(ROOT, localTree))) {
    const localRel = `${localTree}/${rel}`;
    if (seen.has(localRel)) continue;
    if (!localTracked.has(localRel)) continue;
    if (EXCEPTIONS.has(localRel)) continue;
    extra.push(localRel);
  }
}
for (const [upRel, localRel] of FILES) collect(upRel, localRel);

fs.rmSync(STAGE, { recursive: true, force: true });
for (const { localRel, text } of pending)
  if (PRETTIER_EXT.has(path.extname(localRel))) stage(localRel, text);
normalizeStaged();
for (const item of pending) compare(item);

// ------------------------------------------------------------------- report
const section = (title, rows) => {
  if (rows.length === 0) return;
  console.log(`\n=== ${title} (${rows.length}) ===`);
  for (const r of rows.slice(0, 40)) console.log("  " + r);
  if (rows.length > 40) console.log(`  ... ${rows.length - 40} more`);
};

console.log(`upstream master plus ${BRANCH_REF} at ${BRANCH.slice(0, 9)}`);
console.log(
  `compared ${compared} text files and ${skippedBinary} binary files against upstream`,
);
console.log(`declared adaptations: ${EXCEPTIONS.size} files`);
section(
  "DIFFERING — an undeclared difference from upstream",
  differing.map((d) => `${d.localRel}\n      ${d.note}`),
);
section("MISSING — upstream has it, this workspace does not", missing);
section("EXTRA — tracked here, absent upstream", extra);
section("STALE EXCEPTION — declared adapted but identical", excused);

const failed =
  differing.length + missing.length + extra.length + excused.length;
if (failed === 0) console.log("\nparity: clean");
else console.log(`\nparity: ${failed} residual(s)`);
process.exitCode = failed === 0 ? 0 : 1;
