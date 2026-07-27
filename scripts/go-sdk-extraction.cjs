const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const {
  hasVerifiedGoExtraction,
  recordVerifiedGoExtraction,
} = require("./go-sdk-integrity.cjs");

/**
 * Resolve tar operands relative to the archive cache directory.
 *
 * Git for Windows ships GNU tar, which interprets an absolute `D:\...`
 * archive operand as a remote-host archive. Keeping both filesystem operands
 * relative is portable across GNU tar and bsdtar.
 */
function resolveTarExtraction(archivePath, extractDir) {
  if (!path.isAbsolute(archivePath) || !path.isAbsolute(extractDir)) {
    throw new Error(
      "go-sdk-extraction: archive and extraction paths must be absolute",
    );
  }
  const cwd = path.dirname(archivePath);
  const archive = path.basename(archivePath);
  const destination = path.relative(cwd, extractDir);
  if (
    destination.length === 0 ||
    path.isAbsolute(destination) ||
    destination === ".." ||
    destination.startsWith(`..${path.sep}`)
  ) {
    throw new Error(
      "go-sdk-extraction: extraction directory must be inside the archive cache",
    );
  }
  return {
    args: ["-xzf", archive, "-C", destination],
    cwd,
    executable: "tar",
  };
}

/** Extract one verified Go SDK archive through the ambient tar implementation. */
function extractTarGzArchive(archivePath, extractDir) {
  const command = resolveTarExtraction(archivePath, extractDir);
  cp.execFileSync(command.executable, command.args, {
    cwd: command.cwd,
    stdio: "inherit",
  });
}

/**
 * Verify, recover, and record one downloaded Go SDK extraction transaction.
 *
 * `verifyArchive` owns download/cache authentication and must return only when
 * `archivePath` matches `checksum`. Extraction is then reset atomically from
 * the marker's perspective: any failure propagates before the marker is
 * written, while a matching existing marker reuses the verified SDK.
 */
function ensureVerifiedGoExtraction({
  archivePath,
  checksum,
  extractDir,
  extractZipArchive,
  goBinary,
  verifyArchive,
}) {
  verifyArchive(archivePath, checksum);
  if (hasVerifiedGoExtraction(extractDir, goBinary, checksum)) return;

  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  if (archivePath.endsWith(".tar.gz")) {
    extractTarGzArchive(archivePath, extractDir);
  } else {
    extractZipArchive(archivePath, extractDir);
  }
  if (!fs.existsSync(goBinary)) {
    throw new Error(
      `build-platform-package: downloaded Go compiler missing: ${goBinary}`,
    );
  }
  recordVerifiedGoExtraction(extractDir, checksum);
}

module.exports = {
  ensureVerifiedGoExtraction,
  extractTarGzArchive,
  resolveTarExtraction,
};
