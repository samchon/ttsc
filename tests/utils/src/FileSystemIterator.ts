import fs from "node:fs/promises";
import path from "node:path";

/** Read and materialize UTF-8 file maps for caller-owned fixture directories. */
export namespace FileSystemIterator {
  /**
   * Write relative file names below location, creating missing directories.
   *
   * Existing files are overwritten; unrelated files remain. Absolute names,
   * names resolving outside location and names resolving to location itself are
   * rejected. Use slash-separated keys for portable fixtures. Native path case
   * and existing symlinks are left to the filesystem, so callers must own the
   * destination tree; this is not a symlink containment boundary.
   *
   * Writes are sequential and not transactional. Filesystem errors propagate,
   * and files written before an error remain. Do not mutate the same tree
   * concurrently while materializing it.
   *
   * @evidence contracts/common.md#principled-implementation Resolving each relative key against the destination and checking its relative containment gives the requested file location; recursive mkdir establishes parents before UTF-8 writeFile replaces its contents.
   * @evidence contracts/common.md#clear-and-simple-design One sequential loop owns path validation, parent preparation and writing, without a project, fixture format or process lifecycle abstraction.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Uses Node filesystem APIs on caller-supplied paths and contents, without modifying globals or choosing behavior from consumer identities.
   * @evidence contracts/common.md#meaningful-documentation Native prose states overwrite and preservation behavior, accepted relative names, symlink limitations, nontransactional errors and caller ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Native resolve, relative and isAbsolute preserve Windows and POSIX path rules; slash keys work through these APIs without guessing filesystem case policy. Existing symlinks follow native write semantics.
   * @evidence contracts/performance.md#efficient-algorithms Each input entry is written once; a set avoids repeated mkdir for the same resolved parent. Work includes total path processing, directory creation and encoded content bytes, with filesystem lookup costs determined by the native tree.
   * @evidence contracts/performance.md#reuse-equivalent-work Prepared parent directories are reused only within this call on the caller-owned stable tree; no preparation result is cached across later mutations or calls.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The call awaits one mkdir or write at a time; Node owns closing its filesystem operations. Entry enumeration and the parent set grow with this input and are released after settlement, with no retained cache or background tasks.
   */
  export async function write(
    location: string,
    files: Record<string, string>,
  ): Promise<void> {
    const root = path.resolve(location);
    await fs.mkdir(root, { recursive: true });
    const directories = new Set<string>([root]);
    for (const [name, content] of Object.entries(files)) {
      const file = path.resolve(root, name);
      const relative = path.relative(root, file);
      if (
        path.isAbsolute(name) ||
        relative === "" ||
        relative === ".." ||
        relative.startsWith(".." + path.sep) ||
        path.isAbsolute(relative)
      )
        throw new Error(`Expected a relative file path below ${root}: ${name}`);
      const directory = path.dirname(file);
      if (!directories.has(directory)) {
        await fs.mkdir(directory, { recursive: true });
        directories.add(directory);
      }
      await fs.writeFile(file, content, "utf8");
    }
  }

  /**
   * Read regular files recursively into a UTF-8 map with slash-relative keys.
   *
   * The explicitly supplied root may resolve through a native symlink, but
   * symlinks encountered inside it and nonregular entries are skipped. Empty
   * directories are not represented. Errors propagate without a partial map.
   * The tree must remain stable during traversal; this is not an atomic
   * snapshot. The returned dictionary has no prototype so every file name is an
   * ordinary key, including `__proto__`.
   *
   * @evidence contracts/common.md#principled-implementation Directory entries distinguish regular files from directories and symlinks; recursively enumerating only directories reads each encountered regular file into its root-relative key with UTF-8 decoding.
   * @evidence contracts/common.md#clear-and-simple-design A local traversal carries the native directory and relative key together, and returns one dictionary without exposing traversal state or adding fixture policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Reads the actual caller-owned tree with native APIs; no expected file contents, globals or foreign methods are substituted.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies root and nested symlink behavior, omitted empty directories, failure propagation, tree stability and dictionary ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins locate entries using their actual names; relative key components are joined with slash independently of native separators. No OS-name inference chooses case matching or symlink capabilities.
   * @evidence contracts/performance.md#efficient-algorithms A depth-first traversal enumerates each encountered directory once and reads each regular file once; output storage grows with total relative-name and decoded-content bytes, alongside retained directory entries on the active recursion path.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation coordinates no shared computation between requests; each call reads current filesystem state without a cross-call cache or in-flight sharing policy.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Sequential awaits leave no outstanding task when traversal settles; Node owns filesystem handle closure. The caller receives the content map on success, while temporary traversal state is released on success or failure; input size bounds memory, with no fixed byte limit.
   */
  export async function read(
    location: String,
  ): Promise<Record<string, string>> {
    const files: Record<string, string> = Object.create(null);
    const visit = async (
      directory: string,
      relative: string,
    ): Promise<void> => {
      for (const entry of await fs.readdir(directory, {
        withFileTypes: true,
      })) {
        const file = path.join(directory, entry.name);
        const key = relative === "" ? entry.name : relative + "/" + entry.name;
        if (entry.isDirectory()) await visit(file, key);
        else if (entry.isFile()) files[key] = await fs.readFile(file, "utf8");
      }
    };
    await visit(path.resolve(String(location)), "");
    return files;
  }
}
