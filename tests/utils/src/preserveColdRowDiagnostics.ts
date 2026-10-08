import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Preserve closed process receipts and an explicitly partial stderr snapshot.
 *
 * Unknown readers keep their input files untouched. Their captured stderr is
 * diagnostic text only; it cannot certify join or resource release. Closed
 * readers permit copying receipt bytes with a manifest for later verification.
 *
 * @evidence contracts/common.md#principled-implementation Caller-supplied closure controls receipt copying; captured stderr is exported independently while partial and release flags retain their original meanings.
 * @evidence contracts/common.md#clear-and-simple-design One helper owns diagnostic snapshot files and their integrity manifest; the scenario continues to own actual join, resource release and retention.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Partial metadata never grants reclamation or converts an unsuccessful child exit to success; no changing input is read when closure is unknown.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes passive stderr snapshots from closed receipt copies and native lifetime authority.
 * @evidence contracts/portability.md#os-neutral-implementation Node filesystem/path APIs preserve native paths and bytes without shell quoting or process-liveness inference.
 * @evidence contracts/performance.md#efficient-algorithms A closed row scans its receipt tree once and hashes each copied file once; partial rows write only supplied metadata and stderr text.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each diagnostic occurrence needs its own immutable destination; earlier snapshots cannot represent later process states.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The runner owns snapshot reclamation; this helper closes synchronous writes and retains no handles or history. Original input release stays with the caller.
 */
export function preserveColdRowDiagnostics(
  row: { root: string; diagnosticRoot?: string },
  joined: boolean,
  releaseConfirmed: boolean,
  stderr?: string,
): string | undefined {
  if (!row.diagnosticRoot) return;
  const destination = fs.mkdtempSync(
    path.join(row.diagnosticRoot, `${path.basename(row.root)}-`),
  );
  const files: { file: string; size: number; sha256: string }[] = [];
  const copy = (source: string, target: string): void => {
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const original = path.join(source, entry.name);
      const output = path.join(target, entry.name);
      if (
        entry.isDirectory() &&
        source === row.root &&
        entry.name === "trace"
      ) {
        fs.mkdirSync(output);
        copy(original, output);
      } else if (
        entry.isFile() &&
        /\.(jsonl|json|log|bin)$/u.test(entry.name)
      ) {
        const bytes = fs.readFileSync(original);
        const retained = entry.name.endsWith(".log")
          ? path.join(
              target,
              `${path.basename(row.root)}-${entry.name.slice(0, -4)}.bin`,
            )
          : output;
        fs.writeFileSync(retained, bytes, { flag: "wx" });
        files.push({
          file: path.relative(destination, retained),
          size: bytes.length,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  };
  // Live/unknown readers keep their original inputs. Metadata explicitly
  // records partial diagnostics instead of copying a changing authority.
  // A captured stderr string is diagnostic data, not a live-input snapshot or
  // successful join certificate, and remains useful even for a partial row.
  if (joined) copy(row.root, destination);
  fs.writeFileSync(
    path.join(destination, "row.jsonl"),
    JSON.stringify({
      at: new Date().toISOString(),
      original: row.root,
      joined,
      releaseConfirmed,
      partial: !joined,
      ...(stderr === undefined ? {} : { stderr }),
      files,
    }) + "\n",
    { flag: "wx" },
  );
  return destination;
}
