#!/usr/bin/env node
// Tool-usage analyzer for the @ttsc/graph A/B traces.
//
// agent-ab.mjs and agent-ab-codex.mjs write full stream logs for every run.
// This script reads those logs back and reports navigation behavior only:
// tool counts, graph-arm shell/source fallback, repeated queries, and oversized
// tool outputs. It records no answer score.
//
// Usage:
//   node analyze-traces.mjs --trace-dir=<dir> [--out=<analysis.json>]
//   node analyze-traces.mjs --report=<report.json> [--out=<analysis.json>]
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
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
const TS_SOURCE = /\.(ts|tsx|mts|cts)$/i;
const SHELL_SEARCH = /\b(grep|rg|ag|find|sed|awk|Select-String)\b/i;
const SHELL_READ_TS =
  /\b(cat|head|tail|type|Get-Content|gc)\b[^|]*\.[cm]?tsx?\b/i;

function laneOf(name) {
  if (/graph|ttsc/i.test(name)) return "graph";
  if (name === "Read") return "read";
  if (name === "Grep" || name === "Glob") return "search";
  if (name === "Bash" || name === "PowerShell" || name === "Shell")
    return "shell";
  return "other";
}

function parseTrace(text) {
  const calls = [];
  let tokens = 0;
  let cached = 0;
  let reasoning = 0;
  let turns = 0;
  const messages = [];
  const types = {};

  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    types[event.type ?? "?"] = (types[event.type ?? "?"] ?? 0) + 1;

    if (event.type === "turn.completed") {
      const usage = event.usage || {};
      tokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
      cached += usage.cached_input_tokens || 0;
      reasoning += usage.reasoning_output_tokens || 0;
      turns++;
      continue;
    }

    if (event.type === "item.completed") {
      const item = event.item || {};
      const itemType = item.type || "?";
      types[`item:${itemType}`] = (types[`item:${itemType}`] ?? 0) + 1;
      if (itemType === "agent_message") {
        if (typeof item.text === "string" && item.text.trim()) {
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

    if (event.type !== "assistant") continue;
    const usage = event.message?.usage;
    if (usage) {
      tokens +=
        (usage.input_tokens || 0) +
        (usage.output_tokens || 0) +
        (usage.cache_read_input_tokens || 0) +
        (usage.cache_creation_input_tokens || 0);
    }
    const textBlocks = [];
    for (const block of event.message?.content || []) {
      if (block.type === "text" && typeof block.text === "string") {
        textBlocks.push(block.text);
        continue;
      }
      if (block.type !== "tool_use" || block.name === "ToolSearch") continue;
      calls.push({ name: block.name, input: block.input || {}, output: "" });
    }
    if (textBlocks.length) messages.push(textBlocks.join("\n"));
  }

  return { calls, tokens, cached, reasoning, turns, messages, types };
}

function mcpCallName(item) {
  const server = item.server ?? item.server_name ?? "";
  const tool = item.tool_name ?? item.tool ?? item.name ?? "";
  if (server && tool) return `${server}.${tool}`;
  return (
    item.name ??
    item.tool_name ??
    item.toolName ??
    item.tool ??
    item.identifier ??
    "mcp_tool_call"
  );
}

function mcpOutput(item) {
  const value = item.result ?? item.output ?? item.content ?? item.error ?? "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function targetOf(call) {
  const input = call.input;
  if (call.name === "Read") return input.file_path ?? "";
  if (call.name === "Grep" || call.name === "Glob")
    return input.pattern ?? input.query ?? "";
  if (call.name === "Bash" || call.name === "PowerShell" || call.name === "Shell")
    return (input.command ?? "").slice(0, 120);
  if (/lookup|query|index/i.test(call.name)) return input.query ?? input.question ?? "";
  if (/trace/i.test(call.name))
    return `${input.from ?? ""}${input.to ? ` -> ${input.to}` : ""}`;
  if (/details|expand/i.test(call.name))
    return `[${(input.handles ?? []).length} handle(s)]`;
  return "";
}

function outputSize(call) {
  const out = call.output ?? "";
  return typeof out === "string" ? out.length : JSON.stringify(out).length;
}

function misuseOf(calls) {
  const issues = [];
  const fallbacks = [];
  const graphCalls = calls.filter((call) => laneOf(call.name) === "graph");

  for (const call of calls) {
    const lane = laneOf(call.name);
    const command = call.input.command ?? "";
    if (lane === "read") {
      if (TS_SOURCE.test(call.input.file_path ?? ""))
        issues.push({ kind: "read TS source by hand", detail: targetOf(call) });
      else fallbacks.push({ kind: "read non-TS file", detail: targetOf(call) });
    } else if (lane === "search") {
      issues.push({ kind: "searched with Grep/Glob", detail: targetOf(call) });
    } else if (lane === "shell") {
      if (SHELL_SEARCH.test(command) || SHELL_READ_TS.test(command))
        issues.push({
          kind: "read/searched source via shell",
          detail: targetOf(call),
        });
      else fallbacks.push({ kind: "shell", detail: targetOf(call) });
      if (call.exitCode && call.exitCode !== 0)
        issues.push({ kind: "failed shell probe", detail: targetOf(call) });
    }
  }

  const details = graphCalls.filter((call) => /details|expand/i.test(call.name));
  if (details.length > 1)
    issues.push({
      kind: "unbatched graph details",
      detail: `${details.length} calls; batch handles into one`,
    });

  const queries = graphCalls
    .filter((call) => /lookup|query/i.test(call.name))
    .map((call) => (call.input.query ?? call.input.question ?? "").trim().toLowerCase());
  const dupes = queries.filter((query, index) => query && queries.indexOf(query) !== index);
  for (const query of new Set(dupes))
    issues.push({ kind: "repeated graph query", detail: query });

  if (graphCalls.length === 0)
    issues.push({ kind: "answered without the graph", detail: "0 graph calls" });

  return { issues, fallbacks };
}

const files = fs
  .readdirSync(traceDir)
  .filter((file) => file.endsWith(".stream.jsonl"));

const byArm = {};
for (const file of files) {
  const match = /^(.*)-run-(\d+)\.stream\.jsonl$/.exec(file);
  if (!match) continue;
  const [, arm, run] = match;
  const parsed = parseTrace(fs.readFileSync(path.join(traceDir, file), "utf8"));
  const counts = { graph: 0, read: 0, search: 0, shell: 0, other: 0 };
  for (const call of parsed.calls) counts[laneOf(call.name)]++;
  const outputBytes = parsed.calls.reduce((sum, call) => sum + outputSize(call), 0);
  const largestOutputs = parsed.calls
    .map((call, index) => ({
      index: index + 1,
      name: call.name,
      target: targetOf(call),
      bytes: outputSize(call),
      status: call.status,
      exitCode: call.exitCode,
    }))
    .filter((call) => call.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  const { issues, fallbacks } =
    arm === "graph" ? misuseOf(parsed.calls) : { issues: [], fallbacks: [] };
  (byArm[arm] ??= []).push({
    run: Number(run),
    tokens: parsed.tokens,
    cached: parsed.cached,
    reasoning: parsed.reasoning,
    turns: parsed.turns,
    tools: parsed.calls.length,
    counts,
    outputBytes,
    largestOutputs,
    messages: parsed.messages.slice(-6),
    types: parsed.types,
    sequence: parsed.calls.map((call) => `${call.name}(${targetOf(call)})`),
    issues,
    fallbacks,
  });
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

console.log(`Trace analysis: ${traceDir}\n`);
const summary = {};
for (const [arm, runs] of Object.entries(byArm)) {
  const lanes = ["graph", "read", "search", "shell", "other"];
  const medLanes = Object.fromEntries(
    lanes.map((lane) => [lane, median(runs.map((run) => run.counts[lane]))]),
  );
  const issues = runs.flatMap((run) => run.issues);
  const issueTally = {};
  for (const issue of issues) issueTally[issue.kind] = (issueTally[issue.kind] ?? 0) + 1;
  const runsWithMisuse = runs.filter((run) => run.issues.length).length;

  summary[arm] = {
    runs: runs.length,
    medianTokens: median(runs.map((run) => run.tokens)),
    medianTools: median(runs.map((run) => run.tools)),
    medianOutputBytes: median(runs.map((run) => run.outputBytes)),
    medianByLane: medLanes,
    misuseTally: issueTally,
    cleanRuns: runs.length - runsWithMisuse,
  };

  console.log(`[${arm}]  ${runs.length} run(s)`);
  console.log(
    `  median tokens ${summary[arm].medianTokens}   tools ${summary[arm].medianTools}` +
      `   output ${summary[arm].medianOutputBytes} bytes` +
      `   (graph ${medLanes.graph}, read ${medLanes.read}, search ${medLanes.search}, shell ${medLanes.shell})`,
  );

  if (arm === "graph") {
    console.log(
      `  tool discipline: ${runs.length - runsWithMisuse}/${runs.length} runs clean`,
    );
    for (const [kind, count] of Object.entries(issueTally))
      console.log(`    ${count}x ${kind}`);
    for (const run of runs.filter((item) => item.issues.length)) {
      console.log(`    run ${run.run}:`);
      for (const issue of run.issues)
        console.log(`      - ${issue.kind}${issue.detail ? `: ${issue.detail}` : ""}`);
    }
  }
  console.log("");
}

if (reportPath || arg("token-headline")) {
  const baseline = summary.baseline?.medianTokens ?? 0;
  const graph = summary.graph?.medianTokens ?? 0;
  if (baseline && graph)
    console.log(
      `Token reduction (graph vs baseline): ${Math.round((1 - graph / baseline) * 100)}%  (${baseline} -> ${graph})\n`,
    );
}

if (outPath) {
  fs.writeFileSync(
    path.resolve(outPath),
    `${JSON.stringify({ traceDir, arms: summary, runs: byArm }, null, 2)}\n`,
  );
  console.log(`analysis written: ${outPath}`);
}
