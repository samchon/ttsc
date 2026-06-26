#!/usr/bin/env node
// Tool-usage analyzer for the @ttsc/graph A/B traces.
//
// agent-ab.mjs already writes the full action log of every run to
// <arm>-run-<n>.stream.jsonl — every assistant turn and every tool_use with its
// input. This reads those logs back and judges *how* the graph arm navigated:
// every fall back to Read/Grep/Glob/Bash-search (where a graph tool should have
// answered), every unbatched graph_expand, every repeated query, and runs that
// produced an answer without touching the graph at all. Those are the cases the
// benchmark exists to drive to zero, so the report lists them per run and in
// aggregate, with the offending file or query named.
//
// It is pure log analysis: no model, no tokens, deterministic. Point it at a
// trace dir (or a report.json, whose `traceDir` it follows) and it prints a
// per-arm breakdown and writes <out> for the PR comment to quote.
//
// Usage:
//   node analyze-traces.mjs --trace-dir=<dir> [--out=<analysis.json>]
//   node analyze-traces.mjs --report=<report.json> [--out=<analysis.json>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gradeAnswer } from "./grade.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

/**
 * Load a manifest prompt's gold by id, so the analyzer can grade each run's
 * answer straight from the trace — recovering quality even when the harness
 * crashed before writing its report.
 */
function loadGoldById(promptId, manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entry = (manifest.prompts ?? []).find((p) => p.id === promptId);
  if (!entry) throw new Error(`unknown --prompt-id ${promptId}`);
  return JSON.parse(
    fs.readFileSync(path.resolve(here, "questions", entry.gold), "utf8"),
  );
}

const reportPath = arg("report");
let traceDir = arg("trace-dir");
if (!traceDir && reportPath) {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  traceDir = report.traceDir;
}
if (!traceDir) {
  console.error(
    "analyze-traces.mjs: --trace-dir=<dir> or --report=<path> required",
  );
  process.exit(2);
}
if (!fs.existsSync(traceDir)) {
  console.error(`analyze-traces.mjs: trace dir not found: ${traceDir}`);
  process.exit(1);
}

const outPath = arg("out");

// A TS source file is exactly what the graph indexes, so reading or searching
// one by hand is a real miss. A non-TS file (package.json, README, a .d.ts of a
// dependency) is outside the graph, so reading it is a legitimate fallback the
// instructions allow, not misuse — the analysis keeps the two apart so the
// misuse count stays actionable.
const TS_SOURCE = /\.(ts|tsx|mts|cts)$/i;
const isTsSource = (p) => TS_SOURCE.test(p ?? "");

// A shell command that reads or searches source the graph already holds: a
// grep/find/sed over the tree, or a cat/head/tail of a TS file. A bare `ls` is
// orientation, not a text search, so it is not counted as misuse.
const SHELL_SEARCH = /\b(grep|rg|ag|find|sed|awk|Select-String)\b/i;
const SHELL_READ_TS =
  /\b(cat|head|tail|type|Get-Content|gc)\b[^|]*\.[cm]?tsx?\b/i;

/** Classify a tool_use into the lane the analysis groups by. */
function laneOf(name) {
  if (/graph|ttsc/i.test(name)) return "graph";
  if (name === "Read") return "read";
  if (name === "Grep" || name === "Glob") return "search";
  if (name === "Bash" || name === "PowerShell" || name === "Shell")
    return "shell";
  return "other";
}

/**
 * Pull the ordered tool calls, token total, and final answer out of one
 * stream-json log. The answer is the `result` event's text on success, else the
 * last assistant prose — the same rule the harness uses — so the analyzer can
 * grade straight from the trace.
 */
function parseTrace(text) {
  const calls = [];
  let tokens = 0;
  let cached = 0;
  let turns = 0;
  let lastAssistantText = "";
  let result = null;
  const messages = [];
  const types = {};
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    types[e.type ?? "?"] = (types[e.type ?? "?"] ?? 0) + 1;
    if (e.type === "turn.completed") {
      const u = e.usage || {};
      tokens += (u.input_tokens || 0) + (u.output_tokens || 0);
      cached += u.cached_input_tokens || 0;
      turns++;
      continue;
    }
    if (e.type === "item.completed") {
      const item = e.item || {};
      const itemType = item.type || "?";
      types[`item:${itemType}`] = (types[`item:${itemType}`] ?? 0) + 1;
      if (itemType === "agent_message") {
        if (typeof item.text === "string" && item.text.trim()) {
          lastAssistantText = item.text;
          messages.push(item.text);
        }
        continue;
      }
      if (itemType === "command_execution") {
        calls.push({
          name: "Shell",
          input: { command: item.command ?? "" },
          output: item.aggregated_output ?? "",
          exitCode: item.exit_code,
          status: item.status,
        });
        continue;
      }
      if (itemType === "mcp_tool_call") {
        calls.push({
          name: mcpCallName(item),
          input: item.arguments ?? item.input ?? {},
          output: mcpOutput(item),
          status: item.status,
        });
        continue;
      }
    }
    if (e.type === "result") {
      result = e;
      continue;
    }
    if (e.type !== "assistant") continue;
    const u = e.message?.usage;
    if (u)
      tokens +=
        (u.input_tokens || 0) +
        (u.output_tokens || 0) +
        (u.cache_read_input_tokens || 0) +
        (u.cache_creation_input_tokens || 0);
    const textBlocks = [];
    for (const b of e.message?.content || []) {
      if (b.type === "text" && typeof b.text === "string") {
        textBlocks.push(b.text);
        continue;
      }
      if (b.type !== "tool_use" || b.name === "ToolSearch") continue;
      calls.push({ name: b.name, input: b.input || {}, output: "" });
    }
    if (textBlocks.length) {
      lastAssistantText = textBlocks.join("\n");
      messages.push(lastAssistantText);
    }
  }
  const answer =
    typeof result?.result === "string" && result.result.trim()
      ? result.result
      : lastAssistantText;
  return { calls, tokens, cached, turns, answer, messages, types };
}

function mcpCallName(item) {
  const raw =
    item.name ??
    item.tool_name ??
    item.toolName ??
    item.tool ??
    item.identifier ??
    "";
  if (raw) return raw;
  const server = item.server ?? item.server_name ?? "";
  const tool = item.tool_name ?? item.tool ?? "";
  return tool ? `${server ? `${server}.` : ""}${tool}` : "mcp_tool_call";
}

function mcpOutput(item) {
  const value = item.result ?? item.output ?? item.content ?? item.error ?? "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** A short, human-legible label for what a tool call targeted. */
function targetOf(call) {
  const i = call.input;
  if (call.name === "Read") return i.file_path ?? "";
  if (call.name === "Grep" || call.name === "Glob")
    return i.pattern ?? i.query ?? "";
  if (
    call.name === "Bash" ||
    call.name === "PowerShell" ||
    call.name === "Shell"
  )
    return (i.command ?? "").slice(0, 120);
  if (/graph_index/i.test(call.name)) return i.query ?? "";
  if (/graph_query/i.test(call.name)) return i.query ?? "";
  if (/graph_trace/i.test(call.name))
    return `${i.from ?? ""}${i.to ? ` -> ${i.to}` : ""}:${i.direction ?? "forward"}`;
  if (/graph_expand/i.test(call.name))
    return `[${(i.handles ?? []).length} handle(s)]`;
  if (/graph_overview/i.test(call.name)) return i.aspect ?? "all";
  return "";
}

function outputSize(call) {
  const out = call.output ?? "";
  return typeof out === "string" ? out.length : JSON.stringify(out).length;
}

/**
 * Judge one graph-arm run. Misuse is anything that means the graph did not
 * carry the navigation it should have: a text search or raw file read, a
 * graph_expand that read one handle at a time, a query asked twice, or — worst
 * — an answer reached without a single graph call.
 */
function misuseOf(calls) {
  const lanes = calls.map((c) => laneOf(c.name));
  const graphCalls = calls.filter((_, k) => lanes[k] === "graph");
  const issues = [];
  const fallbacks = [];

  for (const c of calls) {
    const lane = laneOf(c.name);
    const cmd = c.input.command ?? "";
    if (lane === "read") {
      if (isTsSource(c.input.file_path))
        issues.push({ kind: "read TS source by hand", detail: targetOf(c) });
      else fallbacks.push({ kind: "read non-TS file", detail: targetOf(c) });
    } else if (lane === "search") {
      issues.push({ kind: "searched with Grep/Glob", detail: targetOf(c) });
    } else if (lane === "shell") {
      if (SHELL_SEARCH.test(cmd) || SHELL_READ_TS.test(cmd))
        issues.push({
          kind: "read/searched source via shell",
          detail: targetOf(c),
        });
      else fallbacks.push({ kind: "shell", detail: targetOf(c) });
      if (c.exitCode && c.exitCode !== 0)
        issues.push({ kind: "failed shell probe", detail: targetOf(c) });
    }
  }

  const expands = graphCalls.filter((c) => /graph_expand/i.test(c.name));
  if (expands.length > 1)
    issues.push({
      kind: "unbatched graph_expand",
      detail: `${expands.length} calls; batch handles into one`,
    });

  const queries = graphCalls
    .filter((c) => /graph_query/i.test(c.name))
    .map((c) => (c.input.query ?? "").trim().toLowerCase());
  const dupes = queries.filter((q, k) => q && queries.indexOf(q) !== k);
  for (const q of new Set(dupes))
    issues.push({ kind: "repeated graph_query", detail: q });

  if (graphCalls.length === 0)
    issues.push({
      kind: "answered without the graph",
      detail: "0 graph calls",
    });

  return { issues, fallbacks };
}

// With --prompt-id the analyzer grades each run's captured answer against the
// manifest gold, recovering quality from the traces alone when the harness
// crashed before writing its report.
const promptId = arg("prompt-id");
const manifestPath = path.resolve(
  arg("manifest", path.join(here, "questions", "manifest.json")),
);
const gold = promptId ? loadGoldById(promptId, manifestPath) : null;
const threshold = Number(arg("threshold", "0.8"));

const files = fs
  .readdirSync(traceDir)
  .filter((f) => f.endsWith(".stream.jsonl"));

const byArm = {};
for (const file of files) {
  const m = /^(.*)-run-(\d+)\.stream\.jsonl$/.exec(file);
  if (!m) continue;
  const [, arm, run] = m;
  const { calls, tokens, cached, turns, answer, messages, types } = parseTrace(
    fs.readFileSync(path.join(traceDir, file), "utf8"),
  );
  const counts = { graph: 0, read: 0, search: 0, shell: 0, other: 0 };
  for (const c of calls) counts[laneOf(c.name)]++;
  const outputBytes = calls.reduce((sum, c) => sum + outputSize(c), 0);
  const largestOutputs = calls
    .map((c, index) => ({
      index: index + 1,
      name: c.name,
      target: targetOf(c),
      bytes: outputSize(c),
      status: c.status,
      exitCode: c.exitCode,
    }))
    .filter((c) => c.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  const { issues, fallbacks } =
    arm === "graph" ? misuseOf(calls) : { issues: [], fallbacks: [] };
  (byArm[arm] ??= []).push({
    run: Number(run),
    tokens,
    cached,
    turns,
    tools: calls.length,
    counts,
    outputBytes,
    largestOutputs,
    messages: messages.slice(-6),
    types,
    sequence: calls.map((c) => `${c.name}(${targetOf(c)})`),
    issues,
    fallbacks,
    quality: gold && answer ? gradeAnswer(answer, gold, threshold) : null,
  });
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

console.log(`Trace analysis: ${traceDir}\n`);
const summary = {};
for (const [arm, runs] of Object.entries(byArm)) {
  const medTokens = median(runs.map((r) => r.tokens));
  const medTools = median(runs.map((r) => r.tools));
  const medOutputBytes = median(runs.map((r) => r.outputBytes));
  const lanes = ["graph", "read", "search", "shell", "other"];
  const medLanes = Object.fromEntries(
    lanes.map((l) => [l, median(runs.map((r) => r.counts[l]))]),
  );
  const allIssues = runs.flatMap((r) => r.issues);
  const issueTally = {};
  for (const i of allIssues) issueTally[i.kind] = (issueTally[i.kind] ?? 0) + 1;
  const runsWithMisuse = runs.filter((r) => r.issues.length).length;
  const graded = runs.filter((r) => r.quality);
  const passed = graded.filter((r) => r.quality.pass).length;
  summary[arm] = {
    runs: runs.length,
    medianTokens: medTokens,
    medianTools: medTools,
    medianOutputBytes: medOutputBytes,
    medianByLane: medLanes,
    misuseTally: issueTally,
    cleanRuns: runs.length - runsWithMisuse,
    ...(graded.length ? { quality: { passed, graded: graded.length } } : {}),
  };
  console.log(`[${arm}]  ${runs.length} run(s)`);
  console.log(
    `  median tokens ${medTokens}   tools ${medTools}` +
      `   output ${medOutputBytes} bytes` +
      `   (graph ${medLanes.graph}, read ${medLanes.read}, search ${medLanes.search}, shell ${medLanes.shell})`,
  );
  if (graded.length) {
    console.log(`  quality: ${passed}/${graded.length} pass`);
    for (const r of graded.filter((r) => !r.quality.pass)) {
      const q = r.quality;
      const flags = [
        q.symbolCoverage < threshold ? `sym ${q.symbolCoverage}` : "",
        q.edgeOrder < threshold ? `edges ${q.edgeOrder}` : "",
        q.mentionsMissing.length
          ? `missing[${q.mentionsMissing.join(",")}]`
          : "",
        q.violatedMustNot.length
          ? `VIOLATED[${q.violatedMustNot.join(",")}]`
          : "",
      ]
        .filter(Boolean)
        .join("  ");
      console.log(`    run ${r.run} FAIL: ${flags}`);
    }
  }
  if (arm === "graph") {
    console.log(
      `  tool discipline: ${runs.length - runsWithMisuse}/${runs.length} runs clean (no source touched outside the graph)`,
    );
    if (allIssues.length) {
      console.log("  misuse:");
      for (const [kind, n] of Object.entries(issueTally))
        console.log(`    ${n}x ${kind}`);
    }
    for (const r of runs) {
      if (!r.issues.length) continue;
      console.log(`    run ${r.run}:`);
      for (const i of r.issues)
        console.log(`      - ${i.kind}${i.detail ? `: ${i.detail}` : ""}`);
      if (r.largestOutputs.length) {
        console.log("      largest outputs:");
        for (const o of r.largestOutputs.slice(0, 3)) {
          console.log(
            `        #${o.index} ${o.name} ${o.bytes} bytes ${o.target}`,
          );
        }
      }
    }
  }
  console.log("");
}

if (reportPath || arg("token-headline")) {
  const b = summary.baseline?.medianTokens ?? 0;
  const g = summary.graph?.medianTokens ?? 0;
  if (b && g)
    console.log(
      `Token reduction (graph vs baseline): ${Math.round((1 - g / b) * 100)}%  (${b} -> ${g})\n`,
    );
}

if (outPath) {
  fs.writeFileSync(
    path.resolve(outPath),
    `${JSON.stringify({ traceDir, arms: summary, runs: byArm }, null, 2)}\n`,
  );
  console.log(`analysis written: ${outPath}`);
}
