const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/**
 * Supply the real materializer with caller artifacts or run-owned compiler bytes.
 *
 * The actual preparation dependency supplies package selection and packing.
 * Ordinary units exercise this decision seam with small explicit producers;
 * real pnpm publication and installation remain the owning E2E boundary.
 *
 * @evidence contracts/common.md#principled-implementation The actual toolchain owns package selection; borrowed entries must match its real manifests and exact regular-file identity/content. Remaining packages use its normal producer, and the materializer still performs its distinct installation.
 * @evidence contracts/common.md#clear-and-simple-design One decision seam preserves complete caller artifacts and standalone packing while substituting only explicitly borrowed compiler archives in the existing toolchain order.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Borrowing never substitutes an installed workspace or compiler result. Missing, changed, duplicate and foreign archive entries fail before they can authorize installation.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes decision-unit proof from real publication and installation, and identifies the actual toolchain dependency as package-selection owner.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat/realpath and streamed bytes qualify regular files on each OS without guessed path case rules; the existing toolchain owns argv-based package-manager spawning.
 * @evidence contracts/performance.md#efficient-algorithms A map selects borrowed entries in linear toolchain order. Each selected archive is streamed through a fixed 64 KiB buffer; remaining pack costs follow their actual package sizes.
 * @evidence contracts/performance.md#reuse-equivalent-work Exact archives qualified by the parent owner are reused within its active loan; all other toolchain and Evidence producers still run. Standalone calls acquire their original complete pack population.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Hash descriptors close in finally. The parent owns the loan until this preparation child returns, including real installation; this function never removes borrowed inputs or retains a historical archive registry.
 */
async function prepareArtifacts(request, EvidenceBenchmarkToolchain) {
  const packPackage = async (directory, archive) => {
    const started = performance.now();
    await EvidenceBenchmarkToolchain.packPackage(request.repository, directory, archive);
    console.info("TTSC_BACKEND_ARCHIVE_COST " + JSON.stringify({ phase: "pack", directory, elapsedMs: performance.now() - started }));
  };
  let toolchain = request.toolchain;
  let artifact = request.artifact;
  if (!toolchain || !artifact) {
    const archives = path.join(request.root, "archives");
    fs.mkdirSync(archives);
    if (!request.borrowedCompilerArchives) {
      const started = performance.now();
      toolchain = await EvidenceBenchmarkToolchain.pack(request.repository, archives);
      console.info("TTSC_BACKEND_ARCHIVE_COST " + JSON.stringify({ phase: "pack-toolchain", directories: EvidenceBenchmarkToolchain.directories, elapsedMs: performance.now() - started }));
    } else {
      const borrowed = new Map(request.borrowedCompilerArchives.map((entry) => [entry.directory, entry]));
      if (borrowed.size !== request.borrowedCompilerArchives.length)
        throw new Error("Duplicate borrowed compiler archive");
      for (const directory of borrowed.keys())
        if (!EvidenceBenchmarkToolchain.directories.includes(directory))
          throw new Error("Borrowed compiler archive is outside the toolchain");
      toolchain = [];
      for (const directory of EvidenceBenchmarkToolchain.directories) {
        const { name } = JSON.parse(fs.readFileSync(path.join(request.repository, directory, "package.json"), "utf8"));
        if (typeof name !== "string")
          throw new Error("Toolchain package manifest name must be a string: " + directory);
        const candidate = borrowed.get(directory);
        if (candidate) {
          const started = performance.now();
          const stat = fs.lstatSync(candidate.archive, { bigint: true });
          const identity = [stat.dev, stat.ino, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs].join(":");
          if (candidate.name !== name || !stat.isFile() ||
              fs.realpathSync.native(candidate.archive) !== candidate.physical ||
              identity !== candidate.identity)
            throw new Error("Borrowed compiler archive identity changed: " + directory);
          const hash = crypto.createHash("sha256");
          const descriptor = fs.openSync(candidate.archive, "r");
          let bytes = 0;
          try {
            const buffer = Buffer.allocUnsafe(64 * 1024);
            for (;;) {
              const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
              if (!count) break;
              bytes += count;
              hash.update(buffer.subarray(0, count));
            }
          } finally { fs.closeSync(descriptor); }
          const after = fs.lstatSync(candidate.archive, { bigint: true });
          if ([after.dev, after.ino, after.size, after.mode, after.mtimeNs, after.ctimeNs].join(":") !== identity ||
              fs.realpathSync.native(candidate.archive) !== candidate.physical)
            throw new Error("Borrowed compiler archive changed while reading: " + directory);
          if (hash.digest("hex") !== candidate.sha256)
            throw new Error("Borrowed compiler archive bytes changed: " + directory);
          console.info("TTSC_BACKEND_ARCHIVE_COST " + JSON.stringify({ phase: "qualify-archive", directory, files: 1, bytes, elapsedMs: performance.now() - started }));
          toolchain.push({ name, archive: candidate.archive });
          borrowed.delete(directory);
        } else {
          const archive = path.join(archives, path.basename(directory) + ".tgz");
          await packPackage(directory, archive);
          toolchain.push({ name, archive });
        }
      }
      if (borrowed.size) throw new Error("Borrowed compiler archive is outside the toolchain");
    }
    const archive = path.join(archives, "evidence.tgz");
    await packPackage(
      "packages/evidence",
      archive,
    );
    artifact = { name: "@ttsc/evidence", archive };
  }
  return { toolchain, artifact };
}

module.exports = { prepareArtifacts };
