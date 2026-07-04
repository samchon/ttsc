import zlib from "node:zlib";

import {
  assert,
  child_process,
  fs,
  path,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies platform package tarballs require executable POSIX modes.
 *
 * Locks the release guard against publishing platform tarballs whose native
 * helpers or bundled Go tools have mode 0644. The runtime can repair first-use
 * installs, but release tarballs still need to fail before publication when the
 * tar headers do not preserve executable bits.
 *
 * 1. Write a synthetic @ttsc/linux-x64 tarball with every executable at 0755.
 * 2. Write a second tarball with ttscgraph at 0644.
 * 3. Write a source package whose manifest omits pnpm executable-file metadata.
 * 4. Write a source package whose manifest omits the bundled Go tool metadata.
 * 5. Assert the platform-package verifier accepts the good tarball, rejects the
 *    bad tarball with the offending path in stderr, and rejects unsafe source
 *    manifests before publish.
 */
export const test_platform_package_tarball_requires_posix_executable_modes =
  () => {
    const root = fs.mkdtempSync(
      path.join(process.cwd(), ".tmp-platform-tarball-"),
    );
    try {
      const good = path.join(root, "good.tgz");
      const bad = path.join(root, "bad.tgz");
      writePlatformTarball(good, {});
      writePlatformTarball(bad, { "package/bin/ttscgraph": 0o644 });

      const script = path.join(
        workspaceRoot,
        "scripts",
        "assert-platform-package.cjs",
      );
      const ok = child_process.spawnSync(process.execPath, [script, good], {
        cwd: workspaceRoot,
        encoding: "utf8",
        windowsHide: true,
      });
      assert.equal(ok.status, 0, ok.stderr);

      const rejected = child_process.spawnSync(
        process.execPath,
        [script, bad],
        {
          cwd: workspaceRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      );
      assert.equal(rejected.status, 1, rejected.stderr);
      assert.match(rejected.stderr, /bin\/ttscgraph has mode 644/);

      const source = path.join(root, "source");
      writePlatformSourcePackage(source);
      const missingPublishConfig = child_process.spawnSync(
        process.execPath,
        [script, source],
        {
          cwd: workspaceRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      );
      assert.equal(missingPublishConfig.status, 1, missingPublishConfig.stderr);
      assert.match(
        missingPublishConfig.stderr,
        /publishConfig\.executableFiles missing \.\/bin\/ttsc/,
      );

      const missingTool = path.join(root, "source-missing-tool");
      writePlatformSourcePackage(missingTool, {
        executableFiles: [
          "./bin/ttsc",
          "./bin/ttscserver",
          "./bin/ttscgraph",
          "./bin/go/bin/go",
          "./bin/go/bin/gofmt",
        ],
      });
      const missingToolConfig = child_process.spawnSync(
        process.execPath,
        [script, missingTool],
        {
          cwd: workspaceRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      );
      assert.equal(missingToolConfig.status, 1, missingToolConfig.stderr);
      assert.match(
        missingToolConfig.stderr,
        /publishConfig\.executableFiles missing \.\/bin\/go\/pkg\/tool\/linux_amd64\/compile/,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

function writePlatformSourcePackage(
  root: string,
  publishConfig: { executableFiles?: string[] } = {},
): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@ttsc/linux-x64",
      publishConfig: { access: "public", ...publishConfig },
      version: "0.0.0",
    }),
    "utf8",
  );
  for (const rel of [
    "bin/ttsc",
    "bin/ttscserver",
    "bin/ttscgraph",
    "bin/go/bin/go",
    "bin/go/bin/gofmt",
    "bin/go/pkg/tool/linux_amd64/compile",
  ]) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "x", "utf8");
  }
}

function writePlatformTarball(file: string, modes: Record<string, number>) {
  const entries: TarEntry[] = [
    {
      content: JSON.stringify({ name: "@ttsc/linux-x64", version: "0.0.0" }),
      mode: 0o644,
      name: "package/package.json",
    },
    ...[
      "package/bin/ttsc",
      "package/bin/ttscserver",
      "package/bin/ttscgraph",
      "package/bin/go/bin/go",
      "package/bin/go/bin/gofmt",
      "package/bin/go/pkg/tool/linux_amd64/compile",
    ].map((name) => ({
      content: "x",
      mode: modes[name] ?? 0o755,
      name,
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
