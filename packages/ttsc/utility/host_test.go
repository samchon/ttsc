package utility

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindBannerConfigFileUsesTsconfigDirectoryWhenOutsideCwd(t *testing.T) {
	cwd := seedHostTestProject(t, map[string]string{
		"banner.config.cjs": `module.exports = { text: "cwd banner" };` + "\n",
	})
	wrapper := seedHostTestProject(t, map[string]string{
		"banner.config.cjs": `module.exports = { text: "wrapper banner" };` + "\n",
		"tsconfig.json":     "{}",
	})

	discovered, err := findBannerConfigFile(cwd, filepath.Join(wrapper, "tsconfig.json"))
	if err != nil {
		t.Fatalf("findBannerConfigFile: %v", err)
	}
	if discovered != filepath.Join(wrapper, "banner.config.cjs") {
		t.Fatalf("unexpected discovery path: %s", discovered)
	}
}

func seedHostTestProject(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for name, text := range files {
		file := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}
