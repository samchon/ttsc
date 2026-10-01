import zlib from "node:zlib";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { TestProject } from "../../../../utils/src/TestProject";
const { validatePlatformPackages } = createRequire(import.meta.url)(path.join(TestProject.WORKSPACE_ROOT, "scripts", "assert-platform-package.cjs")) as { validatePlatformPackages(args: string[]): string[] };

const windowsBaseExecutables = [
  "bin/ttsc.exe",
  "bin/ttscserver.exe",
  "bin/ttscgraph.exe",
  "bin/go/bin/go.exe",
  "bin/go/bin/gofmt.exe",
];

/**
 * Verifies Windows platform package contents require the base executables.
 *
 * Windows tarballs need every launcher and bundled-Go base executable even
 * though they do not carry POSIX executable bits or pnpm's POSIX-only
 * `executableFiles` metadata. The source and tarball gates must therefore share
 * the same independent five-path inventory instead of accepting an empty
 * package or trusting the artifact to inventory itself.
 *
 * 1. Exercise empty and single-file-missing Windows source packages and tarballs
 *    against the real release validation operation.
 * 2. Accept complete 0644 Windows artifacts without executable metadata while
 *    keeping the unlisted Go-tool and non-platform boundaries explicit.
 * 3. Confirm win32-arm64 follows the same base-path rule.
 *
 * @evidence contracts/testing.md#behavioral-verification Source and tarball validators accept complete Windows 0644 artifacts and reject missing required base executables, while accepting base-only artifacts, win32-arm64 and non-platform packages; mixed targets collect every error in target order and a later call retains none of the earlier diagnostics.
 * @evidence contracts/testing.md#independent-expectations Authored Windows executable paths and synthetic tar populations determine which required files are present; POSIX execute metadata is inapplicable to Windows.
 * @evidence contracts/testing.md#distinguishing-cases 1. Exercise empty and single-file-missing Windows source packages and tarballs against the real release validation operation. 2. Accept complete 0644 Windows artifacts without executable metadata while keeping the unlisted Go-tool and non-platform boundaries explicit. 3. Confirm win32-arm64 follows the same base-path rule.
 * @evidence contracts/testing.md#execution-ownership This source unit calls validatePlatformPackages on every original archive and directory variant without a process. The matching feature CLI batch retains positive/negative exit and stderr transport; all original validator failure meanings remain here.
 */
export const test_platform_package_windows_contents_require_base_executables =
  () => {
    const root = fs.mkdtempSync(
      path.join(process.cwd(), ".tmp-platform-windows-"),
    );
    try {
      const emptySource = path.join(root, "empty-source");
      const emptyTarball = path.join(root, "empty.tgz");
      writeWindowsSourcePackage(emptySource, []);
      writeWindowsTarball(emptyTarball, []);
      assertAllBaseExecutablesMissing(
        emptySource,
        "missing executable",
      );
      assertAllBaseExecutablesMissing(
        emptyTarball,
        "tarball missing executable",
      );

      const withoutGofmt = windowsBaseExecutables.filter(
        (rel) => rel !== "bin/go/bin/gofmt.exe",
      );
      const missingGofmtSource = path.join(root, "missing-gofmt-source");
      const missingGofmtTarball = path.join(root, "missing-gofmt.tgz");
      writeWindowsSourcePackage(missingGofmtSource, withoutGofmt);
      writeWindowsTarball(missingGofmtTarball, withoutGofmt);
      assertMissing(
        missingGofmtSource,
        "missing executable bin/go/bin/gofmt.exe",
      );
      assertMissing(
        missingGofmtTarball,
        "tarball missing executable bin/go/bin/gofmt.exe",
      );

      const completeSource = path.join(root, "complete-source");
      const completeTarball = path.join(root, "complete.tgz");
      const unlistedTool = "bin/go/pkg/tool/windows_amd64/compile.exe";
      writeWindowsSourcePackage(completeSource, [
        ...windowsBaseExecutables,
        unlistedTool,
      ]);
      writeWindowsTarball(completeTarball, [
        ...windowsBaseExecutables,
        unlistedTool,
      ]);
      assertAccepted(completeSource);
      assertAccepted(completeTarball);
      assert.deepEqual(
        validatePlatformPackages([emptySource, completeSource, emptyTarball]),
        windowsBaseExecutables.map((relative) => `@ttsc/win32-x64: missing executable ${relative}`).concat(
          windowsBaseExecutables.map((relative) => `@ttsc/win32-x64: tarball missing executable ${relative}`),
        ),
      );
      assert.deepEqual(validatePlatformPackages([completeSource]), []);

      const baseOnlySource = path.join(root, "base-only-source");
      const baseOnlyTarball = path.join(root, "base-only.tgz");
      writeWindowsSourcePackage(baseOnlySource, windowsBaseExecutables);
      writeWindowsTarball(baseOnlyTarball, windowsBaseExecutables);
      assertAccepted(baseOnlySource);
      assertAccepted(baseOnlyTarball);

      const arm64Source = path.join(root, "arm64-source");
      const arm64Tarball = path.join(root, "arm64.tgz");
      writeWindowsSourcePackage(
        arm64Source,
        windowsBaseExecutables,
        "@ttsc/win32-arm64",
      );
      writeWindowsTarball(
        arm64Tarball,
        windowsBaseExecutables,
        "@ttsc/win32-arm64",
      );
      assertAccepted(arm64Source);
      assertAccepted(arm64Tarball);

      const nonPlatform = path.join(root, "non-platform");
      writeWindowsSourcePackage(nonPlatform, [], "@ttsc/example");
      assertAccepted(nonPlatform);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

function assertMissing(target: string, expected: string): void {
  const result = runVerifier(target);
  assert.equal(result.diagnostics.length > 0, true, result.stderr);
  assert.ok(result.stderr.includes(expected), result.stderr);
}

function assertAllBaseExecutablesMissing(
  target: string,
  prefix: string,
): void {
  const result = runVerifier(target);
  assert.equal(result.diagnostics.length > 0, true, result.stderr);
  for (const rel of windowsBaseExecutables) {
    assert.ok(result.stderr.includes(`${prefix} ${rel}`), result.stderr);
  }
}

function assertAccepted(target: string): void {
  const result = runVerifier(target);
  assert.equal(result.diagnostics.length, 0, result.stderr);
}

function runVerifier(target: string) {
  const diagnostics = validatePlatformPackages([target]);
  return { diagnostics, stderr: diagnostics.join("\n") };
}

function writeWindowsSourcePackage(
  root: string,
  paths: string[],
  name = "@ttsc/win32-x64",
): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name, version: "0.0.0" }),
    "utf8",
  );
  for (const rel of paths) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "x", "utf8");
  }
}

function writeWindowsTarball(
  file: string,
  paths: string[],
  name = "@ttsc/win32-x64",
): void {
  const entries: TarEntry[] = [
    {
      content: JSON.stringify({ name, version: "0.0.0" }),
      mode: 0o644,
      name: "package/package.json",
    },
    ...paths.map((rel) => ({
      content: "x",
      mode: 0o644,
      name: `package/${rel}`,
    })),
  ];
  fs.writeFileSync(
    file,
    zlib.gzipSync(
      Buffer.concat([...entries.map(tarEntry), Buffer.alloc(1024)]),
    ),
  );
}

interface TarEntry {
  content: string;
  mode: number;
  name: string;
}

function tarEntry(entry: TarEntry): Buffer {
  const body = Buffer.from(entry.content);
  const header = Buffer.alloc(512, 0);
  writeString(header, 0, 100, entry.name);
  writeOctal(header, 100, 8, entry.mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, body.length);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeString(header, 156, 1, "0");
  writeString(header, 257, 6, "ustar");
  writeString(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeOctal(header, 148, 8, checksum);
  return Buffer.concat([header, body, Buffer.alloc(padding(body.length), 0)]);
}

function writeString(
  buffer: Buffer,
  offset: number,
  length: number,
  value: string,
): void {
  buffer.write(
    value,
    offset,
    Math.min(length, Buffer.byteLength(value)),
    "utf8",
  );
}

function writeOctal(
  buffer: Buffer,
  offset: number,
  length: number,
  value: number,
): void {
  const text = value.toString(8).padStart(length - 2, "0");
  buffer.write(`${text}\0`, offset, length, "ascii");
}

function padding(size: number): number {
  const remainder = size % 512;
  return remainder === 0 ? 0 : 512 - remainder;
}
