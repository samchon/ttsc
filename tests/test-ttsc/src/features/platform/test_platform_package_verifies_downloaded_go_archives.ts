import os from "node:os";
import { createHash } from "node:crypto";

import {
  assert,
  fs,
  path,
  requireFromTest,
  workspaceRoot,
} from "../../internal/script-unit";

/**
 * Verifies platform package: authenticates downloaded Go SDK archives.
 *
 * A corrupt cached or newly downloaded SDK must never enter the extraction
 * transaction. The package owner sources the official checksum, verifies or
 * replaces the archive, and then delegates authenticated extraction.
 *
 * 1. Resolve official metadata and replace a corrupt cache through SHA-256.
 * 2. Pin replacement failure cleanup and checksum-bound extraction markers.
 *
 * @evidence contracts/testing.md#behavioral-verification integrity functions select official metadata, authenticate replacement bytes and bind extraction markers to their checksum.
 * @evidence contracts/testing.md#independent-expectations SHA-256 of independently authored fixture bytes establishes the expected archive digest.
 * @evidence contracts/testing.md#distinguishing-cases valid replacement and marker reuse contrast with absent metadata, checksum mismatch cleanup and missing marker.
 * @evidence contracts/testing.md#execution-ownership The named test_platform_package_verifies_downloaded_go_archives export is discovered under src/features/platform and calls the owning authored operation without installation, native compilation or a product host.
 */
export function test_platform_package_verifies_downloaded_go_archives() {
  const integrity = requireFromTest(
    path.join(workspaceRoot, "scripts", "go-sdk-integrity.cjs"),
  ) as {
    findGoArchiveChecksum: (
      downloads: unknown,
      version: string,
      archive: string,
    ) => string | undefined;
    hasVerifiedGoExtraction: (
      extractDir: string,
      goBinary: string,
      checksum: string,
    ) => boolean;
    recordVerifiedGoExtraction: (extractDir: string, checksum: string) => void;
    verifyGoArchiveChecksum: (file: string, expected: string) => void;
    verifyOrReplaceGoArchive: (
      archive: string,
      expected: string,
      temporary: string,
      download: (target: string) => void,
    ) => boolean;
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-go-sdk-integrity-"));
  const archive = path.join(root, "go-sdk.archive");
  const temporary = path.join(root, "go-sdk.archive.download");
  const contents = "verified Go SDK archive fixture";
  const checksum = createHash("sha256").update(contents).digest("hex");
  fs.writeFileSync(archive, "corrupt cached archive", "utf8");
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
    assert.equal(
      integrity.verifyOrReplaceGoArchive(
        archive,
        checksum,
        temporary,
        (target) => fs.writeFileSync(target, contents, "utf8"),
      ),
      true,
      "a corrupt cache is replaced only after a verified temporary download",
    );
    integrity.verifyGoArchiveChecksum(archive, checksum);
    assert.equal(fs.existsSync(temporary), false);
    assert.throws(
      () =>
        integrity.verifyOrReplaceGoArchive(
          archive,
          "0".repeat(64),
          temporary,
          (target) => fs.writeFileSync(target, contents, "utf8"),
        ),
      /checksum mismatch/,
    );
    assert.equal(
      fs.existsSync(temporary),
      false,
      "a failed replacement must remove its temporary download",
    );

    const extractDir = path.join(root, "extract");
    const goBinary = path.join(extractDir, "go", "bin", "go");
    fs.mkdirSync(path.dirname(goBinary), { recursive: true });
    fs.writeFileSync(goBinary, "go", "utf8");
    assert.equal(
      integrity.hasVerifiedGoExtraction(extractDir, goBinary, checksum),
      false,
    );
    integrity.recordVerifiedGoExtraction(extractDir, checksum);
    assert.equal(
      integrity.hasVerifiedGoExtraction(extractDir, goBinary, checksum),
      true,
    );
    assert.equal(
      integrity.hasVerifiedGoExtraction(extractDir, goBinary, "0".repeat(64)),
      false,
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}
