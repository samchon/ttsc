package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCompilerArgumentsPreserveInvocationContext verifies inherited arguments
// remain paired with their cwd through direct, resident and input-declaration
// paths. Changed response bytes must not reuse an earlier Program.
//
// 1. Distinguish inherited argv from explicit empty/null suppression.
// 2. Reuse unchanged resident state and replace it after response or cwd edits.
// 3. Publish response inputs under the selected project's own identity.
//
// @evidence contracts/testing.md#behavioral-verification Actual loadProgram, resident acquisition and project-input dispatch consume the real launcher channel; native compiler options distinguish paired cwd, explicit suppression, changed response bytes and malformed payloads.
// @evidence contracts/testing.md#independent-expectations Authored A/B paths and literal one/two output operands prescribe expected native outDir values; pointer identity distinguishes reuse from reconstruction, and native file identity checks the declared response and project root independently of lexical aliases.
// @evidence contracts/testing.md#distinguishing-cases Covers inherited response argv/base, explicit [] and null suppression, orphan cwd, malformed transport, same-length response edits, unchanged reuse and changed argument bases. Project and source identity remain B throughout.
// @evidence contracts/testing.md#execution-ownership One portable Go unit owns temporary source/response files, restored environment channels and resident/direct Programs. It invokes maintained dispatch and upstream parsing in-process without a compiler executable, mapper process, SDK installation or watcher.
func TestCompilerArgumentsPreserveInvocationContext(t *testing.T) {
  root := t.TempDir()
  a, b := filepath.Join(root, "A"), filepath.Join(root, "B")
  writeFile(t, filepath.Join(a, "args.rsp"), "--outDir one --rootDir ../B\n")
  writeFile(t, filepath.Join(b, "tsconfig.json"), `{"compilerOptions":{"outDir":"configured"},"files":["main.ts"]}`)
  writeFile(t, filepath.Join(b, "main.ts"), "export const value = 1;\n")
  seedLintRules(t, b, map[string]string{"no-var": "error"})
  t.Setenv(tsgoArgsEnv, `["@args.rsp"]`)
  t.Setenv(tsgoArgsCwdEnv, a)
  normalized := func(value string) string { return filepath.ToSlash(filepath.Clean(value)) }
  check := func(options loadProgramOptions, expected string) {
    t.Helper()
    prog, diagnostics, err := loadProgram(b, "tsconfig.json", options)
    if err != nil || len(diagnostics) != 0 || prog == nil {
      t.Fatalf("load: %v / %v", err, diagnostics)
    }
    defer prog.close()
    if normalized(string(prog.parsed.CompilerOptions().OutDir)) != normalized(expected) || prog.cwd != b || prog.findSourceFile(filepath.Join(b, "main.ts")) == nil {
      t.Fatalf("wrong argument/project context: output=%q cwd=%q", prog.parsed.CompilerOptions().OutDir, prog.cwd)
    }
  }
  check(loadProgramOptions{}, filepath.Join(a, "one"))
  check(loadProgramOptions{tsgoArgs: []string{}}, filepath.Join(b, "configured"))
  for _, raw := range []string{"[]", "null"} {
    args, err := decodeTsgoArgs(raw)
    if err != nil || args == nil {
      t.Fatalf("explicit suppression %s: %v / %v", raw, args, err)
    }
    check(loadProgramOptions{tsgoArgs: args}, filepath.Join(b, "configured"))
  }
  cache := newResidentProgramCache()
  defer cache.invalidate()
  opts := &lspCommandOptions{cwd: b, tsconfig: "tsconfig.json", pluginsJSON: lintManifest(t)}
  acquire := func() *program {
    t.Helper()
    prog, diagnostics, _, err := cache.acquire(opts, false)
    if err != nil || len(diagnostics) != 0 || prog == nil {
      t.Fatalf("resident load: %v / %v", err, diagnostics)
    }
    return prog
  }
  first := acquire()
  if acquire() != first {
    t.Fatal("unchanged arguments rebuilt the Program")
  }
  writeFile(t, filepath.Join(a, "args.rsp"), "--outDir two --rootDir ../B\n")
  second := acquire()
  if second == first || normalized(string(second.parsed.CompilerOptions().OutDir)) != normalized(filepath.Join(a, "two")) {
    t.Fatal("changed response reused stale compiler options")
  }
  if acquire() != second || len(cache.entries) != 1 {
    t.Fatal("replacement was not reused in one resident slot")
  }
  snapshot, code := computeProjectInputs(opts)
  if code != 0 {
    t.Fatalf("input declaration failed: %d", code)
  }
  selected, err := os.Stat(b)
  if err != nil {
    t.Fatal(err)
  }
  declared, err := os.Stat(filepath.FromSlash(snapshot.Root))
  if err != nil || !os.SameFile(selected, declared) {
    t.Fatalf("argument cwd replaced the declared project root: %q / %v", snapshot.Root, err)
  }
  expectedInfo, err := os.Stat(filepath.Join(a, "args.rsp"))
  if err != nil {
    t.Fatal(err)
  }
  for _, paths := range [][]string{snapshot.Files, snapshot.ReloadFiles} {
    found := false
    for _, path := range paths {
      if info, err := os.Stat(filepath.FromSlash(path)); err == nil && os.SameFile(expectedInfo, info) {
        found = true
      }
    }
    if !found {
      t.Fatalf("response file was omitted from reload declaration: %v", paths)
    }
  }
  t.Setenv(tsgoArgsEnv, `["--outDir","three"]`)
  t.Setenv(tsgoArgsCwdEnv, b)
  third := acquire()
  if third == second || normalized(string(third.parsed.CompilerOptions().OutDir)) != normalized(filepath.Join(b, "three")) {
    t.Fatal("changed argument/base reused the previous Program")
  }
  t.Setenv(tsgoArgsEnv, "null")
  check(loadProgramOptions{}, filepath.Join(b, "configured"))
  empty := acquire()
  t.Setenv(tsgoArgsCwdEnv, a)
  if acquire() != empty {
    t.Fatal("an orphan argument cwd invalidated a no-argument Program")
  }
  t.Setenv(tsgoArgsEnv, "{")
  if _, _, err := loadProgram(b, "tsconfig.json", loadProgramOptions{}); err == nil || !strings.Contains(err.Error(), tsgoArgsEnv) {
    t.Fatalf("malformed launcher transport was ignored: %v", err)
  }
}
