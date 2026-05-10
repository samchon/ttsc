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
func TestCommandRunsBuild(t *testing.T) {
	// Scenario setup: declaration output is included because the banner plugin
	// promises package-documentation JSDoc for both runtime and .d.ts files.
	root := seedProject(t, map[string]string{
		"tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"declaration":true,"outDir":"dist","rootDir":"src"},"include":["src"]}`,
		"src/main.ts":   `export interface Box { value: string }` + "\n" + `export const box: Box = { value: "ok" };` + "\n",
	})

	// Build assertion: --quiet keeps stdout empty while the real output contract
	// is the files written under outDir.
	code, stdout, stderr := runPlugin(t, "build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+bannerManifest(t, "build banner"), "--emit", "--quiet")
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
