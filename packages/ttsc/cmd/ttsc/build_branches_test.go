package main

import (
  "errors"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// buildApplyErrorPlugin is the independently failing linked Program hook fixture.
//
// The owning branch test registers this actual implementation and declares
// one transform manifest entry. The zero-field value carries no expected
// response or compiler state; ApplyProgram owns its literal fixture error.
//
// Native private fixture grounds remain with the test; no fake public API
// or unsupported exported-host Evidence annotation is added.
// Common: Principled implementation: The actual driver registry receives this ProgramPlugin implementation for the command's real linked apply/emit failure branch.
// Common: Clear and simple design: A zero-field type supplies only the failing hook method and retains no auxiliary fixture state.
// Common: Prohibited implementation shortcuts: The test exercises a real registered hook rather than injecting a cached status or manufactured command stderr.
// Common: Meaningful documentation: Native prose identifies registration, manifest pairing and the separate literal error owner.
// Applicability: This empty carrier owns no processing algorithm, native OS boundary, reusable work or resource lease; the branch test owns registry/environment cleanup.
type buildApplyErrorPlugin struct{}

// ApplyProgram returns the literal build apply boom fixture cause.
//
// The real command's emission path invokes the registered hook. This fixture
// fails without altering its borrowed Program; the wrapper must propagate
// its independently authored cause and returned failure status.
//
// Native fixture grounds describe this actual hook, without Evidence tags.
// Common: Principled implementation: Returning the authored error exercises the actual linked hook error propagation used by the owning command test.
// Common: Clear and simple design: The fixture constructs one fixed error without inspecting or mutating the borrowed Program.
// Common: Prohibited implementation shortcuts: Neither wrapper output nor status is supplied by this fixture; assertions observe the command's own handling.
// Common: Meaningful documentation: Native prose states the exact error contribution and borrowed Program non-mutation.
// Applicability: The fixed in-process error return performs no native OS operation, processing traversal, reuse coordination or resource acquisition; its command caller owns the Program lease.
func (buildApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errors.New("build apply boom")
}

// TestBuildBranches verifies build setup, emission and manifest failures retain their status and causes.
//
// Setup and semantic failures precede emission, while manifest mkdir/write failures occur after a valid emit. The test observes the distinct returned causes and never claims that later publication failure rolls back emitted output; its writer failure uses a portable compiler diagnostic prefix.
//
// 1. Reject incomplete argv, failed cwd, missing config and invalid source/config.
// 2. Emit into a file-shaped outDir and exercise an actual failing linked hook.
// 3. Emit a valid project before forcing manifest parent-directory and file-write failures.
//
// @evidence contracts/testing.md#behavioral-verification Direct runBuild checks status two plus setup/semantic/config/write causes and status three for linked apply and manifest mkdir/write failures. It does not assert global output absence or rollback after publication errors.
// @evidence contracts/testing.md#independent-expectations Independent invalid assignment/module kind, a regular file named blocked, a literal hook error and manifest destinations rooted through index.ts or an existing directory define the failures. Could not write file is the portable TS diagnostic fragment, not an OS errno.
// @evidence contracts/testing.md#distinguishing-cases Bad flags/cwd/config, semantic mismatch, invalid module, file-shaped outDir, linked apply failure and two post-emit manifest failures preserve the existing branch matrix; positive manifest publication belongs to the aggregate family.
// @evidence contracts/testing.md#execution-ownership The owning build operation and real filesystem/compiler execute in the Go process, without a product child or build. captureCommand restores stream/getwd seams, runBuild closes actual Programs, TempDir owns artifacts and Setenv restores manifest state. The original test resets its registry for hook setup and registers a cleanup reset; that clears rather than snapshots prior registry entries.
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
  // The write fails because outDir is a regular file. Assert on the exit code
  // and the platform-agnostic TS5033 "Could not write file" diagnostic prefix,
  // not the OS errno, which differs by platform (POSIX ENOTDIR "not a
  // directory" vs Windows "The system cannot find the path specified").
  if code != 2 || !strings.Contains(errText, "Could not write file") {
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
