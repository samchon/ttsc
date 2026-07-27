import { TestProject } from "@ttsc/testing";
import { execFileSync } from "node:child_process";

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
 * remote host. The packager must anchor tar in the archive cache and keep both
 * filesystem operands relative without weakening extraction failures.
 *
 * 1. Create a real tar.gz beneath cache and source paths containing spaces.
 * 2. Assert the resolved tar command uses cache-relative filesystem operands.
 * 3. Extract and verify the payload, then assert a corrupt archive still fails.
 */
export const test_platform_package_extracts_go_tar_with_relative_operands =
  () => {
    const extraction = requireFromTest(
      path.join(workspaceRoot, "scripts", "go-sdk-extraction.cjs"),
    ) as {
      extractTarGzArchive: (archivePath: string, extractDir: string) => void;
      resolveTarExtraction: (
        archivePath: string,
        extractDir: string,
      ) => {
        args: string[];
        cwd: string;
      };
    };
    const root = TestProject.tmpdir("ttsc go sdk extraction ");
    const cacheRoot = path.join(root, "cache with spaces");
    const sourceRoot = path.join(root, "source with spaces");
    const archivePath = path.join(cacheRoot, "go-sdk.tar.gz");
    const extractDir = path.join(cacheRoot, "extracted sdk");
    const versionFile = path.join(sourceRoot, "go", "VERSION");
    try {
      fs.mkdirSync(path.dirname(versionFile), { recursive: true });
      fs.mkdirSync(cacheRoot, { recursive: true });
      fs.writeFileSync(versionFile, "go1.99.0\n", "utf8");
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

      const command = extraction.resolveTarExtraction(archivePath, extractDir);
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

      fs.mkdirSync(extractDir, { recursive: true });
      extraction.extractTarGzArchive(archivePath, extractDir);
      assert.equal(
        fs.readFileSync(path.join(extractDir, "go", "VERSION"), "utf8"),
        "go1.99.0\n",
      );

      const invalidArchive = path.join(cacheRoot, "invalid.tar.gz");
      const failedExtractDir = path.join(cacheRoot, "failed extraction");
      fs.writeFileSync(invalidArchive, "not a tar archive", "utf8");
      fs.mkdirSync(failedExtractDir, { recursive: true });
      assert.throws(() =>
        extraction.extractTarGzArchive(invalidArchive, failedExtractDir),
      );

      const packager = fs.readFileSync(
        path.join(workspaceRoot, "scripts", "build-platform-package.cjs"),
        "utf8",
      );
      assert.match(
        packager,
        /extractTarGzArchive\(archivePath, extractDir\)[\s\S]*recordVerifiedGoExtraction\(extractDir, checksum\)/,
        "failed tar extraction must precede the verified-extraction marker",
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
