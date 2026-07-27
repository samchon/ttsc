import { TestProject } from "@ttsc/testing";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import {
  assert,
  fs,
  path,
  requireFromTest,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies platform package: extracts Go tar archives with relative operands.
 *
 * Git for Windows GNU tar parses an absolute drive-letter archive path as a
 * remote host. The package owner must compose authenticated cache reuse,
 * cwd-relative extraction, binary validation, and marker publication without
 * letting a verification or extraction failure publish success.
 *
 * 1. Build a small real Go-shaped tar.gz beneath paths containing spaces.
 * 2. Drive the verified-extraction owner and assert its tar process boundary.
 * 3. Pin checksum-first recovery, zip preservation, and marker boundaries.
 */
export const test_platform_package_extracts_go_tar_with_relative_operands =
  () => {
    const extraction = requireFromTest(
      path.join(workspaceRoot, "scripts", "go-sdk-extraction.cjs"),
    ) as {
      ensureVerifiedGoExtraction: (input: {
        archivePath: string;
        checksum: string;
        extractDir: string;
        extractZipArchive: (archivePath: string, extractDir: string) => void;
        goBinary: string;
        verifyArchive: (archivePath: string, checksum: string) => void;
      }) => void;
      resolveTarExtraction: (
        archivePath: string,
        extractDir: string,
      ) => {
        args: string[];
        cwd: string;
        executable: string;
      };
    };
    const integrity = requireFromTest(
      path.join(workspaceRoot, "scripts", "go-sdk-integrity.cjs"),
    ) as {
      hasVerifiedGoExtraction: (
        extractDir: string,
        goBinary: string,
        checksum: string,
      ) => boolean;
      verifyGoArchiveChecksum: (file: string, expected: string) => void;
    };
    const root = TestProject.tmpdir("ttsc go sdk extraction ");
    const cacheRoot = path.join(root, "cache with spaces");
    const sourceRoot = path.join(root, "source with spaces");
    const archivePath = path.join(cacheRoot, "go-sdk.tar.gz");
    const extractDir = path.join(cacheRoot, "extracted sdk");
    const sourceVersionFile = path.join(sourceRoot, "go", "VERSION");
    const sourceGoBinary = path.join(sourceRoot, "go", "bin", "go");
    const goBinary = path.join(extractDir, "go", "bin", "go");
    const markerName = ".ttsc-go-sdk-sha256";
    try {
      fs.mkdirSync(path.dirname(sourceGoBinary), { recursive: true });
      fs.mkdirSync(cacheRoot, { recursive: true });
      fs.writeFileSync(sourceVersionFile, "go1.99.0\n", "utf8");
      fs.writeFileSync(sourceGoBinary, "go compiler fixture\n", "utf8");
      execFileSync(
        "tar",
        [
          "-czf",
          path.basename(archivePath),
          "-C",
          path.relative(cacheRoot, sourceRoot),
          "go",
        ],
        { cwd: cacheRoot, stdio: "pipe" },
      );
      const checksum = createHash("sha256")
        .update(fs.readFileSync(archivePath))
        .digest("hex");

      const command = extraction.resolveTarExtraction(archivePath, extractDir);
      assert.equal(command.executable, "tar");
      assert.equal(command.cwd, cacheRoot);
      assert.deepEqual(command.args, [
        "-xzf",
        path.basename(archivePath),
        "-C",
        path.basename(extractDir),
      ]);
      assert.equal(path.isAbsolute(command.args[1]!), false);
      assert.equal(path.isAbsolute(command.args[3]!), false);
      assert.throws(
        () =>
          extraction.resolveTarExtraction(
            path.basename(archivePath),
            extractDir,
          ),
        /paths must be absolute/,
      );
      assert.throws(
        () =>
          extraction.resolveTarExtraction(
            archivePath,
            path.join(root, "outside cache"),
          ),
        /must be inside the archive cache/,
      );

      const staleFile = path.join(extractDir, "stale");
      fs.mkdirSync(extractDir, { recursive: true });
      fs.writeFileSync(staleFile, "stale", "utf8");
      let verificationCount = 0;
      const verifyArchive = (file: string, expected: string) => {
        verificationCount++;
        if (verificationCount === 1) {
          assert.equal(
            fs.existsSync(staleFile),
            true,
            "archive verification must finish before stale extraction reset",
          );
        }
        integrity.verifyGoArchiveChecksum(file, expected);
      };
      const rejectZip = () => assert.fail("tar archive reached zip extractor");
      extraction.ensureVerifiedGoExtraction({
        archivePath,
        checksum,
        extractDir,
        extractZipArchive: rejectZip,
        goBinary,
        verifyArchive,
      });
      assert.equal(verificationCount, 1);
      assert.equal(fs.existsSync(staleFile), false);
      assert.equal(
        fs.readFileSync(path.join(extractDir, "go", "VERSION"), "utf8"),
        "go1.99.0\n",
      );
      assert.equal(
        integrity.hasVerifiedGoExtraction(extractDir, goBinary, checksum),
        true,
      );

      fs.writeFileSync(
        path.join(extractDir, "go", "VERSION"),
        "retained cache\n",
        "utf8",
      );
      extraction.ensureVerifiedGoExtraction({
        archivePath,
        checksum,
        extractDir,
        extractZipArchive: rejectZip,
        goBinary,
        verifyArchive,
      });
      assert.equal(verificationCount, 2);
      assert.equal(
        fs.readFileSync(path.join(extractDir, "go", "VERSION"), "utf8"),
        "retained cache\n",
        "a matching marker must reuse the authenticated extraction",
      );

      const mismatchExtractDir = path.join(cacheRoot, "mismatch extraction");
      const mismatchSentinel = path.join(mismatchExtractDir, "sentinel");
      fs.mkdirSync(mismatchExtractDir, { recursive: true });
      fs.writeFileSync(mismatchSentinel, "keep", "utf8");
      assert.throws(
        () =>
          extraction.ensureVerifiedGoExtraction({
            archivePath,
            checksum: "0".repeat(64),
            extractDir: mismatchExtractDir,
            extractZipArchive: rejectZip,
            goBinary: path.join(mismatchExtractDir, "go", "bin", "go"),
            verifyArchive,
          }),
        /checksum mismatch/,
      );
      assert.equal(
        fs.existsSync(mismatchSentinel),
        true,
        "failed authentication must not reset the existing extraction",
      );
      assert.equal(
        fs.existsSync(path.join(mismatchExtractDir, markerName)),
        false,
      );

      const missingBinaryDir = path.join(cacheRoot, "missing binary");
      assert.throws(
        () =>
          extraction.ensureVerifiedGoExtraction({
            archivePath,
            checksum,
            extractDir: missingBinaryDir,
            extractZipArchive: rejectZip,
            goBinary: path.join(missingBinaryDir, "go", "bin", "missing"),
            verifyArchive,
          }),
        /downloaded Go compiler missing/,
      );
      assert.equal(
        fs.existsSync(path.join(missingBinaryDir, markerName)),
        false,
      );

      const zipArchive = path.join(cacheRoot, "go-sdk.zip");
      const zipExtractDir = path.join(cacheRoot, "zip extraction");
      const zipGoBinary = path.join(zipExtractDir, "go", "bin", "go.exe");
      fs.writeFileSync(zipArchive, "verified zip fixture", "utf8");
      const zipChecksum = createHash("sha256")
        .update(fs.readFileSync(zipArchive))
        .digest("hex");
      let zipExtractionCount = 0;
      extraction.ensureVerifiedGoExtraction({
        archivePath: zipArchive,
        checksum: zipChecksum,
        extractDir: zipExtractDir,
        extractZipArchive: (file, destination) => {
          zipExtractionCount++;
          assert.equal(file, zipArchive);
          assert.equal(destination, zipExtractDir);
          fs.mkdirSync(path.dirname(zipGoBinary), { recursive: true });
          fs.writeFileSync(zipGoBinary, "go compiler fixture\n", "utf8");
        },
        goBinary: zipGoBinary,
        verifyArchive,
      });
      assert.equal(zipExtractionCount, 1);
      assert.equal(
        integrity.hasVerifiedGoExtraction(
          zipExtractDir,
          zipGoBinary,
          zipChecksum,
        ),
        true,
      );

      const failedZipDir = path.join(cacheRoot, "failed zip extraction");
      assert.throws(
        () =>
          extraction.ensureVerifiedGoExtraction({
            archivePath: zipArchive,
            checksum: zipChecksum,
            extractDir: failedZipDir,
            extractZipArchive: () => {
              throw new Error("zip extraction failed");
            },
            goBinary: path.join(failedZipDir, "go", "bin", "go.exe"),
            verifyArchive,
          }),
        /zip extraction failed/,
      );
      assert.equal(fs.existsSync(path.join(failedZipDir, markerName)), false);

      const invalidArchive = path.join(cacheRoot, "invalid.tar.gz");
      const failedExtractDir = path.join(cacheRoot, "failed extraction");
      fs.writeFileSync(invalidArchive, "not a tar archive", "utf8");
      const invalidChecksum = createHash("sha256")
        .update(fs.readFileSync(invalidArchive))
        .digest("hex");
      assert.throws(() =>
        extraction.ensureVerifiedGoExtraction({
          archivePath: invalidArchive,
          checksum: invalidChecksum,
          extractDir: failedExtractDir,
          extractZipArchive: rejectZip,
          goBinary: path.join(failedExtractDir, "go", "bin", "go"),
          verifyArchive,
        }),
      );
      assert.equal(
        fs.existsSync(path.join(failedExtractDir, markerName)),
        false,
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
