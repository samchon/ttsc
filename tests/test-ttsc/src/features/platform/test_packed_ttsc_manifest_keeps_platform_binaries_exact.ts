import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the packed ttsc manifest keeps bundled platform binaries exact.
 *
 * Unlike an external host or adapter, each @ttsc platform package carries the
 * native executable selected by the matching launcher release. A caret range
 * could resolve a mismatched binary, so these seven edges deliberately remain
 * exact while independently upgradeable package relationships use ranges.
 *
 * 1. Pack ttsc and extract its published package manifest.
 * 2. Assert every platform optional dependency equals the packed ttsc version with
 *    no range operator.
 * 3. Assert the exact-version guard rejects a caret range for that version.
 */
export const test_packed_ttsc_manifest_keeps_platform_binaries_exact = () => {
  const manifest = readPackedManifest();
  assert.equal(
    typeof manifest.version,
    "string",
    "packed ttsc needs a version",
  );
  for (const name of PLATFORM_PACKAGES) {
    assertExactPlatformVersion(
      manifest.optionalDependencies?.[name],
      manifest.version,
      name,
    );
  }
  assert.throws(
    () =>
      assertExactPlatformVersion(
        `^${manifest.version}`,
        manifest.version,
        "range",
      ),
    /exact version/,
  );
};

const PLATFORM_PACKAGES = [
  "@ttsc/linux-x64",
  "@ttsc/linux-arm",
  "@ttsc/linux-arm64",
  "@ttsc/darwin-x64",
  "@ttsc/darwin-arm64",
  "@ttsc/win32-x64",
  "@ttsc/win32-arm64",
] as const;

function readPackedManifest(): Record<string, any> {
  const packageDir = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc");
  const destination = TestProject.tmpdir("ttsc-runtime-pack-");
  const pack = spawnSync("pnpm", ["pack", "--pack-destination", destination], {
    cwd: packageDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert.equal(pack.status, 0, `pnpm pack failed:\n${pack.stderr}`);

  const tarball = fs
    .readdirSync(destination)
    .find((name) => name.endsWith(".tgz"));
  assert.ok(tarball, "pnpm pack produced no ttsc tarball");
  const manifest = spawnSync(
    "tar",
    ["-xzOf", tarball, "package/package.json"],
    {
      cwd: destination,
      encoding: "utf8",
    },
  );
  assert.equal(
    manifest.status,
    0,
    `tar extraction failed:\n${manifest.stderr}`,
  );
  return JSON.parse(manifest.stdout);
}

function assertExactPlatformVersion(
  value: unknown,
  version: string,
  dependency: string,
): void {
  assert.equal(
    typeof value,
    "string",
    `${dependency} must publish a platform binary version`,
  );
  const spec = value as string;
  assert.match(
    spec,
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
    `${dependency} must publish an exact version, not a range`,
  );
  assert.equal(
    spec,
    version,
    `${dependency} must publish the exact matching platform binary version`,
  );
}
