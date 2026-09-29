import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";

/**
 * Make sure a POSIX Go toolchain can execute before ttsc reads its metadata.
 *
 * Package managers can drop the execute bit of the bundled Go SDK. For the
 * bundled toolchain (`normalizeBundledPermissions`) the `go` and `gofmt`
 * binaries and every file under `pkg/tool` are normalized to `0755`; for a
 * toolchain the user selected, the owner-execute bit is added only when no
 * execute bit is present, preserving other permission bits. Windows requires no
 * POSIX permission repair. Failures are left for the build spawn to report with
 * the real OS error.
 *
 * @evidence contracts/common.md#principled-implementation POSIX execute permissions are repaired before metadata probing; owned SDK files can be normalized while caller-selected files only gain the owner bit when no execute bit exists.
 * @evidence contracts/common.md#clear-and-simple-design Platform exit, SDK recognition and recursive tool discovery remain explicit; one private file operation owns the permission policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission repair serves real packaged SDK installation behavior, not an injected fixture bypass; failures remain visible through the actual Go spawn.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish owned and selected toolchains and explain the failure boundary rather than promising successful chmod.
 * @evidence contracts/portability.md#os-neutral-implementation Windows bypasses POSIX permission bits; POSIX uses native stat/chmod and Node path APIs with explicit ownership-dependent modes.
 * @evidence contracts/performance.md#efficient-algorithms SDK tool discovery visits each directory/file once; stat/chmod occurs only for relevant executable files and unchanged permissions avoid writes.
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
    ensureExecutableFile(goBinary, normalizeBundledPermissions);
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
): void {
  const mode = fs.statSync(file).mode & 0o7777;
  if (normalizeBundledPermissions) {
    if (mode !== 0o755) fs.chmodSync(file, 0o755);
  } else if ((mode & 0o111) === 0) {
    fs.chmodSync(file, mode | 0o100);
  }
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
      out.push(...walkToolFiles(file));
    } else if (entry.isFile()) {
      out.push(file);
    }
  }
  return out;
}
