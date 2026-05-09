package ttsc_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerConfigFileDiscovery verifies the utility host can discover
// and load JavaScript banner config files beside the project tsconfig.
//
// 1. Create a project with `banner.config.cjs` and no inline banner text.
// 2. Run the utility transform entrypoint with the banner plugin.
// 3. Assert the discovered config text is injected into transformed source.
func TestUtilityBannerConfigFileDiscovery(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: using a config file covers the loader path that is skipped
	// when callers provide inline `text` in plugin config.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
	writeProjectFile(t, root, "banner.config.cjs", `module.exports = () => ({ text: "Discovered Banner" });
`)

	// Discovery assertion: the plugin config intentionally omits both `text` and
	// `config`, so resolution must walk from the tsconfig directory.
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
	if !strings.Contains(transformed.TypeScript["index.ts"], "Discovered Banner") {
		t.Fatalf("discovered banner was not injected: %#v", transformed.TypeScript)
	}
}
