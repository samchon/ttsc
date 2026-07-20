import zlib from "node:zlib";

import {
  assert,
  child_process,
  fs,
  path,
  workspaceRoot,
} from "../../internal/toolchain";

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
 *    against the real release verifier.
 * 2. Accept complete 0644 Windows artifacts without executable metadata while
 *    keeping the unlisted Go-tool and non-platform boundaries explicit.
 * 3. Confirm win32-arm64 follows the same base-path rule.
 */
export const test_platform_package_windows_contents_require_base_executables =
  () => {
    const root = fs.mkdtempSync(
      path.join(process.cwd(), ".tmp-platform-windows-"),
    );
    try {
      const script = path.join(
        workspaceRoot,
        "scripts",
        "assert-platform-package.cjs",
      );
      const emptySource = path.join(root, "empty-source");
      const emptyTarball = path.join(root, "empty.tgz");
      writeWindowsSourcePackage(emptySource, []);
      writeWindowsTarball(emptyTarball, []);
      assertMissing(script, emptySource, "missing executable bin/ttsc.exe");
      assertMissing(
        script,
        emptyTarball,
        "tarball missing executable bin/ttsc.exe",
      );

      const withoutGofmt = windowsBaseExecutables.filter(
        (rel) => rel !== "bin/go/bin/gofmt.exe",
      );
      const missingGofmtSource = path.join(root, "missing-gofmt-source");
      const missingGofmtTarball = path.join(root, "missing-gofmt.tgz");
      writeWindowsSourcePackage(missingGofmtSource, withoutGofmt);
      writeWindowsTarball(missingGofmtTarball, withoutGofmt);
      assertMissing(
        script,
        missingGofmtSource,
        "missing executable bin/go/bin/gofmt.exe",
      );
      assertMissing(
        script,
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
      assertAccepted(script, completeSource);
      assertAccepted(script, completeTarball);

      const baseOnlySource = path.join(root, "base-only-source");
      const baseOnlyTarball = path.join(root, "base-only.tgz");
      writeWindowsSourcePackage(baseOnlySource, windowsBaseExecutables);
      writeWindowsTarball(baseOnlyTarball, windowsBaseExecutables);
      assertAccepted(script, baseOnlySource);
      assertAccepted(script, baseOnlyTarball);

      const arm64Source = path.join(root, "arm64-source");
      writeWindowsSourcePackage(
        arm64Source,
        windowsBaseExecutables,
        "@ttsc/win32-arm64",
      );
      assertAccepted(script, arm64Source);

      const nonPlatform = path.join(root, "non-platform");
      writeWindowsSourcePackage(nonPlatform, [], "@ttsc/example");
      assertAccepted(script, nonPlatform);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

function assertMissing(script: string, target: string, expected: string): void {
  const result = runVerifier(script, target);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.stderr.includes(expected), result.stderr);
}

function assertAccepted(script: string, target: string): void {
  const result = runVerifier(script, target);
  assert.equal(result.status, 0, result.stderr);
}

function runVerifier(script: string, target: string) {
  return child_process.spawnSync(process.execPath, [script, target], {
    cwd: workspaceRoot,
    encoding: "utf8",
    windowsHide: true,
  });
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
