package ttsc_test

import (
  "path/filepath"
  "testing"
)

// TestUtilityFindBannerConfigFileUsesTsconfigDirectoryWhenOutsideCwd verifies
// config discovery starts from the selected tsconfig location.
//
// Wrapper projects can pass a tsconfig outside the current working directory.
// Banner discovery must follow that selected project file rather than falling
// back to the process cwd and loading the wrong sibling config.
//
// This scenario covers the discovery helper directly because the selected base
// directory is the behavior under test. Public command tests cover the same
// helper after plugin manifest parsing.
//
// 1. Seed separate cwd and wrapper directories with different banner configs.
// 2. Discover the banner config using the wrapper tsconfig path.
// 3. Assert the wrapper-side config wins over the cwd-side config.
func TestUtilityFindBannerConfigFileUsesTsconfigDirectoryWhenOutsideCwd(t *testing.T) {
  cwd := t.TempDir()
  writeProjectFile(t, cwd, "banner.config.cjs", `module.exports = { text: "cwd banner" };
`)
  wrapper := t.TempDir()
  writeProjectFile(t, wrapper, "banner.config.cjs", `module.exports = { text: "wrapper banner" };
`)
  writeProjectFile(t, wrapper, "tsconfig.json", "{}")

  discovered, err := utilityFindBannerConfigFile(cwd, filepath.Join(wrapper, "tsconfig.json"))
  if err != nil {
    t.Fatalf("findBannerConfigFile: %v", err)
  }
  if discovered != filepath.Join(wrapper, "banner.config.cjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
