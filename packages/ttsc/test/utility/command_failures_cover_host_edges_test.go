package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type utilityApplyErrorPlugin struct{}

func (utilityApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errUtilityApplyBoom
}

var errUtilityApplyBoom = &utilityApplyError{}

type utilityApplyError struct{}

func (*utilityApplyError) Error() string { return "utility apply boom" }

// TestUtilityCommandFailuresCoverHostEdges verifies utility host failure
// edges stay command-shaped across all error categories.
//
// The generic utility sidecar owns all linked transform packages, so parse,
// config, plugin, and emit failures must consistently return command status
// codes instead of panicking or leaking partial output to callers.
//
// 1. Exercise malformed flags, manifests, cwd, and project config failures.
// 2. Exercise linked-plugin application failure through RunCheck and RunBuild.
// 3. Exercise disk emit failure through a blocked outDir path.
func TestUtilityCommandFailuresCoverHostEdges(t *testing.T) {
  code, _, _ := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{"--cwd"})
  })
  if code != 2 {
    t.Fatalf("RunCheck bad flag status mismatch: %d", code)
  }
  code, _, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{"--plugins-json", "{"})
  })
  if code != 2 || !strings.Contains(errOut, "invalid --plugins-json") {
    t.Fatalf("build invalid manifest mismatch: code=%d stderr=%q", code, errOut)
  }
  code, _, _ = captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{"--cwd"})
  })
  if code != 2 {
    t.Fatalf("RunTransform bad flag status mismatch: %d", code)
  }
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{"--plugins-json", "{"})
  })
  if code != 2 || !strings.Contains(errOut, "invalid --plugins-json") {
    t.Fatalf("invalid manifest mismatch: code=%d stderr=%q", code, errOut)
  }

  root := t.TempDir()
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{"--cwd", root, "--tsconfig", "missing.json"})
  })
  if code != 2 || !strings.Contains(errOut, "tsconfig not found") {
    t.Fatalf("missing config mismatch: code=%d stderr=%q", code, errOut)
  }

  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "not-a-module-kind", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{"--cwd", root})
  })
  if code != 2 || !strings.Contains(errOut, "not-a-module-kind") {
    t.Fatalf("invalid config mismatch: code=%d stderr=%q", code, errOut)
  }

  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin" },
  "files": ["index.ts"]
}
`)
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(utilityApplyErrorPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"error","stage":"transform","config":{}}]`)
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"error","stage":"transform","config":{}}]`,
    })
  })
  if code != 2 || !strings.Contains(errOut, "utility apply boom") {
    t.Fatalf("apply error mismatch: code=%d stderr=%q", code, errOut)
  }
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"error","stage":"transform","config":{}}]`,
    })
  })
  if code != 2 || !strings.Contains(errOut, "utility apply boom") {
    t.Fatalf("transform apply error mismatch: code=%d stderr=%q", code, errOut)
  }
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--plugins-json", `[{"name":"error","stage":"transform","config":{}}]`,
    })
  })
  if code != 3 || !strings.Contains(errOut, "emit failed") || !strings.Contains(errOut, "utility apply boom") {
    t.Fatalf("apply emit error mismatch: code=%d stderr=%q", code, errOut)
  }
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, "")

  writeProjectFile(t, root, "blocked", "not a directory")
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--outDir", "blocked",
    })
  })
  if code != 2 || !strings.Contains(errOut, "not a directory") {
    t.Fatalf("emit failure mismatch: code=%d stderr=%q", code, errOut)
  }

  previous, err := os.Getwd()
  if err != nil {
    t.Fatal(err)
  }
  deleted := t.TempDir()
  if err := os.Chdir(deleted); err != nil {
    t.Fatal(err)
  }
  if err := os.Remove(deleted); err != nil {
    t.Fatal(err)
  }
  defer os.Chdir(previous)
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunCheck(nil)
  })
  if code != 2 || !strings.Contains(errOut, "cwd") {
    t.Fatalf("deleted cwd mismatch: code=%d stderr=%q", code, errOut)
  }
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{"--cwd", filepath.Base(root)})
  })
  if code != 2 || !strings.Contains(errOut, "cwd") {
    t.Fatalf("relative cwd mismatch: code=%d stderr=%q", code, errOut)
  }

  relativeParent := t.TempDir()
  relativeProject := filepath.Join(relativeParent, "project")
  writeProjectFile(t, relativeProject, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, relativeProject, "index.ts", `export const value = 1;
`)
  if err := os.Chdir(relativeParent); err != nil {
    t.Fatal(err)
  }
  code, _, errOut = captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{"--cwd", "project"})
  })
  if code != 0 || errOut != "" {
    t.Fatalf("relative cwd success mismatch: code=%d stderr=%q", code, errOut)
  }
}
