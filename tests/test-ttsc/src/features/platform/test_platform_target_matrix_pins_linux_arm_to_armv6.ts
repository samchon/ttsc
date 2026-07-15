import { assert, fs, path, requireFromTest, workspaceRoot } from "../../internal/toolchain";

/**
 * Verifies the platform build target matrix pins linux-arm to the ARMv6 baseline.
 *
 * Locks `scripts/platform-target.cjs::resolveGoTarget` and its use in
 * `scripts/build-platform-package.cjs`. The linux-arm package bundles the
 * `linux-armv6l` Go SDK, but the executables were cross-compiled with no GOARM,
 * which the toolchain defaults to ARMv7; the SDK and executables then targeted
 * different CPU baselines. The fix forces GOARM=6 and derives the SDK archive
 * suffix from the same record so all three executables and the bundled SDK share
 * one baseline. arm64 and non-ARM targets are the negative twins that must never
 * acquire a GOARM.
 *
 * 1. Resolve the Go target for linux-arm and assert GOOS=linux, GOARCH=arm,
 *    GOARM=6, and archiveTarget=linux-armv6l.
 * 2. Resolve the negative twins (linux-arm64, linux-x64, darwin-arm64,
 *    win32-x64) and assert none carries a GOARM and each keeps its own archive.
 * 3. Read build-platform-package.cjs and assert the shared record injects GOARM
 *    into a single buildGoTarget that builds all three executables.
 */
export const test_platform_target_matrix_pins_linux_arm_to_armv6 = () => {
  const { resolveGoTarget } = requireFromTest(
    path.join(workspaceRoot, "scripts", "platform-target.cjs"),
  ) as {
    resolveGoTarget: (
      npmOs: string,
      npmArch: string,
    ) => {
      goos: string;
      goarch: string;
      goarm: string | undefined;
      archiveArch: string;
      archiveTarget: string;
    };
  };

  // Positive: the fix direction. linux-arm must build ARMv6 executables to match
  // its bundled linux-armv6l SDK.
  const arm = resolveGoTarget("linux", "arm");
  assert.equal(arm.goos, "linux");
  assert.equal(arm.goarch, "arm");
  assert.equal(arm.goarm, "6");
  assert.equal(arm.archiveArch, "armv6l");
  assert.equal(arm.archiveTarget, "linux-armv6l");

  // Negative twins: every other target must resolve without a GOARM, and its
  // archive suffix must stay on its own architecture (never armv6l).
  const arm64 = resolveGoTarget("linux", "arm64");
  assert.equal(arm64.goarch, "arm64");
  assert.equal(arm64.goarm, undefined);
  assert.equal(arm64.archiveTarget, "linux-arm64");

  const x64 = resolveGoTarget("linux", "x64");
  assert.equal(x64.goarch, "amd64");
  assert.equal(x64.goarm, undefined);
  assert.equal(x64.archiveTarget, "linux-amd64");

  const darwin = resolveGoTarget("darwin", "arm64");
  assert.equal(darwin.goos, "darwin");
  assert.equal(darwin.goarm, undefined);
  assert.equal(darwin.archiveTarget, "darwin-arm64");

  const win = resolveGoTarget("win32", "x64");
  assert.equal(win.goos, "windows");
  assert.equal(win.goarm, undefined);
  assert.equal(win.archiveTarget, "windows-amd64");

  // Structural guard: all three executables must flow through one buildGoTarget
  // that injects GOARM from the shared record, so a future edit cannot pin only
  // one binary to ARMv6 while the others drift back to the ARMv7 default.
  const scriptSource = fs.readFileSync(
    path.join(workspaceRoot, "scripts", "build-platform-package.cjs"),
    "utf8",
  );
  assert.match(scriptSource, /GOARM:\s*goarm/);
  for (const target of ["ttsc", "ttscserver", "ttscgraph"]) {
    assert.match(scriptSource, new RegExp(`buildGoTarget\\("${target}"`));
  }
};
