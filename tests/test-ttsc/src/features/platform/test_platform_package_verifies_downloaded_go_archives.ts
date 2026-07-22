import { createHash } from "node:crypto";

import {
  assert,
  fs,
  path,
  requireFromTest,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * The platform packager must source a checksum from official Go metadata and
 * reject a cached or newly downloaded archive whose bytes differ from it.
 */
export const test_platform_package_verifies_downloaded_go_archives = () => {
  const integrity = requireFromTest(
    path.join(workspaceRoot, "scripts", "go-sdk-integrity.cjs"),
  ) as {
    findGoArchiveChecksum: (
      downloads: unknown,
      version: string,
      archive: string,
    ) => string | undefined;
    verifyGoArchiveChecksum: (file: string, expected: string) => void;
  };
  const archive = path.join(
    workspaceRoot,
    ".cache",
    "test-go-sdk-integrity.archive",
  );
  const contents = "verified Go SDK archive fixture";
  const checksum = createHash("sha256").update(contents).digest("hex");
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  fs.writeFileSync(archive, contents, "utf8");
  try {
    assert.equal(
      integrity.findGoArchiveChecksum(
        [
          {
            version: "go1.99.0",
            files: [
              { filename: "go1.99.0.linux-amd64.tar.gz", sha256: checksum },
            ],
          },
        ],
        "go1.99.0",
        "go1.99.0.linux-amd64.tar.gz",
      ),
      checksum,
    );
    assert.equal(
      integrity.findGoArchiveChecksum([], "go1.99.0", "missing.tar.gz"),
      undefined,
    );
    integrity.verifyGoArchiveChecksum(archive, checksum);
    assert.throws(
      () => integrity.verifyGoArchiveChecksum(archive, "0".repeat(64)),
      /checksum mismatch/,
    );
  } finally {
    fs.rmSync(archive, { force: true });
  }

  const packager = fs.readFileSync(
    path.join(workspaceRoot, "scripts", "build-platform-package.cjs"),
    "utf8",
  );
  assert.match(packager, /https:\/\/go\.dev\/dl\/\?mode=json&include=all/);
  assert.match(packager, /fetchGoArchiveChecksum/);
  assert.match(packager, /ensureVerifiedGoArchive/);
};
