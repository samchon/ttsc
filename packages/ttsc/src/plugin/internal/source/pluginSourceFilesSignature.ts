import crypto from "node:crypto";
import path from "node:path";

import type { IPluginSourceListing } from "./IPluginSourceListing";
import { collectPluginSourceFiles } from "./collectPluginSourceFiles";

/**
 * The metadata signature of exactly the files a plugin source directory's
 * digest reads (`collectPluginSourceFiles`), each by its path relative to the
 * directory, and whether every stamp in it is separable, or `undefined` when a
 * listed file cannot be stated.
 *
 * A host that proves a plugin source often may keep the digest it read while
 * this signature holds still, as git keeps an index entry, and hand it to
 * `pluginSourceStateHolds` instead of reading every file again: a file added,
 * removed or renamed changes the selected population, while content-write
 * detection relies on the owner's reported metadata and separability premises.
 * The signature itself does not read content or certify arbitrary metadata
 * restoration. What metadata/separability proves is the host's to answer, since
 * only the host owns a clock reference on the filesystem it observes
 * (`evidence`). The file list is ttsc's, so every host signs exactly what the
 * build keys on: `@ttsc/unplugin` keeps a digest per delivery this way, and the
 * capability-resolution cache across processes.
 *
 * A host that can also state a directory's stamps (`listing.directory`) gets
 * the population back as a listing (`IPluginSourceListing`) and may hand it to
 * a later call as `listing.known`. While every directory it records still has
 * its stamps, the population is the recorded one, and the signature is taken
 * from the recorded files' metadata without enumerating any directory, as git's
 * untracked cache skips unchanged directories. A directory whose stamps moved,
 * or that the host cannot state, sends the call back to the full walk.
 *
 * @param directory The plugin source directory, absolute.
 * @param evidence One file's metadata signature and separability, or
 *   `undefined` when it cannot be stated.
 * @param listing A directory's metadata evidence, and an earlier listing to
 *   replay; without it the population is always walked and no listing is
 *   returned.
 * @evidence contracts/common.md#principled-implementation Each selected file's relative path and caller-supplied metadata enter the signature, while all separability flags must hold; absent metadata rejects the proof rather than pretending an unreadable file is unchanged. A replayed listing stands only while every recorded directory's stamps equal the ones taken before its entries were read and the host offers them as separable evidence; a walk records a listing only when the root and every directory were stated that way.
 * @evidence contracts/common.md#clear-and-simple-design The shared file population stays with ttsc while the observing owner supplies filesystem stamps and its clock-based separability judgment; one function walks or replays and both produce the same signature.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function does not infer safe reuse from a quiet watcher or a convenient timestamp; the consumer must establish each stamp's separability, and a moved or unstated directory is walked again rather than assumed unchanged.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains selected population changes and why metadata/separability premises and the evidence callbacks belong to the observing host, without equating this signature to content observation, and states when a listing replaces the walk.
 * @evidence contracts/portability.md#os-neutral-implementation Native relative path spelling identifies files in this process; actual filesystem stamp precision, directory-stamp behavior and case capabilities are supplied by the observing owner.
 * @evidence contracts/performance.md#efficient-algorithms A walk lists D directories, invokes the directory callback D times and the file callback F times, and hashes relative-path/metadata-signature JSON bytes. A replay makes D directory and F file callbacks and lists nothing. Callback cost is the observer's work. This function does not read file content.
 * @evidence contracts/performance.md#reuse-equivalent-work A held listing replaces D native enumerations with D metadata requests; the caller owns where the listing is kept.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned signature, separability and listing survive; the callbacks' external observation resources remain caller-owned.
 */
export function pluginSourceFilesSignature(
  directory: string,
  evidence: (
    file: string,
  ) => { separable: boolean; signature: string } | undefined,
  listing?: {
    /**
     * A directory's metadata signature, or `undefined` when its stamps cannot
     * witness its entries (an unknown device, an unseparable stamp, a
     * failure).
     */
    directory: (directory: string) => string | undefined;

    /** A listing an earlier call returned for this directory. */
    known?: IPluginSourceListing;
  },
):
  | {
      separable: boolean;
      signature: string;
      listing?: IPluginSourceListing;
    }
  | undefined {
  if (listing?.known !== undefined) {
    const replayed = replay(
      directory,
      evidence,
      listing.directory,
      listing.known,
    );
    if (replayed !== null) return replayed;
  }
  const directories: [string, string][] | undefined =
    listing === undefined ? undefined : [];
  let stated = directories !== undefined;
  const files = collectPluginSourceFiles(
    directory,
    directories === undefined
      ? undefined
      : (visited) => {
          const signature = stated ? listing!.directory(visited) : undefined;
          if (signature === undefined) stated = false;
          else directories.push([path.relative(directory, visited), signature]);
        },
  );
  const signed = sign(directory, files, evidence);
  if (signed === undefined) return undefined;
  return stated && directories!.length !== 0 && directories![0]![0] === ""
    ? {
        ...signed,
        listing: {
          directories: directories!,
          files: files.map((file) => path.relative(directory, file)),
        },
      }
    : signed;
}

/**
 * The signature of a recorded listing while every recorded directory still has
 * its stamps, or `null` when a directory moved or a recorded file cannot be
 * stated, so the population must be walked.
 */
function replay(
  directory: string,
  evidence: (
    file: string,
  ) => { separable: boolean; signature: string } | undefined,
  stamps: (directory: string) => string | undefined,
  known: IPluginSourceListing,
): {
  separable: boolean;
  signature: string;
  listing: IPluginSourceListing;
} | null {
  if (known.directories.length === 0 || known.directories[0]![0] !== "")
    return null;
  for (const [relative, signature] of known.directories)
    if (stamps(path.join(directory, relative)) !== signature) return null;
  const signed = sign(
    directory,
    known.files.map((file) => path.join(directory, file)),
    evidence,
  );
  return signed === undefined ? null : { ...signed, listing: known };
}

/** Sign `files`, already in selection order, by relative path and metadata. */
function sign(
  directory: string,
  files: readonly string[],
  evidence: (
    file: string,
  ) => { separable: boolean; signature: string } | undefined,
): { separable: boolean; signature: string } | undefined {
  const hash = crypto.createHash("sha256");
  let separable = true;
  for (const file of files) {
    const observed = evidence(file);
    if (observed === undefined) return undefined;
    hash.update(
      JSON.stringify([path.relative(directory, file), observed.signature]),
    );
    separable &&= observed.separable;
  }
  return { separable, signature: hash.digest("hex") };
}
