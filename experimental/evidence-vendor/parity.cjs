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
    "benchmarks/evidence/src/EvidenceBenchmarkReport.ts",
    "rendering moved to EvidenceBenchmarkChart, re-rooted through EvidenceBenchmarkLayout, an empty collection is refused rather than published over the tracked aggregate, and ttsc#1108 refuses a publication that would leave a coverage file from another cohort beside it",
  ],
  [
    "benchmarks/evidence/README.md",
    "documents the chart set this repository publishes, `summary.svg` and a per-subject `arms.svg`, plus the `charts` command upstream has no equivalent of; ttsc#1107, ttsc#1108, ttsc#1110, ttsc#1111, and ttsc#1094 add the aggregate origin, the one-cohort-per-directory refusal, the corrected supplementation bound, the subject inventory, and the browser server",
  ],
  [
    ".agents/skills/benchmark/evidence/measurement/aggregate.md",
    "same as the README: four published artifacts rather than upstream's three, and the redraw command beside them; ttsc#1107 and ttsc#1108 add the origin and the one-cohort-per-directory rules, and ttsc#1109 the number cross-check",
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
    "benchmarks/evidence/src/EvidenceBenchmarkWorkspace.ts",
    "re-rooted through EvidenceBenchmarkLayout, and `workspacePackageVersions` is restored because a workspace never lists itself in a catalog",
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
    "re-rooted through EvidenceBenchmarkLayout",
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
    "imports the benchmark source across a package boundary at this workspace's depth",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/IBenchmarkWorkspace.ts",
    "imports the benchmark source across a package boundary at this workspace's depth",
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
    "runs the command line from `benchmarkRoot` rather than the repository root, which are the same directory upstream and not here",
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
    "benchmarks/evidence/template/base/.agents/skills/frontend/verification.md",
    "ttsc#1091, ttsc#1094, ttsc#1105: the simulated and live suites are separated so no assertion has to satisfy both, the interactive review is a named gate with a recorded artifact rather than a section with an escape clause, and the requirement-section count joins the gate list",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/SKILL.md",
    "ttsc#1091, ttsc#1094, ttsc#1105: the frontend gate list carries the live journeys, the interactive review, and the requirement-section count",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/sdk.md",
    "ttsc#1091: simulation is selected by the Vite mode rather than by an env file, and the quoted default matches the code",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/screens.md",
    "ttsc#1105: requirement ownership is countable, with the enumeration command and the rule table the backend already had",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/frontend/architecture.md",
    "ttsc#1094: the wiki layout carries the interactive review record",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/api/SKILL.md",
    "ttsc#1091: the one-suite-in-both-modes rule is replaced by the two-suite split",
  ],
  [
    "benchmarks/evidence/template/base/.agents/skills/project/SKILL.md",
    "ttsc#1091 and ttsc#1105: the layout and command list carry `tests/contract/`, `pnpm test:contract`, and `pnpm plan`",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/package.json",
    "ttsc#1091 and ttsc#1105: `build:contract`, `test:contract`, and `plan`",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/vite.config.ts",
    "ttsc#1091: `--mode contract` sets simulation, so no env file a cell writes can govern the live gate",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/src/lib/config.ts",
    "ttsc#1091: simulation defaults off, so the checked-in state of a workspace contacts the backend",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/.env.example",
    "ttsc#1091: the simulation flag is deliberately absent, because a value here is promoted into the process environment before Vite resolves a mode",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/tests/contract/scaffold.spec.ts",
    "ttsc#1091: local only, the simulated smoke pass the split creates",
  ],
  [
    "benchmarks/evidence/template/base/packages/frontend/scripts/screen-plan.mjs",
    "ttsc#1105: local only, the validator that decides the screen plan against the requirement sections",
  ],
  [
    "benchmarks/evidence/template/base/.github/workflows/ci.yml",
    "ttsc#1091: the workflow provisions the backend environment once, runs the simulated contract lane, and boots the backend for the live lane it previously advertised and could not run",
  ],
  [
    "benchmarks/evidence/template/base/README.md",
    "ttsc#1091 and ttsc#1094: the two frontend lanes, the mode that selects simulation, and the reversed MCP exclusion",
  ],
  [
    "benchmarks/evidence/template/plain/.agents/skills/review/overall.md",
    "ttsc#1091: the frontend boundary gains the falsifiability clause its backend boundary already had",
  ],
  [
    "benchmarks/evidence/template/plain/.agents/skills/review/frontend.md",
    "ttsc#1105: requirement coverage propagates in the shape operation coverage already did",
  ],
  [
    "benchmarks/evidence/instructions/plain/frontend/start.md",
    "ttsc#1094: the interactive review is a checklist item, because a gate no instruction names is a gate a cell can satisfy without running",
  ],
  [
    "benchmarks/evidence/instructions/evidence/frontend/start.md",
    "ttsc#1094: the same checklist item, identically, because a capability change reaches both arms or it confounds the measurement",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkRuntime.ts",
    "ttsc#1094 and ttsc#1111: the pinned browser MCP server both arms receive, and a port bound derived from the populations rather than written down",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkRunner.ts",
    "ttsc#1094 and ttsc#1095: the browser server joins the invocation on the one code path that has no arm branch, and the review boundary is computed for either arm rather than one, with a named refusal for a run that completed a Review before the boundary existed",
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
    ".agents/skills/benchmark/evidence/intervention/SKILL.md",
    "ttsc#1109 and ttsc#1095: the triage table carries the three observations round one misread, and the verdict loop belongs to either arm",
  ],
  [
    ".agents/skills/benchmark/evidence/intervention/recovery.md",
    "ttsc#1109: the failure-notice lag, the snapshot before resume, and the two states that read as a stall",
  ],
  [
    ".agents/skills/benchmark/evidence/measurement/plain-review.md",
    "ttsc#1109 and ttsc#1095: how far a cell has got is read from the verdict rather than from the plan's length, and both arms stop at a review boundary rather than one",
  ],
  [
    ".agents/skills/benchmark/evidence/measurement/running.md",
    "ttsc#1109, ttsc#1111, ttsc#1094, ttsc#1095: the subject inventory, the complete port table, the browser server among the frozen material inputs, and both arms stopping at a review boundary",
  ],
  [
    ".agents/skills/benchmark/evidence/measurement/dashboard.md",
    "ttsc#1110 and ttsc#1095: the dashboard refuses an argument it cannot honor instead of ignoring one, and its status table distinguishes a stopped cell from an inspection running under the same status",
  ],
  [
    ".agents/skills/benchmark/evidence/intervention/boundary.md",
    "ttsc#1094: the browser server is a frozen material input that lives in editable source, so the table names the exception it creates",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkInstruction.ts",
    "ttsc#1095: the supplementation shape belongs to whichever arm is running, so a reminder quotes its Review in either",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkSupervision.ts",
    "ttsc#1095: a verdict inserts the running arm's reminder rather than the Plain one, and the boundary assertions no longer name one arm",
  ],
  [
    "benchmarks/evidence/instructions/evidence/backend/remind.md",
    "ttsc#1095: local only, the Evidence arm had no supplementation instruction because it had no review boundary",
  ],
  [
    "benchmarks/evidence/instructions/evidence/frontend/remind.md",
    "ttsc#1095: local only, as above",
  ],
  [
    "benchmarks/evidence/instructions/evidence/overall/remind.md",
    "ttsc#1095: local only, as above",
  ],
  [
    "benchmarks/evidence/template/evidence/.agents/skills/review/frontend.md",
    "ttsc#1105: the Evidence arm's own Gates section names `pnpm plan`, which proves the direction coverage from the evidence side cannot see",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_template_screen_plan_refuses_a_pasted_enumeration.ts",
    "ttsc#1105: local only, upstream has no screen-plan check to prove",
  ],
  [
    "tests/test-evidence-benchmark/src/features/test_benchmark_runtime_attaches_the_browser_server_to_every_cell.ts",
    "ttsc#1094: local only, upstream attaches no browser server",
  ],
  [
    "benchmarks/evidence/src/EvidenceBenchmarkInspection.ts",
    "ttsc#1095: the inspecting thread receives the arm, because an Evidence review is judged on whether its acknowledgements are true rather than on whether a reading loop ran",
  ],
  [
    ".agents/skills/benchmark/evidence/SKILL.md",
    "ttsc#1095: a verdict belongs to either arm",
  ],
  [
    ".agents/skills/benchmark/evidence/measurement/SKILL.md",
    "ttsc#1095: the review-boundary topic is no longer one arm's",
  ],
  [
    ".agents/skills/benchmark/evidence/intervention/warning.md",
    "ttsc#1095: the verdict channel belongs to either arm",
  ],

  // ttsc#1106 gives an acknowledgement a declarable relation, so a reference
  // can require one. Every file below carries part of that one change.
  [
    "packages/evidence/native/declaration.go",
    "ttsc#1106: a tag may open with `(role)`, the relation this host claims for the target",
  ],
  [
    "packages/evidence/native/model.go",
    "ttsc#1106: the declaration carries its relation and a reference may require one",
  ],
  [
    "packages/evidence/native/config.go",
    "ttsc#1106: `role` decodes on every reference kind",
  ],
  [
    "packages/evidence/native/graph.go",
    "ttsc#1106: a reference requiring a relation is discharged by that relation and by no other, and its uncovered units say which one they wanted",
  ],
  [
    "packages/evidence/native/markdown.go",
    "ttsc#1106: the parsed relation reaches the graph declaration",
  ],
  [
    "packages/evidence/native/prisma.go",
    "ttsc#1106: as above, for both Prisma declaration hosts",
  ],
  ["packages/evidence/native/typescript.go", "ttsc#1106: as above"],
  [
    "packages/evidence/native/graph_requires_the_declared_role_test.go",
    "ttsc#1106: local only, upstream has no relation to prove",
  ],
  [
    "packages/evidence/native/hints_offer_the_declared_role_test.go",
    "ttsc#1106: local only, as above for the completion corpus",
  ],
  [
    "packages/evidence/native/hints.go",
    "ttsc#1106: a configured relation earns its own completion trigger, because `@evidence ` cannot match the one tag the reference accepts",
  ],
  [
    "packages/evidence/native/hints_project_the_configured_population_test.go",
    "ttsc#1106: the trigger-separation case reads the relation trigger too",
  ],
  [
    "packages/evidence/native/configuration_validates_reference_policy_test.go",
    "ttsc#1106: `role` joins the shared policy cases and brings the negative table its value type needs",
  ],
  [
    "packages/evidence/src/structures/ITtscEvidenceGraphReferenceBase.ts",
    "ttsc#1106: `role` joins the published reference contract",
  ],
  [
    ".agents/skills/project/evidence/SKILL.md",
    "ttsc#1106: the rule contract carries the relation grammar, the policy, and its completion trigger",
  ],
  [
    "tests/test-evidence-benchmark/src/internal/stripCitations.ts",
    "ttsc#1106: a citation carrying a relation is still a citation, and a cell must not start with one",
  ],
  [
    "benchmarks/evidence/src/executable/EvidenceBenchmarkSupervision.ts",
    "ttsc#1095: a hand-written verdict names its arm, because both arms now stop for one and the command could only reach a Plain run",
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
