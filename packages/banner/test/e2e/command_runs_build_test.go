//go:build e2e

package banner_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsBuild verifies the banner sidecar emits project outputs through build.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// Build is the broadest utility-host branch because it writes the compiler output tree. The
// fixture includes declaration emit so the test covers both runtime JavaScript banner placement
// and package-documentation placement in .d.ts output.
//
// 1. Create a declaration-emitting TypeScript project.
// 2. Execute build with --emit and a concrete plugin manifest.
// 3. Assert both JavaScript and declaration outputs contain the configured banner.
//
// @evidence contracts/testing.md#behavioral-verification A strict declaration-emitting project passes build --emit --quiet with a CJS banner config; status and both streams are zero/empty, emitted JS contains the authored banner and main.d.ts starts with it.
// @evidence contracts/testing.md#independent-expectations The fixture banner text and manually specified JSDoc separator/packageDocumentation prefix establish the expectation. bannerPrefix constructs that literal format, so this is not an independent banner renderer.
// @evidence contracts/testing.md#distinguishing-cases This case owns actual JS and declaration publication; contains for JS permits placement after use strict while prefix on declarations pins leading package documentation.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsBuild entry runs in the banner E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The native banner registration, project compiler and emit callbacks must place configured text in actual output files. Direct banner rendering cannot detect lost JS/declaration publication.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one build process over one freshly seeded project from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedProject writes the fixture project under t.TempDir, which the test framework removes at cleanup; the single build process exits before dist/main.js and dist/main.d.ts are read. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stream check and both emitted-output checks are made in this body; no assertion is delegated to a unit test or helper.
func TestCommandRunsBuild(t *testing.T) {
  // Scenario setup: declaration output is included because the banner plugin
  // promises package-documentation JSDoc for both runtime and .d.ts files.
  root := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"declaration":true,"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/main.ts":   `export interface Box { value: string }` + "\n" + `export const box: Box = { value: "ok" };` + "\n",
  })

  // Build assertion: --quiet keeps stdout empty while the real output contract
  // is the files written under outDir.
  code, stdout, stderr := runPlugin(t, "build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+bannerManifest(t, root, "build banner"), "--emit", "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("build branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  js := readFile(t, filepath.Join(root, "dist", "main.js"))
  dts := readFile(t, filepath.Join(root, "dist", "main.d.ts"))
  // Output assertion: JS can contain the banner after "use strict", while .d.ts
  // should start with it as package documentation.
  if !strings.Contains(js, bannerPrefix("build banner")) || !strings.HasPrefix(dts, bannerPrefix("build banner")) {
    t.Fatalf("build output missing banner:\nJS:\n%s\nDTS:\n%s", js, dts)
  }
}
