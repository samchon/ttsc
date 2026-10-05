import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";

/**
 * Attempt POSIX Go toolchain permission repair before metadata reads.
 *
 * Package managers can drop the execute bit of the bundled Go SDK. For the
 * bundled toolchain (`normalizeBundledPermissions`) the `go` and `gofmt`
 * regular binaries and observed regular files under ordinary `pkg/tool`
 * directories are normalized to `0755`; for a toolchain the user selected, the
 * owner-execute bit is added only when no execute bit is present, preserving
 * other permission bits. Windows requires no POSIX permission repair. A
 * nonregular main candidate stops repair, and nonregular secondary entries are
 * skipped. Traversal/repair failures are tolerated; a later Go invocation may
 * report a relevant native error but is not guaranteed to expose every skipped
 * repair failure.
 *
 * @evidence contracts/common.md#principled-implementation Regular-file admission precedes chmod and a nonregular main candidate stops SDK repair. The caller's bundled-layout flag selects full normalization; selected files otherwise gain owner execution only when no execute bit exists. This is a path-based attempt, not an immutable ownership or race-free handle certificate.
 * @evidence contracts/common.md#clear-and-simple-design Platform exit, SDK recognition and recursive tool discovery remain explicit; one private file operation owns the permission policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission repair serves packaged SDK installation behavior rather than an injected fixture bypass; native errors are tolerated and ordinary Go execution retains its own failure outcome instead of this helper fabricating success.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish owned and selected toolchains and explain the failure boundary rather than promising successful chmod.
 * @evidence contracts/portability.md#os-neutral-implementation Windows bypasses POSIX permission bits; POSIX uses native stat/chmod and Node path APIs with explicit ownership-dependent modes.
 * @evidence contracts/performance.md#efficient-algorithms Native path/existence/stat checks precede ordinary-directory enumeration. Selected entries are stat-kind checked and unchanged modes avoid chmod; recursive helper arrays append descendant references through ancestors, so enumeration count alone does not bound path/array work. Native lookup/text/listing buffers contribute cost without reading compiler content.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Permission state must be read on the current installation; no cross-call validity cache is owned here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The traversal holds only its temporary file list and synchronous filesystem operations acquire no retained handle.
 */
export function ensureExecutableGoToolchain(
  goBinary: string,
  normalizeBundledPermissions: boolean,
): void {
  if (process.platform === "win32") return;
  if (!path.isAbsolute(goBinary) || !fs.existsSync(goBinary)) return;
  try {
    if (!ensureExecutableFile(goBinary, normalizeBundledPermissions)) return;
    const goRoot = GoSourceInputs.inferGoRoot(goBinary);
    if (!goRoot) return;
    const gofmt = path.join(path.dirname(goBinary), "gofmt");
    if (fs.existsSync(gofmt)) {
      ensureExecutableFile(gofmt, normalizeBundledPermissions);
    }
    const toolDir = path.join(goRoot, "pkg", "tool");
    if (!fs.existsSync(toolDir)) return;
    for (const file of walkToolFiles(toolDir)) {
      ensureExecutableFile(file, normalizeBundledPermissions);
    }
  } catch {
    // Let the subsequent go build spawn fail with the real OS error.
  }
}

/** Normalize owned files or add only owner execution to a nonexecutable file. */
function ensureExecutableFile(
  file: string,
  normalizeBundledPermissions: boolean,
): boolean {
  const stats = fs.statSync(file);
  if (!stats.isFile()) return false;
  const mode = stats.mode & 0o7777;
  if (normalizeBundledPermissions) {
    if (mode !== 0o755) fs.chmodSync(file, 0o755);
  } else if ((mode & 0o111) === 0) {
    fs.chmodSync(file, mode | 0o100);
  }
  return true;
}

function walkToolFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const entryToAppend of walkToolFiles(file)) out.push(entryToAppend);
    } else if (entry.isFile()) {
      out.push(file);
    }
  }
  return out;
}
