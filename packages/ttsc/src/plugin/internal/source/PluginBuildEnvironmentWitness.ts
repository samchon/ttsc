import fs from "node:fs";

/**
 * The paths a reading of a plugin build environment depended on that no
 * variable carries, each with its metadata at the moment it was read.
 *
 * The environment digest reads the Go tool, the file `go env -w` writes, the
 * executables the C toolchain commands name, and GOROOT
 * (`hashPluginBuildEnvironment`). Their metadata, taken before their content is
 * read, is what a later observer compares: a process keeping its reading
 * (`processPluginBuildEnvironment`, samchon/ttsc#1516), and a build proving the
 * toolchain it ran is the one its key read (samchon/ttsc#1534). The change time
 * moves with every write and rename, so a tool that changed and changed back
 * still differs, even with its size and modification time restored.
 */
export namespace PluginBuildEnvironmentWitness {
  /** Each witnessed path's metadata when it was first read. */
  export type Record = Map<string, string>;

  /** Record `file`'s metadata now, unless it was recorded already. */
  export function add(witness: Record | undefined, file: string): void {
    if (witness === undefined || witness.has(file)) return;
    witness.set(file, signature(file));
  }

  /**
   * Record `file` as a path whose state could not be witnessed, so the record
   * never holds and nothing kept under it is reused.
   */
  export function refuse(witness: Record | undefined, file: string): void {
    witness?.set(file, UNWITNESSABLE);
  }

  /** Whether every witnessed path still has the metadata it was read with. */
  export function holds(witness: Record): boolean {
    for (const [file, recorded] of witness)
      if (signature(file) !== recorded) return false;
    return true;
  }

  /**
   * The metadata a replacement moves: identity, size, and modification and
   * change times, following links; `missing` for a path that is not there.
   */
  /** A recorded state no signature equals. */
  const UNWITNESSABLE = "unwitnessable";

  function signature(file: string): string {
    try {
      const stat = fs.statSync(file, { bigint: true });
      return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(
        ":",
      );
    } catch {
      return "missing";
    }
  }
}
