#!/usr/bin/env node
/**
 * Merge per-(project, branch) partial benchmark reports into
 * `website/public/benchmark.json`.
 *
 * Used by `.github/workflows/benchmark.yml` after the `measure` matrix
 * finishes. Each matrix job uploads its `experimental/benchmark/.work/
 * report.json` as a `bench-<project>-<branch>` artifact; the publish job
 * downloads them all into one directory (each artifact is its own subdir)
 * and invokes this script:
 *
 *   node merge-website.mjs <partials-dir> <website-json>
 *
 * Semantics:
 *
 * - Each partial's measurements are inserted into the matching project of
 *   `website-json` by cell `id`. Existing measurements with the same id are
 *   replaced; ids not present in any partial are kept untouched. This lets a
 *   partial run (e.g. only `vue,rxjs` re-measured) refresh those cells
 *   without nuking history for the others.
 * - Project-level fields (`files`, `typescript`, `kind`, `repo`) are taken
 *   from the partial when present; otherwise the website's existing values
 *   are preserved.
 * - Top-level `date` / `host` / `runs` / `warmup` are taken from the
 *   freshest partial *that actually carries measurements*. Verify-only
 *   partials (no measurements anywhere) cannot rotate the host block and
 *   therefore cannot trigger a noisy "host metadata changed" commit.
 * - Partials missing a `report.json` are skipped with a warning so a single
 *   failed matrix job doesn't break the publish job.
 */

import fs from "node:fs";
import path from "node:path";

const [partialsDir, websiteJsonPath] = process.argv.slice(2);
if (!partialsDir || !websiteJsonPath) {
  console.error(
    "usage: merge-website.mjs <partials-dir> <website-benchmark.json>",
  );
  process.exit(1);
}

const loadJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const website = loadJson(websiteJsonPath) ?? { projects: [] };
if (!Array.isArray(website.projects)) website.projects = [];

const partials = [];
for (const entry of fs.readdirSync(partialsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const reportPath = path.join(partialsDir, entry.name, "report.json");
  if (!fs.existsSync(reportPath)) {
    console.warn(`[merge] ${entry.name}: report.json missing, skipping`);
    continue;
  }
  const data = loadJson(reportPath);
  if (!data || !Array.isArray(data.projects)) {
    console.warn(`[merge] ${entry.name}: not a valid report, skipping`);
    continue;
  }
  partials.push({ name: entry.name, data });
}

const countMeasurements = (report) =>
  report.projects.reduce(
    (sum, project) =>
      sum +
      (Array.isArray(project.measurements) ? project.measurements.length : 0),
    0,
  );

const partialsWithData = partials.filter(
  (partial) => countMeasurements(partial.data) > 0,
);
const freshest = partialsWithData.reduce((best, partial) => {
  if (!best) return partial;
  const a = Date.parse(best.data.date ?? "") || 0;
  const b = Date.parse(partial.data.date ?? "") || 0;
  return b > a ? partial : best;
}, null);
if (freshest) {
  if (freshest.data.date) website.date = freshest.data.date;
  if (freshest.data.host) website.host = freshest.data.host;
  if (freshest.data.runs != null) website.runs = freshest.data.runs;
  if (freshest.data.warmup != null) website.warmup = freshest.data.warmup;
}

for (const { name, data } of partials) {
  for (const project of data.projects) {
    const idx = website.projects.findIndex((p) => p.name === project.name);
    if (idx === -1) {
      website.projects.push(project);
      console.log(
        `[merge] ${name}: appended new project ${project.name} ` +
          `(${project.measurements?.length ?? 0} measurements)`,
      );
      continue;
    }
    const existing = website.projects[idx];
    const freshById = new Map(
      (project.measurements ?? []).map((m) => [m.id, m]),
    );
    const measurements = [];
    for (const old of existing.measurements ?? []) {
      const fresh = freshById.get(old.id);
      if (fresh) {
        measurements.push(fresh);
        freshById.delete(old.id);
      } else {
        measurements.push(old);
      }
    }
    measurements.push(...freshById.values());
    website.projects[idx] = {
      ...existing,
      ...project,
      measurements,
    };
    console.log(
      `[merge] ${name}: ${project.name} ` +
        `(${project.measurements?.length ?? 0} fresh, ` +
        `${measurements.length} total)`,
    );
  }
}

fs.writeFileSync(websiteJsonPath, JSON.stringify(website, null, 2) + "\n");
console.log(
  `[merge] wrote ${websiteJsonPath} (${website.projects.length} projects)`,
);
