const fs = require("fs");
const path = require("path");

const { renderPng } = require("./svg-to-png.cjs");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "public", "benchmark", "graph.json");
const OUT_DIR = path.join(ROOT, "public", "benchmark");
const SVG_DIR = path.join(OUT_DIR, "svg");
const PNG_DIR = path.join(OUT_DIR, "png");

const COLORS = {
  background: "#05070b",
  panel: "#0b111a",
  axis: "#64748b",
  grid: "#1f2937",
  label: "#cbd5e1",
  title: "#f8fafc",
  legend: "#111827",
  legendBorder: "#334155",
  muted: "#94a3b8",
  worse: "#fb7185",
};

const TOOLS = [
  { key: "baseline", sample: "baseline", label: "baseline", color: "#94a3b8" },
  {
    key: "ttsc-graph",
    sample: "graph",
    label: "@ttsc/graph",
    color: "#22d3ee",
  },
  { key: "codegraph", sample: "graph", label: "codegraph", color: "#f59e0b" },
  {
    key: "codebase-memory",
    sample: "graph",
    label: "codebase-memory",
    color: "#a3e635",
  },
  { key: "serena", sample: "graph", label: "serena", color: "#f472b6" },
];

const REPO_LABELS = {
  excalidraw: "excalidraw",
  nestjs: "nestjs",
  rxjs: "rxjs",
  "shopping-backend": "shopping",
  typeorm: "typeorm",
  vscode: "vscode",
  vue: "vue",
  zod: "zod",
};

const HARNESS_LABELS = { codex: "Codex", "claude-code": "Claude Code" };
const MODEL_LABELS = {
  "gpt-5.4-mini": "GPT-5.4 mini",
  "gpt-5.5": "GPT-5.5",
  "claude-opus-4-8": "Opus 4.8",
  "claude-sonnet-4-6": "Sonnet 4.6",
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Every chart is derived from graph.json so it never drifts from the published
// numbers. For each (harness, model, prompt family) present in the data we emit
// one grouped chart across every repo, plus one single-repo chart per repo.
// Each SVG (benchmark/svg/) also gets a 2x PNG sibling (benchmark/png/) for
// embeds that reject SVG (dev.to, most social cards). PNG export runs with
// --png (`pnpm build`); `pnpm prepare` emits SVGs only. File names:
//   grouped: graph-<family>-<harness>-<modelVersion>.<ext>
//   single:  graph-<repo>-<family>-<harness>-<modelVersion>.<ext>
const EXPORT_PNG = process.argv.includes("--png");
const report = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const allCells = report.agent?.cells ?? [];

const combos = new Map();
for (const cell of allCells) {
  const key = `${cell.harness}|${cell.model}|${cell.modelVersion}|${cell.promptFamily}`;
  if (!combos.has(key)) {
    combos.set(key, {
      harness: cell.harness,
      model: cell.model,
      modelVersion: cell.modelVersion,
      promptFamily: cell.promptFamily,
    });
  }
}

fs.mkdirSync(SVG_DIR, { recursive: true });
fs.mkdirSync(PNG_DIR, { recursive: true });
let written = 0;
// --png only re-renders charts whose SVG content changed (or whose PNG is
// missing).
const pngQueue = [];
for (const combo of combos.values()) {
  const cells = allCells.filter(
    (cell) =>
      cell.harness === combo.harness &&
      cell.model === combo.model &&
      cell.modelVersion === combo.modelVersion &&
      cell.promptFamily === combo.promptFamily,
  );
  const rows = buildRows(cells);
  if (rows.length === 0) continue;

  const slug = `${combo.harness}-${combo.modelVersion}`;
  const family = combo.promptFamily;
  const harnessLabel = HARNESS_LABELS[combo.harness] ?? combo.harness;
  const modelLabel = MODEL_LABELS[combo.modelVersion] ?? combo.modelVersion;

  writeSvg(
    `graph-${family}-${slug}.svg`,
    render(
      rows,
      `${cap(family)} prompt median token use, ${harnessLabel} ${modelLabel}`,
    ),
  );

  for (const row of rows) {
    writeSvg(
      `graph-${row.repo}-${family}-${slug}.svg`,
      renderSingle(row, {
        title: `${row.label} — median tokens (${family} prompt)`,
        subtitle: `${harnessLabel} ${modelLabel}. Lower is better; percentage is versus the no-MCP baseline.`,
      }),
    );
  }
}
const pngs = writePngs();
console.log(
  `[build:graph-svg] wrote ${written} chart(s)${EXPORT_PNG ? ` and ${pngs} png(s)` : ""} to ${path.relative(ROOT, OUT_DIR)}`,
);

function writeSvg(name, svg) {
  const file = path.join(SVG_DIR, name);
  const content = `${svg}\n`;
  const changed =
    !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content;
  if (changed) fs.writeFileSync(file, content);
  const pngFile = path.join(PNG_DIR, name.replace(/\.svg$/, ".png"));
  if (changed || !fs.existsSync(pngFile)) pngQueue.push(file);
  written += 1;
}

function writePngs() {
  if (!EXPORT_PNG || pngQueue.length === 0) return 0;
  for (const svgFile of pngQueue) renderPng(svgFile, { outDir: PNG_DIR });
  return pngQueue.length;
}

function buildRows(input) {
  const byRepo = groupBy(input, (cell) => cell.repo);
  return [...byRepo.entries()]
    .map(([repo, repoCells]) => {
      const byTool = new Map(
        repoCells.map((cell) => [cell.tool ?? "ttsc-graph", cell]),
      );
      const values = TOOLS.map((tool) => ({
        ...tool,
        value: medianTokens(byTool.get(tool.key), tool.sample),
      }));
      return {
        repo,
        label: REPO_LABELS[repo] ?? repo,
        baseline: values.find((value) => value.key === "baseline")?.value ?? 0,
        values,
      };
    })
    .filter((row) => row.values.some((value) => value.value > 0))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function render(rows, title) {
  const width = 1040;
  const height = 900;
  const chart = {
    left: 124,
    right: 1016,
    top: 116,
    bottom: 830,
  };
  const plotWidth = chart.right - chart.left;
  const plotHeight = chart.bottom - chart.top;
  const max = niceMax(
    Math.max(
      1,
      ...rows.flatMap((row) => row.values.map((value) => value.value)),
    ),
  );
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];
  const rowHeight = plotHeight / rows.length;
  const barHeight = 9;
  const barStep = 13.5;

  return `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1" role="img" aria-label="${escapeXml(title)}">
 <defs>
  <style type="text/css">
   *{stroke-linejoin:round;stroke-linecap:butt}
   text{font-family:DejaVu Sans, Arial, sans-serif}
  </style>
 </defs>
 <g id="figure_1">
  <g id="patch_1">
   <path d="M 0 ${height} L ${width} ${height} L ${width} 0 L 0 0 z" style="fill:${COLORS.background}"/>
  </g>
  <g id="axes_1">
   <path d="M ${chart.left} ${chart.top} L ${chart.right} ${chart.top} L ${chart.right} ${chart.bottom} L ${chart.left} ${chart.bottom} z" style="fill:${COLORS.panel}"/>
   <path d="M ${chart.left} ${chart.bottom} L ${chart.right} ${chart.bottom}" style="fill:none;stroke:${COLORS.axis};stroke-width:0.8"/>
   <path d="M ${chart.left} ${chart.top} L ${chart.left} ${chart.bottom}" style="fill:none;stroke:${COLORS.axis};stroke-width:0.8"/>
   ${ticks
     .map((tick) => {
       const x = chart.left + (tick / max) * plotWidth;
       return `<g>
    <path d="M ${x.toFixed(3)} ${chart.top} L ${x.toFixed(3)} ${chart.bottom}" style="fill:none;stroke:${COLORS.grid};stroke-width:0.7"/>
    <text x="${x.toFixed(3)}" y="${chart.bottom + 18}" style="fill:${COLORS.label};font-size:11px;text-anchor:middle">${formatTick(tick)}</text>
   </g>`;
     })
     .join("\n   ")}
   ${rows
     .map((row, rowIndex) => {
       const rowTop = chart.top + rowIndex * rowHeight;
       const labelY = rowTop + rowHeight / 2 + 3;
       const barTop = rowTop + (rowHeight - (TOOLS.length - 1) * barStep) / 2;
       return `<g>
    <path d="M 18 ${(rowTop + rowHeight).toFixed(3)} L ${chart.right} ${(rowTop + rowHeight).toFixed(3)}" style="fill:none;stroke:${COLORS.grid};stroke-width:0.6"/>
    <text x="${chart.left - 16}" y="${labelY.toFixed(3)}" style="fill:${COLORS.title};font-size:13px;font-weight:600;text-anchor:end">${escapeXml(row.label)}</text>
    ${row.values
      .map((value, valueIndex) => {
        if (value.value <= 0) return "";
        const barWidth = Math.max(2, (value.value / max) * plotWidth);
        const label = valueLabel(row, value);
        const best = value.value === minTokens(row);
        const labelWidth = estimateTextWidth(label, 11, best ? 700 : 400);
        const textX = Math.min(
          chart.left + barWidth + 5,
          width - labelWidth - 8,
        );
        const y = barTop + valueIndex * barStep;
        return `<rect x="${chart.left}" y="${y.toFixed(3)}" width="${barWidth.toFixed(3)}" height="${barHeight}" style="fill:${value.color}"/>
    <text x="${textX.toFixed(3)}" y="${(y + barHeight - 0.7).toFixed(3)}" style="fill:${valueLabelColor(row, value)};font-size:11px${best ? ";font-weight:700" : ""}">${escapeXml(label)}</text>`;
      })
      .filter(Boolean)
      .join("\n    ")}
   </g>`;
     })
     .join("\n   ")}
   <text x="${(chart.left + plotWidth / 2).toFixed(3)}" y="28" style="fill:${COLORS.title};font-size:20px;font-weight:600;text-anchor:middle">${escapeXml(title)}</text>
   <text x="${(chart.left + plotWidth / 2).toFixed(3)}" y="${chart.bottom + 44}" style="fill:${COLORS.label};font-size:13px;text-anchor:middle">Tokens</text>
   ${renderLegend(chart.left, 58)}
   <text x="${chart.left}" y="80" style="fill:${COLORS.muted};font-size:12px">Lower is better. Percentage is versus the no-MCP baseline.</text>
  </g>
 </g>
</svg>`;
}

// One repo, thick horizontal bars, tool names as row labels, and a dashed
// baseline reference line so bars that cross it (spent more than no MCP at all)
// read at a glance.
function renderSingle(row, cfg) {
  const width = 1040;
  const height = 430;
  const left = 124;
  const right = 1016;
  const top = 72;
  const bottom = 372;
  const plotWidth = right - left;
  const values = row.values.filter((value) => value.value > 0);
  const max = niceMax(Math.max(1, ...values.map((value) => value.value)));
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];
  const rowStep = (bottom - top) / values.length;
  const barHeight = 30;
  const baselineX = left + (row.baseline / max) * plotWidth;

  const bars = values
    .map((value, index) => {
      const rowTop = top + index * rowStep;
      const barY = rowTop + (rowStep - barHeight) / 2;
      const center = barY + barHeight / 2;
      const barWidth = Math.max(2, (value.value / max) * plotWidth);
      const label = valueLabel(row, value);
      const labelWidth = estimateTextWidth(label, 12, 400);
      const textX = Math.min(left + barWidth + 8, width - labelWidth - 8);
      return `<g>
    <text x="${left - 8}" y="${(center + 4).toFixed(3)}" style="fill:${COLORS.title};font-size:13px;font-weight:600;text-anchor:end">${escapeXml(value.label)}</text>
    <rect x="${left}" y="${barY.toFixed(3)}" width="${barWidth.toFixed(3)}" height="${barHeight}" style="fill:${value.color}"/>
    <text x="${textX.toFixed(3)}" y="${(center + 4).toFixed(3)}" style="fill:${valueLabelColor(row, value)};font-size:12px">${escapeXml(label)}</text>
   </g>`;
    })
    .join("\n   ");

  const baselineRef =
    row.baseline > 0
      ? `<line x1="${baselineX.toFixed(3)}" y1="${top}" x2="${baselineX.toFixed(3)}" y2="${bottom}" style="stroke:${COLORS.axis};stroke-width:1;stroke-dasharray:4 4"/>
   <text x="${(baselineX + 4).toFixed(3)}" y="${top + 14}" style="fill:${COLORS.muted};font-size:11px">no-MCP baseline</text>`
      : "";

  return `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1" role="img" aria-label="${escapeXml(`${cfg.title}. ${cfg.subtitle ?? ""}`)}">
 <defs>
  <style type="text/css">
   *{stroke-linejoin:round;stroke-linecap:butt}
   text{font-family:DejaVu Sans, Arial, sans-serif}
  </style>
 </defs>
 <g>
  <path d="M 0 ${height} L ${width} ${height} L ${width} 0 L 0 0 z" style="fill:${COLORS.background}"/>
  <text x="${left}" y="30" style="fill:${COLORS.title};font-size:16px;font-weight:600">${escapeXml(cfg.title)}</text>
  ${cfg.subtitle ? `<text x="${left}" y="52" style="fill:${COLORS.muted};font-size:12px">${escapeXml(cfg.subtitle)}</text>` : ""}
  <path d="M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} z" style="fill:${COLORS.panel}"/>
  ${ticks
    .map((tick) => {
      const x = left + (tick / max) * plotWidth;
      return `<g>
   <path d="M ${x.toFixed(3)} ${top} L ${x.toFixed(3)} ${bottom}" style="fill:none;stroke:${COLORS.grid};stroke-width:0.7"/>
   <text x="${x.toFixed(3)}" y="${bottom + 18}" style="fill:${COLORS.label};font-size:11px;text-anchor:middle">${formatTick(tick)}</text>
  </g>`;
    })
    .join("\n  ")}
  <path d="M ${left} ${bottom} L ${right} ${bottom}" style="fill:none;stroke:${COLORS.axis};stroke-width:0.8"/>
  <path d="M ${left} ${top} L ${left} ${bottom}" style="fill:none;stroke:${COLORS.axis};stroke-width:0.8"/>
  <text x="${(left + plotWidth / 2).toFixed(3)}" y="${bottom + 42}" style="fill:${COLORS.label};font-size:13px;text-anchor:middle">Tokens</text>
  ${baselineRef}
  ${bars}
 </g>
</svg>`;
}

function minTokens(row) {
  return Math.min(
    ...row.values
      .map((value) => value.value)
      .filter((value) => Number.isFinite(value) && value > 0),
  );
}

function renderLegend(x, y) {
  let offset = 0;
  return `<g id="legend_1">
   ${TOOLS.map((tool) => {
     const item = `<g>
    <rect x="${x + offset}" y="${y - 9}" width="14" height="9" style="fill:${tool.color}"/>
    <text x="${x + offset + 20}" y="${y}" style="fill:${COLORS.label};font-size:12px">${escapeXml(tool.label)}</text>
   </g>`;
     offset += estimateTextWidth(tool.label, 12, 400) + 42;
     return item;
   }).join("\n   ")}
  </g>`;
}

function valueLabel(row, value) {
  if (value.key === "baseline" || row.baseline <= 0)
    return formatTick(value.value);
  const saved = pctSaved(row.baseline, value.value);
  return `${formatTick(value.value)} (${saved >= 0 ? "-" : "+"}${Math.abs(saved)}%)`;
}

function valueLabelColor(row, value) {
  if (value.key === "baseline" || row.baseline <= 0) return COLORS.label;
  return pctSaved(row.baseline, value.value) >= 0 ? value.color : COLORS.worse;
}

function pctSaved(baseline, value) {
  return Math.round((1 - value / baseline) * 100);
}

function estimateTextWidth(text, fontSize, weight) {
  const factor = weight >= 700 ? 0.62 : 0.56;
  return text.length * fontSize * factor;
}

function medianTokens(cell, sampleKind) {
  const values = (cell?.samples?.[sampleKind] ?? [])
    .map((sample) => Number(sample.tokens))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function groupBy(items, key) {
  const out = new Map();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function niceMax(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const nice =
    scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 3 ? 3 : scaled <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatTick(value) {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}k`;
  return String(Math.round(value));
}

function trim(value) {
  return value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
