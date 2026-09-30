const fs = require("node:fs");
const path = require("node:path");

const { walkForGoFiles } = require("./go-test-overlay.cjs");

/**
 * Select physical utility test layers into their original external Go package.
 *
 * Shared helpers join the selected cases without copying product sources or
 * compiling each case as a separate package. The caller owns the temporary
 * overlay file; original files remain the compiler's backing inputs.
 *
 * @evidence contracts/common.md#principled-implementation Go's overlay maps each selected backing file to the original module test directory, preserving the external test package and private-driver bindings while selecting cases by their reviewed physical layer.
 * @evidence contracts/common.md#clear-and-simple-design One selection operation serves the validation and coverage runners; both layers share helper declarations, while an omitted layer is absent from compilation rather than filtered by a test-name heuristic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The overlay supplies unchanged authored test and helper files to the real Go compiler, rejects collisions and unclassified root files, and does not replace product operations or test expectations.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains virtual-package identity, backing inputs and the caller's temporary-file ownership without claiming direct subdirectory go test support.
 * @evidence contracts/performance.md#efficient-algorithms Each selected file is visited once and each basename is checked with a Set; temporary space grows with selected files and no product tree or test body is copied.
 * @evidence contracts/performance.md#reuse-equivalent-work Both callers use the same physical layer selection and original module identity; the overlay is regenerated for each invocation so source edits and added files are actual Go compiler inputs.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned overlay lives in the caller-owned invocation directory and is released by that runner's finally path; the helper owns no process or persistent cache.
 * @evidence contracts/portability.md#os-neutral-implementation path.join retains native filesystem paths for both sides of Go's overlay mapping; duplicate native target paths are rejected without guessing filesystem case capability.
 */
function createUtilityTestOverlay(packageDir, workdir, layer) {
  if (layer && layer !== "unit" && layer !== "e2e")
    throw new Error(`unknown utility test layer: ${layer}`);
  const testDir = path.join(packageDir, "test");
  const rootFiles = fs
    .readdirSync(testDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".go"));
  if (rootFiles.length)
    throw new Error(`unclassified utility Go files: ${rootFiles.map((x) => x.name).join(", ")}`);
  const layers = layer ? ["shared", layer] : ["shared", "unit", "e2e"];
  const replace = {};
  const basenames = new Set();
  for (const selected of layers)
    for (const file of walkForGoFiles(path.join(testDir, selected))) {
      const basename = path.basename(file);
      if (basenames.has(basename))
        throw new Error(`utility Go overlay collision: ${basename}`);
      basenames.add(basename);
      replace[path.join(testDir, basename)] = file;
    }
  const overlay = path.join(workdir, "utility-test-overlay.json");
  fs.writeFileSync(overlay, JSON.stringify({ Replace: replace }));
  return overlay;
}

module.exports = { createUtilityTestOverlay };
