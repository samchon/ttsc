const cp = require("node:child_process");
const path = require("node:path");

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
  };
}

/** Extract one verified Go SDK archive through the ambient tar implementation. */
function extractTarGzArchive(archivePath, extractDir) {
  const command = resolveTarExtraction(archivePath, extractDir);
  cp.execFileSync("tar", command.args, {
    cwd: command.cwd,
    stdio: "inherit",
  });
}

module.exports = {
  extractTarGzArchive,
  resolveTarExtraction,
};
