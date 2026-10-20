import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { CompilerTarget } from "../../../../../packages/ttsc/src/plugin/internal/source/CompilerTarget";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies compiler-target selection from the project's installed TypeScript
 * line, and the build environment that carries the selected target.
 *
 * Each ttsc release ships a 7.0 and a 7.1 compiler target. A project's manifest
 * version, or a custom `TTSC_TSGO_BINARY`'s `--version` output, selects one; a
 * line newer than every target selects the newest after one warning per
 * version, and the 7.1 build tag joins GOFLAGS so every Go command compiles the
 * 7.1 files.
 *
 * 1. Map literal versions, including prereleases and unreadable text, to lines.
 * 2. Resolve a project whose installed manifest moves 7.0.2 → 7.1 nightly → 7.2.0
 *    → 8.0.0, capturing the warnings.
 * 3. Resolve a custom binary whose `--version` reports 7.1.
 * 4. Build environments for both lines and read their targets back, including
 *    GOFLAGS stored by `go env -w` in the file GOENV names.
 * 5. Remove the 7.1 tag from GOFLAGS, as the environment digest does.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production lineOf, resolve, buildEnv and ofEnv. resolve reads an installed manifest through resolveTsgo and runs a real custom binary's --version, stderr is captured to observe the newer-line warnings, and buildEnv asks the real Go toolchain for the GOFLAGS stored in a temporary GOENV file.
 * @evidence contracts/testing.md#independent-expectations Expected lines, warning text and GOFLAGS strings are authored literals from the issue's mapping (7.0.x → 7.0, 7.1.x including dev prereleases → 7.1, later → newest with a warning) and Go's -tags=a,b syntax.
 * @evidence contracts/testing.md#distinguishing-cases Each supported line contrasts with the newer lines and with pre-7 and unreadable versions; a repeated newer version must not warn twice, while a second newer version warns. GOFLAGS cases contrast absent flags, other flags kept in order, an existing tag list gaining the tag, an already-present tag not repeated, flags stored by go env -w joined when the environment sets none and replaced when it sets its own, and 7.0 leaving the environment unchanged. withoutTag contrasts a lone tag, a tag among other tags and flags, a lookalike tag that must stay, and empty flags, and inverts buildEnv.
 * @evidence contracts/testing.md#execution-ownership A unit test over a temporary project with fake TypeScript manifests and a Node script as the custom binary; Go runs only go env against a temporary GOENV file, no compiler runs, and stderr is restored in finally.
 */
export function test_compilertarget_selects_the_line_of_the_installed_compiler(): void {
  for (const [version, line, newer] of [
    ["7.0.0", "7.0", false],
    ["7.0.2", "7.0", false],
    ["7.0.1-rc", "7.0", false],
    ["7.1.0", "7.1", false],
    ["7.1.0-dev.20261019.1", "7.1", false],
    ["Version 7.1.0-dev.20261020.3", "7.1", false],
    ["7.2.0", "7.1", true],
    ["8.0.0", "7.1", true],
    ["6.0.3", "7.0", false],
    ["custom", "7.0", false],
    ["", "7.0", false],
  ] as const)
    assert.deepEqual(
      CompilerTarget.lineOf(version),
      { line, newer },
      `lineOf(${JSON.stringify(version)})`,
    );

  const root = TestProject.tmpdir("ttsc-compiler-target-");
  const manifest = path.join(
    root,
    "node_modules",
    "typescript",
    "package.json",
  );
  const platform = path.join(
    root,
    "node_modules",
    "@typescript",
    `typescript-${process.platform}-${process.arch}`,
  );
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.mkdirSync(path.join(platform, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(platform, "package.json"),
    JSON.stringify({ name: path.basename(platform), version: "0.0.0" }),
  );
  fs.writeFileSync(
    path.join(
      platform,
      "lib",
      process.platform === "win32" ? "tsc.exe" : "tsc",
    ),
    "",
  );
  const custom = path.join(root, "custom-tsc.cjs");
  fs.writeFileSync(
    custom,
    'process.stdout.write("Version 7.1.0-dev.20261020.3\\n");\n',
  );
  const install = (version: string): void =>
    fs.writeFileSync(manifest, JSON.stringify({ name: "typescript", version }));

  const warnings: string[] = [];
  const write = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    warnings.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  const env = { PATH: process.env.PATH };
  const resolved: string[] = [];
  try {
    for (const version of [
      "7.0.2",
      "7.1.0-dev.20261020.3",
      "7.2.0",
      "7.2.0",
      "8.0.0",
    ]) {
      install(version);
      resolved.push(CompilerTarget.resolve(root, env));
    }
    resolved.push(
      CompilerTarget.resolve(root, { ...env, TTSC_TSGO_BINARY: custom }),
    );
  } finally {
    process.stderr.write = write;
  }
  assert.deepEqual(resolved, ["7.0", "7.1", "7.1", "7.1", "7.1", "7.1"]);
  assert.deepEqual(warnings, [
    "ttsc: TypeScript 7.2.0 is newer than every compiler target this ttsc supports; using the TypeScript 7.1 compiler target.\n",
    "ttsc: TypeScript 8.0.0 is newer than every compiler target this ttsc supports; using the TypeScript 7.1 compiler target.\n",
  ]);

  // GOENV names a file `go env -w` would write, so no GOFLAGS stored for the
  // machine reaches the cases below.
  const stored = path.join(root, "go-env");
  const base: NodeJS.ProcessEnv = { ...process.env, GOENV: stored };
  delete base.GOFLAGS;
  assert.equal(CompilerTarget.buildEnv(base, "7.0", root), base);
  assert.equal(CompilerTarget.ofEnv(base), "7.0");
  for (const [storedFlags, flags, expected] of [
    [undefined, undefined, "-tags=ttsc_typescript_7_1"],
    [
      undefined,
      "-mod=mod  -trimpath",
      "-mod=mod -trimpath -tags=ttsc_typescript_7_1",
    ],
    [
      undefined,
      "-tags=netgo,osusergo -v",
      "-tags=netgo,osusergo,ttsc_typescript_7_1 -v",
    ],
    [undefined, "--tags=ttsc_typescript_7_1", "--tags=ttsc_typescript_7_1"],
    [
      "-mod=mod -tags=netgo",
      undefined,
      "-mod=mod -tags=netgo,ttsc_typescript_7_1",
    ],
    ["-mod=mod -tags=netgo", "-v", "-v -tags=ttsc_typescript_7_1"],
  ] as const) {
    if (storedFlags === undefined) fs.rmSync(stored, { force: true });
    else fs.writeFileSync(stored, `GOFLAGS=${storedFlags}\n`);
    const input: NodeJS.ProcessEnv =
      flags === undefined ? { ...base } : { ...base, GOFLAGS: flags };
    const built = CompilerTarget.buildEnv(input, "7.1", root);
    assert.equal(
      built.GOFLAGS,
      expected,
      `buildEnv(stored ${String(storedFlags)}, ${String(flags)})`,
    );
    assert.equal(built.GOENV, stored);
    assert.equal(input.GOFLAGS, flags, "buildEnv leaves its input unchanged");
    assert.equal(CompilerTarget.ofEnv(built), "7.1");
  }
  fs.rmSync(stored, { force: true });
  for (const [flags, expected] of [
    ["-tags=ttsc_typescript_7_1", ""],
    ["-mod=mod -tags=ttsc_typescript_7_1", "-mod=mod"],
    ["-tags=netgo,ttsc_typescript_7_1,osusergo -v", "-tags=netgo,osusergo -v"],
    [
      "--tags=ttsc_typescript_7_1x -trimpath",
      "--tags=ttsc_typescript_7_1x -trimpath",
    ],
    ["", ""],
  ] as const)
    assert.equal(
      CompilerTarget.withoutTag(flags),
      expected,
      `withoutTag(${flags})`,
    );
  assert.equal(
    CompilerTarget.withoutTag(
      CompilerTarget.buildEnv(
        { ...base, GOFLAGS: "-mod=mod -tags=netgo" },
        "7.1",
        root,
      ).GOFLAGS!,
    ),
    "-mod=mod -tags=netgo",
    "withoutTag inverts buildEnv",
  );
  assert.equal(CompilerTarget.ofEnv({ GOFLAGS: "-tags=netgo" }), "7.0");
  assert.equal(
    CompilerTarget.ofEnv({ GOFLAGS: "-ldflags=-X=a=ttsc_typescript_7_1" }),
    "7.0",
  );
}
