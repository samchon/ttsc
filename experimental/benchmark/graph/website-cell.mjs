/**
 * The identity of a published agent cell.
 *
 * `website/public/benchmark/graph.json` accumulates across runs: a run that
 * re-measures a cell must replace it, not append a second one. The key is what
 * decides that, so it must name exactly the axes the website renders — harness,
 * tool, repo, prompt, model, daemon — and nothing else.
 *
 * Metadata that rides along with a measurement (the fixture branch it was
 * cloned from, the reasoning effort the model ran at, the tool's setup time) is
 * not an axis. Keying on it silently turns a re-measurement into a duplicate
 * cell: the grid then shows the same model twice, once per stale label. Two
 * runs of the same cell are the same cell, whatever the runner happened to
 * record about them.
 */
export function websiteCellKey(cell) {
  return JSON.stringify([
    cell.harness,
    cell.tool ?? "ttsc-graph",
    cell.repo,
    cell.promptId ?? "",
    cell.promptFamily ?? "project-specific",
    cell.model,
    cell.daemon === true ? "daemon" : "single",
  ]);
}
