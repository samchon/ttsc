// Publish the evidence benchmark's tracked aggregate to the site's public tree.
//
// The site is a static export, so a component cannot read `benchmarks/` at
// request time; the data has to be a real file under `public/`. Committing a
// second copy there would make two sources for one measurement, and the one the
// page draws would drift from the one the charts are rendered from. This copies
// instead, and the copy is ignored.
//
// The charts come across the same way. `@ttsc/benchmark-evidence` owns the
// renderer and writes them beside the JSON they were drawn from, so this step
// republishes those exact files rather than drawing a second set that could
// disagree with the tracked one.
const fs = require("node:fs");
const path = require("node:path");

const { renderPng } = require("./svg-to-png.cjs");

const ROOT = path.resolve(__dirname, "..");
const AGGREGATE = path.resolve(
  ROOT,
  "..",
  "benchmarks",
  "evidence",
  "aggregate",
);
const OUT_DIR = path.join(ROOT, "public", "benchmark");
const SVG_DIR = path.join(OUT_DIR, "svg");
const PNG_DIR = path.join(OUT_DIR, "png");

/** `summary.json` plus whatever optional artifacts a cohort has published. */
const DATA = [
  { from: "summary.json", to: "evidence.json", required: true },
  { from: "coverage.json", to: "evidence-coverage.json", required: false },
];

function main() {
  const png = process.argv.includes("--png");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const artifact of DATA) publishData(artifact);
  publishCharts(png);
}

function publishData(artifact) {
  const source = path.join(AGGREGATE, artifact.from);
  const target = path.join(OUT_DIR, artifact.to);
  if (fs.existsSync(source) === false) {
    if (artifact.required)
      throw new Error(
        `No evidence benchmark aggregate at ${source}. It is tracked, so a checkout missing it is incomplete rather than unpublished.`,
      );
    // Coverage is counted by hand from a completed workspace, so a cohort can
    // be published before one exists. Remove a stale copy rather than leaving
    // the page drawing a block the aggregate no longer carries.
    fs.rmSync(target, { force: true });
    return;
  }
  // Parsed and re-serialized rather than copied, so a malformed aggregate fails
  // the build here instead of at the fetch in a reader's browser.
  fs.writeFileSync(
    target,
    `${JSON.stringify(JSON.parse(fs.readFileSync(source, "utf8")))}\n`,
  );
  process.stdout.write(
    `[evidence-benchmark] ${artifact.from} -> public/benchmark/${artifact.to}\n`,
  );
}

/**
 * Republish the tracked charts under names that survive one flat directory.
 *
 * Every subject's chart is called `arms.svg` inside its own directory, which
 * collides the moment they share one. The published name carries the subject,
 * matching how the graph track names its own exports.
 */
function publishCharts(png) {
  fs.mkdirSync(SVG_DIR, { recursive: true });
  if (png) fs.mkdirSync(PNG_DIR, { recursive: true });
  // A subject dropped from a cohort leaves its chart behind otherwise, and a
  // stale export is worse than a missing one: it is a measurement the site
  // still serves under a name the aggregate no longer carries.
  for (const [directory, extension] of [
    [SVG_DIR, ".svg"],
    [PNG_DIR, ".png"],
  ])
    if (fs.existsSync(directory))
      for (const name of fs.readdirSync(directory))
        if (name.startsWith("evidence-") && name.endsWith(extension))
          fs.rmSync(path.join(directory, name), { force: true });
  for (const chart of charts()) {
    const target = path.join(SVG_DIR, chart.name);
    fs.copyFileSync(chart.source, target);
    process.stdout.write(
      `[evidence-benchmark] ${path.relative(AGGREGATE, chart.source).replaceAll("\\", "/")} -> public/benchmark/svg/${chart.name}\n`,
    );
    if (png === false) continue;
    const out = renderPng(target, { outDir: PNG_DIR });
    process.stdout.write(
      `[evidence-benchmark] ${chart.name} -> public/benchmark/png/${path.basename(out.file)} (${out.width}x${out.height})\n`,
    );
  }
}

function charts() {
  const found = [];
  const summary = path.join(AGGREGATE, "summary.svg");
  if (fs.existsSync(summary))
    found.push({ source: summary, name: "evidence-summary.svg" });
  const cells = path.join(AGGREGATE, "cells");
  if (fs.existsSync(cells) === false) return found;
  for (const model of directories(cells))
    for (const subject of directories(path.join(cells, model))) {
      const source = path.join(cells, model, subject, "arms.svg");
      if (fs.existsSync(source))
        found.push({
          source,
          name: `evidence-${slug(model)}-${slug(subject)}.svg`,
        });
    }
  if (found.length === 0)
    throw new Error(
      `No charts under ${AGGREGATE}. They are tracked; redraw them with \`pnpm --filter @ttsc/benchmark-evidence charts\`.`,
    );
  return found;
}

/** Only directories, so a stray file under `cells/` is skipped, not opened. */
function directories(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** A directory name from the aggregate is percent-encoded and may carry dots. */
function slug(value) {
  return decodeURIComponent(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

main();
