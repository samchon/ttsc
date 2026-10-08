import path from "node:path";

/**
 * Plan private copies as translations of each volume's smallest source tree.
 * Removing ancestors shared by every selected root preserves relative paths
 * between external sources without carrying their unrelated absolute ancestry
 * into native compiler working directories. Main-module placement is separate.
 *
 * All roots must be supplied together: adding another root can change the
 * common ancestor. Compact volume ordinals distinguish drives and UNC shares
 * only inside this private attempt; original paths remain source/key identity.
 * Descendant depth and the private base can still exceed a native cwd limit.
 *
 * @evidence contracts/common.md#principled-implementation Each volume's longest common component prefix is removed uniformly, preserving relative component distances and overlapping roots; distinct volume authorities receive disjoint private namespaces.
 * @evidence contracts/common.md#clear-and-simple-design One complete-population planning operation returns the original-to-private mapping before copying starts; it neither acquires a lease nor rewrites source inputs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Component translation applies to every supplied root without consumer or length exceptions; it does not flatten modules, rewrite compiler arguments or read live original bytes in place of a snapshot.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains preserved geometry, complete-population ownership, volume ordinals and the remaining native cwd bound.
 * @evidence contracts/portability.md#os-neutral-implementation The selected native path grammar supplies root parsing and separators; exact component comparison conservatively preserves spelling, including Windows case-sensitive directories and UNC authorities, without realpath or junction substitution.
 * @evidence contracts/performance.md#efficient-algorithms Each source path is resolved and split once; common-prefix comparisons follow its component population, and volume authority names are sorted once to assign deterministic private ordinals. Returned path text contributes output work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A plan belongs to one complete supplied source population; it caches no filesystem or compiler observation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Maps and component arrays are call-local; only the path mapping transfers to the scratch owner, with no acquired handles or independent resource lifetime.
 */
export function createExternalSourceSnapshotLayout(
  privateRoot: string,
  directories: readonly string[],
  paths: typeof path = path,
): Map<string, string> {
  const volumes = new Map<
    string,
    { common: string[]; sources: Map<string, string[]> }
  >();
  for (const directory of directories) {
    const absolute = paths.resolve(directory);
    const root = paths.parse(absolute).root;
    const parts = absolute.slice(root.length).split(paths.sep).filter(Boolean);
    const volume = volumes.get(root);
    if (volume === undefined) {
      volumes.set(root, {
        common: [...parts],
        sources: new Map([[absolute, parts]]),
      });
      continue;
    }
    volume.sources.set(absolute, parts);
    let commonLength = 0;
    while (
      commonLength < volume.common.length &&
      commonLength < parts.length &&
      volume.common[commonLength] === parts[commonLength]
    )
      ++commonLength;
    volume.common.length = commonLength;
  }
  const copies = new Map<string, string>();
  const authorities = [...volumes.keys()].sort();
  for (let ordinal = 0; ordinal < authorities.length; ++ordinal) {
    const volume = volumes.get(authorities[ordinal]!)!;
    const destination = paths.join(privateRoot, ordinal.toString(36));
    for (const [source, parts] of volume.sources)
      copies.set(
        source,
        paths.join(destination, ...parts.slice(volume.common.length)),
      );
  }
  return copies;
}
