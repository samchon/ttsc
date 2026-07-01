const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "public", "benchmark", "graph.json");
const OUTPUT = path.join(
  ROOT,
  "public",
  "benchmark",
  "graph-common-codex-gpt-5.4-mini.svg",
);

const COLORS = {
  background: "#05070b",
  panel: "#0b111a",
  axis: "#64748b",
  grid: "#1f2937",
  label: "#cbd5e1",
  title: "#f8fafc",
  legend: "#111827",
  legendBorder: "#334155",
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

const report = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const cells = (report.agent?.cells ?? []).filter(
  (cell) =>
    cell.harness === "codex" &&
    cell.model === "codex-gpt-mini" &&
    cell.modelVersion === "gpt-5.4-mini" &&
    cell.promptFamily === "common",
);

const rows = buildRows(cells);
if (rows.length === 0) {
  throw new Error("No Codex GPT-5.4 mini common benchmark cells found");
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${render(rows)}\n`);
console.log(`[build:graph-svg] ${path.relative(ROOT, OUTPUT)}`);

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

function render(rows) {
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
  const title = "Common prompt median token use, Codex GPT-5.4 mini";

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
  </g>
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
  return `${formatTick(value.value)} ${saved >= 0 ? "-" : "+"}${Math.abs(saved)}%`;
}

function valueLabelColor(row, value) {
  if (value.key === "baseline" || row.baseline <= 0) return COLORS.label;
  return pctSaved(row.baseline, value.value) >= 0 ? value.color : "#fb7185";
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
