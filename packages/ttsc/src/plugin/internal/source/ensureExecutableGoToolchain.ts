import fs from "node:fs";
import path from "node:path";
import { GoSourceInputs } from "./GoSourceInputs";

/**
 * Make sure a POSIX Go toolchain can execute before ttsc reads its metadata.
 *
 * Package managers can drop the execute bit of the bundled Go SDK. For the
 * bundled toolchain (`normalizeBundledPermissions`) the `go` and `gofmt`
 * binaries and every file under `pkg/tool` are normalized to `0755`; for a
 * toolchain the user selected, only a missing owner-execute bit is added, so
 * ttsc never widens permissions it does not own. A no-op on Windows; failures
 * are left for the build spawn to report with the real OS error.
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

/** Repair tool execution without widening an explicitly selected toolchain. */
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
