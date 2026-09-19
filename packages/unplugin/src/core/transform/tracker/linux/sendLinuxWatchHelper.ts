import type { LinuxWatchHelper } from "./LinuxWatchHelper";

/**
 * Write one request line to the Linux watch helper, and report whether it could
 * be written (samchon/ttsc#1426).
 */
export function sendLinuxWatchHelper(
  helper: LinuxWatchHelper,
  request: { id: number; op: "add" | "remove" | "sync"; path?: string },
): boolean {
  const input = helper.child.stdin;
  if (input === null || input.destroyed || !input.writable) return false;
  try {
    input.write(`${JSON.stringify(request)}\n`);
    return true;
  } catch {
    return false;
  }
}
