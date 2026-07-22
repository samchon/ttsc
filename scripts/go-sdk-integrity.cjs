const crypto = require("node:crypto");
const fs = require("node:fs");

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

module.exports = {
  findGoArchiveChecksum,
  sha256File,
  verifyGoArchiveChecksum,
};
