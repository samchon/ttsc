const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const extractedChecksumFile = ".ttsc-go-sdk-sha256";

/** Find the official SHA-256 for one Go release archive. */
function findGoArchiveChecksum(downloads, version, archive) {
  if (!Array.isArray(downloads)) return undefined;
  const release = downloads.find((entry) => entry?.version === version);
  if (!Array.isArray(release?.files)) return undefined;
  const checksum = release.files.find(
    (file) => file?.filename === archive,
  )?.sha256;
  return typeof checksum === "string" && /^[a-f0-9]{64}$/i.test(checksum)
    ? checksum.toLowerCase()
    : undefined;
}

/** Compute one archive's SHA-256 without trusting its filename or cache path. */
function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

/** Fail closed when an archive differs from the official checksum. */
function verifyGoArchiveChecksum(file, expected) {
  const actual = sha256File(file);
  if (actual !== expected.toLowerCase()) {
    throw new Error(
      `build-platform-package: Go SDK archive checksum mismatch for ${file}: expected ${expected}, got ${actual}`,
    );
  }
}

/** Verify a cache entry or replace it only after the replacement verifies. */
function verifyOrReplaceGoArchive(archive, expected, temporary, download) {
  if (fs.existsSync(archive)) {
    try {
      verifyGoArchiveChecksum(archive, expected);
      return false;
    } catch {
      // The temporary download is verified before replacing this cache entry.
    }
  }
  try {
    download(temporary);
    verifyGoArchiveChecksum(temporary, expected);
    fs.rmSync(archive, { force: true, recursive: true });
    fs.renameSync(temporary, archive);
    return true;
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/** Return whether an extracted SDK was produced from the verified archive. */
function hasVerifiedGoExtraction(extractDir, goBinary, checksum) {
  if (!fs.existsSync(goBinary)) return false;
  try {
    const recorded = fs
      .readFileSync(path.join(extractDir, extractedChecksumFile), "utf8")
      .trim();
    return recorded === checksum;
  } catch {
    return false;
  }
}

/** Bind a successfully extracted SDK to the archive checksum that produced it. */
function recordVerifiedGoExtraction(extractDir, checksum) {
  fs.writeFileSync(
    path.join(extractDir, extractedChecksumFile),
    `${checksum}\n`,
    "utf8",
  );
}

module.exports = {
  findGoArchiveChecksum,
  hasVerifiedGoExtraction,
  recordVerifiedGoExtraction,
  sha256File,
  verifyGoArchiveChecksum,
  verifyOrReplaceGoArchive,
};
