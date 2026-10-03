package ttsc_test

import (
  "os"
  "path/filepath"
  "runtime"
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
//
// @evidence contracts/testing.md#behavioral-verification RunCheck, RunBuild and RunTransform return command status 2 with the documented message for malformed flags, an invalid plugin manifest, a missing tsconfig and an invalid project configuration, and fail cleanly when a linked plugin fails or the output directory is blocked.
// @evidence contracts/testing.md#independent-expectations Every status code and message fragment ('invalid --plugins-json', 'tsconfig not found') is a literal from the command contract.
// @evidence contracts/testing.md#distinguishing-cases Each failure category is a separate input, so a host that panicked or returned success for one category would fail only that assertion.
// @evidence contracts/testing.md#execution-ownership TestUtilityCommandFailuresCoverHostEdges is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
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
  // The write fails because outDir is a regular file. Assert on the exit code
  // and the platform-agnostic TS5033 "Could not write file" diagnostic prefix,
  // not the OS errno, which differs by platform (POSIX ENOTDIR "not a
  // directory" vs Windows "The system cannot find the path specified").
  if code != 2 || !strings.Contains(errOut, "Could not write file") {
    t.Fatalf("emit failure mismatch: code=%d stderr=%q", code, errOut)
  }

  previous, err := os.Getwd()
  if err != nil {
    t.Fatal(err)
  }
  defer os.Chdir(previous)
  // Windows locks the cwd against deletion. Other hosts permit removal, but
  // some still return its former path from Getwd, so probe the branch the host
  // can actually take instead of assuming every POSIX Getwd reports ENOENT.
  if runtime.GOOS != "windows" {
    deleted := t.TempDir()
    if err := os.Chdir(deleted); err != nil {
      t.Fatal(err)
    }
    if err := os.Remove(deleted); err != nil {
      t.Fatal(err)
    }
    _, getwdErr := os.Getwd()
    code, _, errOut = captureUtilityOutput(t, func() int {
      return utility.RunCheck(nil)
    })
    expected := "cwd"
    if getwdErr == nil {
      expected = "tsconfig not found"
    }
    if code != 2 || !strings.Contains(errOut, expected) {
      t.Fatalf("deleted cwd mismatch: code=%d stderr=%q", code, errOut)
    }
    _, absErr := filepath.Abs(filepath.Base(root))
    code, _, errOut = captureUtilityOutput(t, func() int {
      return utility.RunCheck([]string{"--cwd", filepath.Base(root)})
    })
    expected = "cwd"
    if absErr == nil {
      expected = "tsconfig not found"
    }
    if code != 2 || !strings.Contains(errOut, expected) {
      t.Fatalf("relative cwd mismatch: code=%d stderr=%q", code, errOut)
    }
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
