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

const INDEX_TOOLS = [
  { key: "ttsc-graph", label: "@ttsc/graph", color: "#22d3ee" },
  { key: "codegraph", label: "codegraph", color: "#f59e0b" },
  { key: "codebase-memory", label: "codebase-memory", color: "#4ade80" },
  { key: "serena", label: "serena", color: "#e879f9" },
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
  "gpt-5.6-terra": "GPT-5.6 terra",
  "gpt-5.6-sol": "GPT-5.6 sol",
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
// The index axis: what readiness costs before a tool can answer anything. It
// is not a token chart, so it renders on its own scale (wall clock).
if (report.index && (report.index.cells ?? []).length > 0) {
  writeSvg("graph-index-build-time.svg", renderIndex(report.index));
  writeSvg("graph-time-to-answer.svg", renderTime(report.index, allCells));
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

// Cold index build time, one bar per tool, repositories ordered by the size of
// the program each index was built from — forty seconds on VS Code and one
// second on a small backend are the same tool, not two. `serena` has no bar
// because it has no build step: it starts a language server and resolves on
// demand, and pays at query time instead.

function renderIndex(index) {
  const rows = [...new Set(index.cells.map((cell) => cell.project))]
    .map((project) => ({
      project,
      label: REPO_LABELS[project] ?? project,
      scale: index.scale?.[project] ?? { files: 0, lines: 0 },
      values: INDEX_TOOLS.map((tool) => {
        const cell = index.cells.find(
          (item) => item.project === project && item.tool === tool.key,
        );
        return { ...tool, ms: cell?.buildMs ?? 0 };
      }),
    }))
    .sort((a, b) => a.scale.lines - b.scale.lines);

  const width = 1040;
  const height = 760;
  const chart = { left: 160, right: 990, top: 120, bottom: 690 };
  const plotWidth = chart.right - chart.left;
  const plotHeight = chart.bottom - chart.top;
  const max = niceMax(
    Math.max(1, ...rows.flatMap((row) => row.values.map((value) => value.ms))),
  );
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];
  const rowHeight = plotHeight / rows.length;
  const barHeight = 11;
  const barStep = 15;
  const title = "Cold index build time (lower is better)";
  const host = index.host
    ? `${index.host.cpu}, ${index.host.cores} cores, ${index.host.ramGB} GB — ${index.host.os}`
    : "";

  const grid = ticks
    .map((tick) => {
      const x = chart.left + (tick / max) * plotWidth;
      return [
        `  <line x1="${x.toFixed(1)}" y1="${chart.top}" x2="${x.toFixed(1)}" y2="${chart.bottom}" stroke="#1f2937" stroke-width="1"/>`,
        `  <text x="${x.toFixed(1)}" y="${chart.bottom + 22}" fill="#94a3b8" font-size="12" text-anchor="middle">${escapeXml(fmtBuildMs(tick))}</text>`,
      ].join("\n");
    })
    .join("\n");

  const bars = rows
    .map((row, rowIndex) => {
      const center = chart.top + rowIndex * rowHeight + rowHeight / 2;
      const groupTop = center - (INDEX_TOOLS.length * barStep) / 2;
      const lines = [
        `  <text x="${chart.left - 12}" y="${(center - 4).toFixed(1)}" fill="#e2e8f0" font-size="13" text-anchor="end">${escapeXml(row.label)}</text>`,
        `  <text x="${chart.left - 12}" y="${(center + 12).toFixed(1)}" fill="#64748b" font-size="10" text-anchor="end">${row.scale.lines.toLocaleString()} lines</text>`,
      ];
      row.values.forEach((value, i) => {
        const y = groupTop + i * barStep;
        const barWidth = value.ms > 0 ? (value.ms / max) * plotWidth : 0;
        lines.push(
          `  <rect x="${chart.left}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight}" fill="${value.color}" rx="2"/>`,
        );
        if (value.ms > 0)
          lines.push(
            `  <text x="${(chart.left + barWidth + 8).toFixed(1)}" y="${(y + barHeight - 1).toFixed(1)}" fill="${value.color}" font-size="11">${escapeXml(fmtBuildMs(value.ms))}</text>`,
          );
      });
      return lines.join("\n");
    })
    .join("\n");

  const legend = INDEX_TOOLS.map((tool, i) =>
    [
      `  <rect x="${160 + i * 200}" y="80" width="12" height="12" fill="${tool.color}" rx="2"/>`,
      `  <text x="${178 + i * 200}" y="90" fill="#cbd5f5" font-size="12">${escapeXml(tool.label)}</text>`,
    ].join("\n"),
  ).join("\n");

  return [
    `<?xml version="1.0" encoding="utf-8" standalone="no"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1" role="img" aria-label="${escapeXml(title)}">`,
    ` <rect width="${width}" height="${height}" fill="#0b0f14"/>`,
    ` <text x="40" y="46" fill="#f8fafc" font-size="20" font-weight="bold" font-family="DejaVu Sans, Arial, sans-serif">${escapeXml(title)}</text>`,
    ` <text x="40" y="68" fill="#64748b" font-size="12" font-family="DejaVu Sans, Arial, sans-serif">${escapeXml(host)}</text>`,
    ` <text x="40" y="${height - 22}" fill="#64748b" font-size="11" font-family="DejaVu Sans, Arial, sans-serif">Every tool builds the index its own documentation prescribes; repositories are ordered by the size of the program each was built from.</text>`,
    legend,
    grid,
    bars,
    `</svg>`,
  ].join("\n");
}

// The wall clock a first answer costs from a cold checkout: build the tool's
// index once, then ask. The faded head of each bar is the build; the solid tail
// is the median time the agent spent answering, over every model and both prompt
// families, so each tool faces the same mix.
//
// It is the other half of the trade a context-saving tool is making. A tool that
// cuts an agent's token bill and then spends four minutes indexing and three
// more re-searching what it indexed has moved the cost, not removed it.
function renderTime(index, cells) {
  const rows = [...new Set(index.cells.map((cell) => cell.project))]
    .map((project) => ({
      project,
      label: REPO_LABELS[project] ?? project,
      scale: index.scale?.[project] ?? { files: 0, lines: 0 },
      values: TOOLS.map((tool) => {
        const build = index.cells.find(
          (item) => item.project === project && item.tool === tool.key,
        );
        return {
          ...tool,
          buildMs: build?.buildMs ?? 0,
          answerMs: medianAnswerMs(cells, project, tool.key),
        };
      }).filter((value) => value.answerMs > 0),
    }))
    .filter((row) => row.values.length > 0)
    .sort((a, b) => a.scale.lines - b.scale.lines);

  // A group of five bars is 75px tall and the row it sat in was 76, so the
  // repositories ran together into one wall and the reader had to count bars to
  // find where Vue ended and NestJS began. The plot is taller now: each project
  // gets its own band of whitespace, and the eye lands on a repository before it
  // reads a tool.
  const width = 1040;
  const height = 920;
  const chart = { left: 160, right: 940, top: 130, bottom: 850 };
  const plotWidth = chart.right - chart.left;
  const plotHeight = chart.bottom - chart.top;
  const max = niceMax(
    Math.max(
      1,
      ...rows.flatMap((row) =>
        row.values.map((value) => value.buildMs + value.answerMs),
      ),
    ),
  );
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];
  const rowHeight = plotHeight / rows.length;
  const barHeight = 11;
  const barStep = 15;
  const bandHeight = rowHeight - 14;
  const title = "Cold time to a first answer (lower is better)";
  const host = index.host
    ? `${index.host.cpu}, ${index.host.cores} cores, ${index.host.ramGB} GB — ${index.host.os}`
    : "";

  // One band per repository, under the grid, so a project reads as a block
  // before the eye starts picking tools out of it.
  const bands = rows
    .map((row, rowIndex) => {
      const center = chart.top + rowIndex * rowHeight + rowHeight / 2;
      return `  <rect x="${chart.left}" y="${(center - bandHeight / 2).toFixed(1)}" width="${plotWidth}" height="${bandHeight.toFixed(1)}" fill="#111a24" fill-opacity="${rowIndex % 2 === 0 ? 0.6 : 0.25}" rx="3"/>`;
    })
    .join("\n");

  const grid = ticks
    .map((tick) => {
      const x = chart.left + (tick / max) * plotWidth;
      return [
        `  <line x1="${x.toFixed(1)}" y1="${chart.top}" x2="${x.toFixed(1)}" y2="${chart.bottom}" stroke="#1f2937" stroke-width="1"/>`,
        `  <text x="${x.toFixed(1)}" y="${chart.bottom + 22}" fill="#94a3b8" font-size="12" text-anchor="middle">${escapeXml(fmtSeconds(tick))}</text>`,
      ].join("\n");
    })
    .join("\n");

  const bars = rows
    .map((row, rowIndex) => {
      const center = chart.top + rowIndex * rowHeight + rowHeight / 2;
      const groupTop = center - (row.values.length * barStep) / 2;
      const lines = [
        `  <text x="${chart.left - 12}" y="${(center - 4).toFixed(1)}" fill="#e2e8f0" font-size="13" text-anchor="end">${escapeXml(row.label)}</text>`,
        `  <text x="${chart.left - 12}" y="${(center + 12).toFixed(1)}" fill="#64748b" font-size="10" text-anchor="end">${row.scale.lines.toLocaleString()} lines</text>`,
      ];
      row.values.forEach((value, i) => {
        const y = groupTop + i * barStep;
        const buildWidth = (value.buildMs / max) * plotWidth;
        const answerWidth = (value.answerMs / max) * plotWidth;
        if (value.buildMs > 0)
          lines.push(
            `  <rect x="${chart.left}" y="${y.toFixed(1)}" width="${buildWidth.toFixed(1)}" height="${barHeight}" fill="${value.color}" fill-opacity="0.35" rx="2"/>`,
          );
        lines.push(
          `  <rect x="${(chart.left + buildWidth).toFixed(1)}" y="${y.toFixed(1)}" width="${answerWidth.toFixed(1)}" height="${barHeight}" fill="${value.color}" rx="2"/>`,
        );
        // Both halves of the wait, in the order they are paid: the index build,
        // then the answer. A tool with no index to build says so with a zero,
        // which is the point of putting them side by side.
        lines.push(
          `  <text x="${(chart.left + buildWidth + answerWidth + 8).toFixed(1)}" y="${(y + barHeight - 1).toFixed(1)}" fill="${value.color}" font-size="11">${escapeXml(`${fmtSeconds(value.buildMs)} / ${fmtSeconds(value.answerMs)}`)}</text>`,
        );
      });
      return lines.join("\n");
    })
    .join("\n");

  // Two legends, because the bar carries two facts. The colours say which tool,
  // and the shades say which half of the wait — and the label beside each bar
  // reads in that same order, `index / answer`, so a tool with no index to build
  // shows a zero where the others show a minute.
  const legend = TOOLS.map((tool, i) =>
    [
      `  <rect x="${100 + i * 175}" y="80" width="12" height="12" fill="${tool.color}" rx="2"/>`,
      `  <text x="${118 + i * 175}" y="90" fill="#cbd5f5" font-size="12">${escapeXml(tool.label)}</text>`,
    ].join("\n"),
  ).join("\n");
  const shadeLegend = [
    `  <rect x="100" y="100" width="12" height="12" fill="#94a3b8" fill-opacity="0.35" rx="2"/>`,
    `  <text x="118" y="110" fill="#94a3b8" font-size="11">index build</text>`,
    `  <rect x="215" y="100" width="12" height="12" fill="#94a3b8" rx="2"/>`,
    `  <text x="233" y="110" fill="#94a3b8" font-size="11">answer</text>`,
    `  <text x="300" y="110" fill="#64748b" font-size="11">— each bar is labelled index / answer, in the order you wait for them</text>`,
  ].join("\n");

  return [
    `<?xml version="1.0" encoding="utf-8" standalone="no"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1" role="img" aria-label="${escapeXml(title)}">`,
    ` <rect width="${width}" height="${height}" fill="#0b0f14"/>`,
    ` <text x="40" y="46" fill="#f8fafc" font-size="20" font-weight="bold" font-family="DejaVu Sans, Arial, sans-serif">${escapeXml(title)}</text>`,
    ` <text x="40" y="68" fill="#64748b" font-size="12" font-family="DejaVu Sans, Arial, sans-serif">${escapeXml(host)}</text>`,
    ` <text x="40" y="${height - 22}" fill="#64748b" font-size="11" font-family="DejaVu Sans, Arial, sans-serif">Cold checkout: build the tool's index once, then ask. The answer is the median wall clock over four models and both prompt families; the baseline has no index to build.</text>`,
    legend,
    shadeLegend,
    bands,
    grid,
    bars,
    `</svg>`,
  ].join("\n");
}

function medianAnswerMs(cells, project, tool) {
  const durations = cells
    .filter(
      (cell) => cell.repo === project && (cell.tool ?? "ttsc-graph") === tool,
    )
    .flatMap((cell) => [
      ...(cell.samples?.baseline ?? []),
      ...(cell.samples?.graph ?? []),
    ])
    .filter((sample) => Number(sample.tokens) > 0 && Number(sample.durMs) > 0)
    .map((sample) => Number(sample.durMs))
    .sort((a, b) => a - b);
  if (durations.length === 0) return 0;
  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 === 0
    ? (durations[mid - 1] + durations[mid]) / 2
    : durations[mid];
}

function fmtBuildMs(ms) {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(0)} s`;
  return `${Math.round(ms)} ms`;
}

/**
 * Seconds, always, on a chart whose whole subject is how long a person waits.
 *
 * Minutes read as a different quantity from seconds — a reader comparing "29 s"
 * against "12.2 min" has to do the arithmetic before they can see the shape,
 * and the shape is the finding. One unit, one glance.
 */
function fmtSeconds(ms) {
  const seconds = ms / 1000;
  if (seconds === 0) return "0 s";
  if (seconds >= 100) return `${Math.round(seconds).toLocaleString("en-US")} s`;
  if (seconds >= 10) return `${seconds.toFixed(0)} s`;
  return `${seconds.toFixed(1)} s`;
}
