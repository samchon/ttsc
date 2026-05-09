package ttsc_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerTypeScriptConfigFile verifies the banner loader can execute
// TypeScript config files through the ttsx runtime path.
//
// 1. Create a project with `banner.config.ts` exporting an async default.
// 2. Point the loader at the local ttsx launcher and tsgo binary.
// 3. Assert the TypeScript config value reaches transformed source text.
func TestUtilityBannerTypeScriptConfigFile(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: TypeScript config loading is the slow path because it must
	// synthesize a loader project, compile it with ttsx, then parse stdout JSON.
	rootPackage := packageRoot(t)
	tsgo := filepath.Join(rootPackage, "node_modules", ".bin", "tsgo")
	if _, err := os.Stat(tsgo); err != nil {
		t.Skip("local tsgo binary is required for TypeScript banner config loading")
	}
	if err := os.Mkdir(filepath.Join(root, "node_modules"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TTSC_TTSX_BINARY", filepath.Join(rootPackage, "lib", "launcher", "ttsx.js"))
	t.Setenv("TTSC_TSGO_BINARY", tsgo)
	t.Setenv("NODE_PATH", filepath.Join(root, "existing-node-path"))

	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "esnext",
    "target": "es2022"
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
	writeProjectFile(t, root, "banner.config.ts", `export default async () => ({ text: "TypeScript Config Banner" });
`)

	// Transform assertion: plugin config omits inline text so discovery must
	// select banner.config.ts and load it through loadBannerTypeScriptConfigFile.
	code, out, errOut := captureUtilityOutput(t, func() int {
		return utility.RunTransform([]string{
			"--cwd", root,
			"--plugins-json", `[{"name":"@ttsc/banner"}]`,
		})
	})
	if code != 0 {
		t.Fatalf("RunTransform failed: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
	var transformed utilityTransformResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
		t.Fatalf("RunTransform JSON decode failed: %v\nstdout=%s\nstderr=%s", err, out, errOut)
	}
	if !strings.Contains(transformed.TypeScript["index.ts"], "TypeScript Config Banner") {
		t.Fatalf("TypeScript banner config was not injected: %#v", transformed.TypeScript)
	}
}
