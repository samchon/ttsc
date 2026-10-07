import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Publish one generated fixture under an immutable content-addressed path.
 *
 * parent must be absolute and label must contain lowercase letters, digits or
 * hyphens. The synchronous writer owns a private staging tree of regular files
 * and directories. Keep the returned tree immutable: the publisher compares a
 * competing destination during publication but does not monitor later edits.
 * Completed digest directories persist until their external cache owner removes
 * them; staging is removed on failure, and removal errors propagate.
 *
 * @evidence contracts/common.md#principled-implementation A framed SHA-256 digest covers sorted relative entry kinds, names and regular-file bytes; a complete private tree is renamed before its path is returned.
 * @evidence contracts/common.md#clear-and-simple-design One publisher owns staging, hashing, collision comparison and cleanup; the writer remains an explicit authored-source boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An existing digest destination is accepted only after rehashing its actual tree; unsupported links and other entry kinds fail instead of disappearing from the digest.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies immutable publication; the API requires an absolute parent, a safe label and a synchronous writer of stable regular files and directories.
 * @evidence contracts/portability.md#os-neutral-implementation Native joins and rename handle filesystem paths while POSIX relative names define digest spelling; atomic directory rename is the publication boundary on supported local filesystems.
 * @evidence contracts/performance.md#efficient-algorithms Sorting costs sum over directory entry populations; hashing reads total file bytes. A contended destination needs one additional full digest to prove equivalence.
 * @evidence contracts/performance.md#reuse-equivalent-work Same label, parent and framed bytes identify a shared destination; different bytes select a distinct digest. Callers must keep returned trees immutable because later consumers do not revalidate them here.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each call owns one private staging tree and removes it on failure or losing contention; completed digest trees persist without automatic eviction. A cleanup error can supersede the original publication error.
 */
export function materializeSharedSource(
  parent: string,
  label: string,
  write: (directory: string) => void,
): string {
  if (!path.isAbsolute(parent)) {
    throw new Error(`Shared fixture parent must be absolute: ${parent}`);
  }
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error(`Invalid shared fixture label: ${label}`);
  }
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, `.${label}-`));
  try {
    write(staging);
    const digest = directoryDigest(staging);
    const destination = path.join(parent, `${label}-${digest}`);
    try {
      fs.renameSync(staging, destination);
    } catch (error) {
      if (
        !fs.existsSync(destination) ||
        directoryDigest(destination) !== digest
      ) {
        throw error;
      }
      fs.rmSync(staging, { force: true, recursive: true });
    }
    return destination;
  } catch (error) {
    fs.rmSync(staging, { force: true, recursive: true });
    throw error;
  }
}

function directoryDigest(directory: string): string {
  const hash = crypto.createHash("sha256");
  const frame = (kind: string, value: string | Buffer): void => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    hash.update(kind);
    hash.update("\0");
    hash.update(String(bytes.byteLength));
    hash.update("\0");
    hash.update(bytes);
  };
  const visit = (current: string, relative: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      )) {
      const childRelative = path.posix.join(relative, entry.name);
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        frame("directory", childRelative);
        visit(child, childRelative);
      } else if (entry.isFile()) {
        frame("file", childRelative);
        frame("content", fs.readFileSync(child));
      } else {
        throw new Error(`Unsupported shared fixture entry: ${child}`);
      }
    }
  };
  visit(directory, "");
  return hash.digest("hex");
}
