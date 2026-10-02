/**
 * Compare two project-walk snapshots.
 *
 * `keys` narrows the comparison to the generation's declared inputs. The walk
 * hashes every file under the project root, but only a file the compile
 * actually consumed can change an output, and a project root is a working
 * directory: a framework's generated types, a log, a coverage report, or a test
 * artifact appears and changes there while a compile runs. Comparing those
 * would declare the generation incoherent and cost a whole-project recompile
 * for every remaining module (samchon/ttsc#1246). Files entering or leaving the
 * project remain covered by the directory-membership snapshot, which is the one
 * thing a content comparison cannot see. An envelope that declares no input set
 * (a graph-free legacy host) passes `undefined` and keeps the whole-walk
 * comparison.
 *
 * @evidence contracts/common.md#principled-implementation Declared keys select relevant recorded content; legacy absence of that population requires exact key count and value equality for the full snapshot.
 * @evidence contracts/common.md#clear-and-simple-design One comparison exposes narrowed and legacy-wide semantics without owning project enumeration or membership discovery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Irrelevant build artifacts cannot taint a declared generation, and narrowing never substitutes for the separate membership proof.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain declared-input scope, unrelated artifacts and the separate membership obligation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares recorded and current hash maps by key; it reads no filesystem and parses no path.
 */
export function sameHashes(
  left: Record<string, string>,
  right: Record<string, string>,
  keys?: ReadonlySet<string>,
): boolean {
  if (keys !== undefined) {
    for (const key of keys) {
      if (left[key] !== right[key]) return false;
    }
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => right[key] === left[key]);
}
