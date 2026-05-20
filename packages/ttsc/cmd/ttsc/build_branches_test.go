package main

import (
  "errors"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type buildApplyErrorPlugin struct{}

func (buildApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errors.New("build apply boom")
}

// TestBuildBranches verifies build command branches report setup, emit, and manifest failures.
//
// The native build command is the fallback compiler host behind ttsc. It must
// fail before writing partial output when flags, cwd, tsconfig, disk emit, or
// manifest paths are invalid.
//
// 1. Exercise bad flags, cwd failure, and project-load failures.
// 2. Force emit through an invalid outDir.
// 3. Force manifest mkdir and write failures after a valid emit.
func TestBuildBranches(t *testing.T) {
  code, _, _ := captureCommand(t, func() int {
    return runBuild([]string{"--cwd"})
  })
  if code != 2 {
    t.Fatalf("bad flag status mismatch: %d", code)
  }
  code, _, errText := captureCommand(t, func() int {
    getwd = failGetwd
    return runBuild(nil)
  })
  if code != 2 || !strings.Contains(errText, "cwd boom") {
    t.Fatalf("cwd error mismatch: code=%d stderr=%q", code, errText)
  }
  root := t.TempDir()
  code, _, errText = captureCommand(t, func() int {
    return runBuild([]string{"--cwd", root, "--tsconfig", "missing.json"})
  })
  if code != 2 || !strings.Contains(errText, "tsconfig not found") {
    t.Fatalf("missing config mismatch: code=%d stderr=%q", code, errText)
  }

  writeCommandProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["index.ts"]
}
`)
  writeCommandProjectFile(t, root, "index.ts", `const value: number = "text";
export { value };
`)
  code, _, errText = captureCommand(t, func() int {
    return runBuild([]string{"--cwd", root, "--tsconfig", "tsconfig.json"})
  })
  if code != 2 || !strings.Contains(errText, "number") {
    t.Fatalf("semantic diagnostics mismatch: code=%d stderr=%q", code, errText)
  }

  writeCommandProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "not-a-module-kind", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  code, _, errText = captureCommand(t, func() int {
    return runBuild([]string{"--cwd", root, "--tsconfig", "tsconfig.json"})
  })
  if code != 2 || !strings.Contains(errText, "not-a-module-kind") {
    t.Fatalf("invalid config mismatch: code=%d stderr=%q", code, errText)
  }

  writeCommandProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["index.ts"]
}
`)
  writeCommandProjectFile(t, root, "index.ts", `export const value = 1;
`)
  writeCommandProjectFile(t, root, "blocked", `not a directory`)
  code, _, errText = captureCommand(t, func() int {
    return runBuild([]string{"--cwd", root, "--tsconfig", "tsconfig.json", "--emit", "--outDir", "blocked"})
  })
  if code != 2 || !strings.Contains(errText, "not a directory") {
    t.Fatalf("emit failure mismatch: code=%d stderr=%q", code, errText)
  }

  resetCommandLinkedPluginRegistry()
  driver.RegisterPlugin(buildApplyErrorPlugin{})
  t.Cleanup(resetCommandLinkedPluginRegistry)
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"error","stage":"transform","config":{}}]`)
  code, _, errText = captureCommand(t, func() int {
    return runBuild([]string{"--cwd", root, "--tsconfig", "tsconfig.json", "--emit", "--outDir", "dist"})
  })
  if code != 3 || !strings.Contains(errText, "build apply boom") {
    t.Fatalf("linked apply failure mismatch: code=%d stderr=%q", code, errText)
  }
  resetCommandLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, "")

  code, _, errText = captureCommand(t, func() int {
    return runBuild([]string{
      "--cwd", root,
      "--tsconfig", "tsconfig.json",
      "--emit",
      "--outDir", "dist",
      "--manifest", filepath.Join(root, "index.ts", "manifest.json"),
    })
  })
  if code != 3 || !strings.Contains(errText, "manifest mkdir failed") {
    t.Fatalf("manifest mkdir mismatch: code=%d stderr=%q", code, errText)
  }
  code, _, errText = captureCommand(t, func() int {
    return runBuild([]string{
      "--cwd", root,
      "--tsconfig", "tsconfig.json",
      "--emit",
      "--outDir", "dist",
      "--manifest", root,
    })
  })
  if code != 3 || !strings.Contains(errText, "manifest write failed") {
    t.Fatalf("manifest write mismatch: code=%d stderr=%q", code, errText)
  }
}
