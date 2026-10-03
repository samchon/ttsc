import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Prepare two fresh dependency populations for the existing configured host.
 * The composite dependency's file paths are captured before native emission;
 * its original oracle concerns added paths, not replacement of existing bytes.
 * The alias belongs to this canonical root and is never a compiler answer. A
 * denied or unsupported native link leaves only the physical-root group
 * unavailable; the composite included/excluded requests must still execute.
 *
 * @evidence contracts/common.md#principled-implementation Authored dependency bytes retain three different project configurations; a real directory alias distinguishes lexical and physical source-root publication.
 * @evidence contracts/common.md#clear-and-simple-design Returns the composite path baseline and explicit link capability; the parent retains host execution and source groups own live publication observations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No runtime hook, native emitter or filesystem operation is replaced; only known denied or unsupported link errors mark unavailable transport.
 * @evidence contracts/common.md#meaningful-documentation Identifies original path-only coverage, real alias ownership and the independent composite group when alias support is absent.
 * @evidence contracts/portability.md#os-neutral-implementation Path joins and native realpath preserve filesystem identity; Windows junction and POSIX directory link represent the same authored alias.
 * @evidence contracts/performance.md#efficient-algorithms The walk processes E entries and B total retained path characters; sorting takes O(E log E) comparisons of at most L characters each, for O(E + B + E log E * L) work. Constant-count native link operations prepare physical roots; file contents are not read by the path walk.
 * @evidence contracts/performance.md#reuse-equivalent-work The configured canonical host borrows these immutable inputs once; distinct dependency configurations and excluded root retain their actual preparations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous reads retain no handles; the tracked parent root owns the created alias and all dependency lifetimes until its children close and root cleanup runs.
 * @evidence contracts/testing.md#behavioral-verification Native lstat and realpath establish the alias before the actual host; the composite path population is captured independently before runtime side effects.
 * @evidence contracts/testing.md#independent-expectations Fresh alias absence and source-target physical equality come from authored paths; the baseline is solely the original preservation oracle and does not predict compiler output.
 * @evidence contracts/testing.md#distinguishing-cases Composite declaration/build-info output and two physical-root forms remain separate native compiler projects; unavailable alias does not skip composite assertions.
 * @evidence contracts/testing.md#execution-ownership The canonical discoverable parent calls setup before its real configured host, passes capability to the source group, and calls the path observer after host closure.
 * @evidence contracts/e2e.md#necessary-boundary Native alias identity must precede dependency compilation and live publication inspection; record-only root calculations do not prove transport.
 * @evidence contracts/e2e.md#shared-execution Three dependency projects share one existing consumer root and launcher; their native project preparations are retained rather than called equivalent work.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh package identities have not previously published generations. The parent joins all descendants before changing this authored graph or comparing output paths.
 * @evidence contracts/e2e.md#preserved-coverage Composite inside/extra values and path population, two physical roots and dependency values remain with the host and live source group; absent alias carries no physical-root coverage.
 */
export function prepareNativeDependencyPublicationCorpus(root: string): {
  declaredOutputPaths: string[];
  physicalRootsAvailable: boolean;
} {
  const declaredOutputPaths = listDeclaredDependencyPaths(root);
  const dependency = path.join(root, "node_modules", "physical-root-dep");
  const alias = path.join(dependency, "src");
  const target = path.join(dependency, "sources");
  assert.equal(
    fs.existsSync(alias),
    false,
    "fresh dependency alias must precede admission",
  );
  let physicalRootsAvailable = true;
  try {
    fs.symlinkSync(
      target,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (
      !["EACCES", "EPERM", "ENOTSUP", "ENOSYS"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
    physicalRootsAvailable = false;
  }
  if (physicalRootsAvailable) {
    assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
    assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(target));
  }
  return { declaredOutputPaths, physicalRootsAvailable };
}

/**
 * Compare the original declared dependency file population after actual host
 * closure. This observes path preservation only; it does not claim native
 * success or byte identity. The canonical parent owns status and user output.
 *
 * @evidence contracts/common.md#principled-implementation Freshly enumerated paths detect declaration and build-info publication into the source dependency instead of its private runtime generation.
 * @evidence contracts/common.md#clear-and-simple-design One exact sorted-path comparison owns the original output-isolation observation after the parent's native host closes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The observer never removes unexpected outputs or replaces native emit to manufacture preservation.
 * @evidence contracts/common.md#meaningful-documentation Separates original path-only preservation from byte identity and actual host success.
 * @evidence contracts/portability.md#os-neutral-implementation Native directory enumeration and normalized relative separators preserve case and filesystem entries across hosts.
 * @evidence contracts/performance.md#efficient-algorithms Fresh enumeration processes E entries and B total retained path characters; O(E log E) string comparisons cost at most L characters each, for O(E + B + E log E * L) work plus linear path-array comparison. The observer reads no file contents; it retains O(E + B) result storage and O(D) recursion depth.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The after-host population must be freshly read; setup or another host cannot certify this native side effect.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous reads close immediately and the observer allocates no resources requiring a new lifecycle; the parent owns directories and processes.
 * @evidence contracts/testing.md#behavioral-verification The actual dependency subtree is enumerated after the configured parent host and all descendants close; equality detects added declaration, build-info or other output paths.
 * @evidence contracts/testing.md#independent-expectations The caller supplies the actual before-host authored path population, not a compiler-reported output list; the original oracle intentionally does not compare existing file bytes.
 * @evidence contracts/testing.md#distinguishing-cases One completed host requests both the project's included source and its excluded root; their native publications must preserve the same declared dependency subtree.
 * @evidence contracts/testing.md#execution-ownership The discoverable canonical parent calls this observer after checking its actual host status and literal source values; this helper creates no test host or runtime process.
 * @evidence contracts/e2e.md#necessary-boundary The parent connects actual native dependency emission to a fresh filesystem side-effect observation; path selection or output-option predictions alone cannot establish preservation.
 * @evidence contracts/e2e.md#shared-execution The existing configured host and dependency graph supply the native effects; enumeration adds no consumer project, launcher or compiler preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Immutable authored sources and joined native readers bracket before and after observations in the same tracked canonical root; no concurrent publication is permitted during comparison.
 * @evidence contracts/e2e.md#preserved-coverage Original recursive sorted path equality remains exact after actual included and excluded requests; native success and inside/extra literal assertions remain with the parent, and byte identity is not claimed.
 */
export function verifyNativeDependencyDeclaredOutputs(
  root: string,
  before: string[],
): void {
  assert.deepEqual(listDeclaredDependencyPaths(root), before);
}

/**
 * Sorted original path-only oracle for the composite dependency subtree.
 *
 * Native entry types drive the scoped traversal; only relative separators are
 * normalized. No case folding, file-content reads, filesystem mutation or
 * compiler-output prediction occurs. Before and after observations each read
 * the actual population. The exported preparation and observer own its
 * preservation contract, path-character costs and resource lifetime.
 */
function listDeclaredDependencyPaths(root: string): string[] {
  const directory = path.join(root, "dep-publication");
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const location = path.join(current, entry.name);
      if (entry.isDirectory()) walk(location);
      else
        files.push(
          path.relative(directory, location).split(path.sep).join("/"),
        );
    }
  };
  walk(directory);
  return files.sort();
}
