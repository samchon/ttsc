import { TestProject } from "@ttsc/testing";
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
    hasVerifiedGoExtraction: (
      extractDir: string,
      goBinary: string,
      checksum: string,
    ) => boolean;
    recordVerifiedGoExtraction: (
      extractDir: string,
      checksum: string,
    ) => void;
    verifyGoArchiveChecksum: (file: string, expected: string) => void;
    verifyOrReplaceGoArchive: (
      archive: string,
      expected: string,
      temporary: string,
      download: (target: string) => void,
    ) => boolean;
  };
  const root = TestProject.tmpdir("ttsc-go-sdk-integrity-");
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

  const packager = fs.readFileSync(
    path.join(workspaceRoot, "scripts", "build-platform-package.cjs"),
    "utf8",
  );
  assert.match(packager, /https:\/\/go\.dev\/dl\/\?mode=json&include=all/);
  assert.match(packager, /fetchGoArchiveChecksum/);
  assert.match(packager, /ensureVerifiedGoArchive/);
  assert.match(packager, /hasVerifiedGoExtraction/);
  assert.match(packager, /recordVerifiedGoExtraction/);
};
