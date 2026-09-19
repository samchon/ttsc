package main

import (
  "encoding/json"
  "errors"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type compileRootsApplyErrorPlugin struct{}

func (compileRootsApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errors.New("compile-roots apply boom")
}

// TestCompileRootsBranches verifies compile-roots refuses every request it
// cannot compile faithfully, naming the reason, before it writes anything.
//
// The command stands in for TypeScript-Go's command line only for a build whose
// root files the launcher replaced. A request without usable roots, with a file
// list of its own, without a project, or with arguments or a config the
// compiler rejects must stop with the compiler's "outputs skipped" status
// rather than compile something else. A linked-plugin manifest left in the
// environment names plugins this binary never links, and a plugin that fails
// to apply fails the emit rather than emitting an untransformed program.
//
// 1. Exercise malformed roots, a failed cwd, a command-line file list, a missing
//    project, an unknown option, a missing and an invalid config, a stray
//    linked-plugin manifest, and a linked plugin that fails to apply.
// 2. Assert status 2 and the reason each case reports.
// 3. Assert no case wrote output.
func TestCompileRootsBranches(t *testing.T) {
  root := t.TempDir()
  writeCommandProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2022", "strict": true },
  "include": ["src"]
}
`)
  writeCommandProjectFile(t, root, "invalid/tsconfig.json", `{
  "compilerOptions": { "target": "not-a-target" },
  "include": ["src"]
}
`)
  writeCommandProjectFile(t, root, "scripts/run.ts", "export const value: number = 1;\n")
  roots, err := json.Marshal([]string{filepath.Join(root, "scripts", "run.ts")})
  if err != nil {
    t.Fatal(err)
  }
  out := t.TempDir()
  config := filepath.Join(root, "tsconfig.json")

  cases := []struct {
    name       string
    roots      string
    linked     string
    failGetwd  bool
    register   bool
    args       []string
    wantStdout string
    wantStderr string
  }{
    {name: "malformed roots", roots: "{not json", args: []string{"-p", config}, wantStderr: driver.RootFilesEnv},
    {name: "cwd failure", roots: string(roots), failGetwd: true, args: []string{"-p", config}, wantStderr: "cwd boom"},
    {name: "command-line file list", roots: string(roots), args: []string{"-p", config, "other.ts"}, wantStderr: "not the command line"},
    {name: "missing project", roots: string(roots), args: []string{"--outDir", out}, wantStderr: "(-p)"},
    {name: "unknown option", roots: string(roots), args: []string{"-p", config, "--notAnOption"}, wantStdout: "TS5023"},
    {name: "missing config", roots: string(roots), args: []string{"-p", filepath.Join(root, "missing.json")}, wantStderr: "tsconfig not found"},
    {name: "invalid config", roots: string(roots), args: []string{"-p", filepath.Join(root, "invalid")}, wantStdout: "TS6046"},
    {
      name:       "stray linked-plugin manifest",
      roots:      string(roots),
      linked:     `[{"name":"ghost","stage":"transform","config":{}}]`,
      args:       []string{"-p", config, "--rootDir", root, "--outDir", out},
      wantStderr: "no linked plugin registered",
    },
    {
      name:       "linked plugin fails to apply",
      roots:      string(roots),
      linked:     `[{"name":"error","stage":"transform","config":{}}]`,
      register:   true,
      args:       []string{"-p", config, "--rootDir", root, "--outDir", out},
      wantStderr: "compile-roots apply boom",
    },
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      t.Setenv(driver.RootFilesEnv, c.roots)
      t.Setenv(driver.LinkedPluginsEnv, c.linked)
      resetCommandLinkedPluginRegistry()
      t.Cleanup(resetCommandLinkedPluginRegistry)
      if c.register {
        driver.RegisterPlugin(compileRootsApplyErrorPlugin{})
      }
      code, stdoutText, stderrText := captureCommand(t, func() int {
        if c.failGetwd {
          getwd = failGetwd
        }
        return run(append([]string{"compile-roots"}, c.args...))
      })
      if code != exitStatusDiagnosticsPresentOutputsSkipped {
        t.Fatalf("code=%d, want %d: stdout=%q stderr=%q", code, exitStatusDiagnosticsPresentOutputsSkipped, stdoutText, stderrText)
      }
      if c.wantStdout != "" && !strings.Contains(stdoutText, c.wantStdout) {
        t.Fatalf("stdout does not name %q: %q", c.wantStdout, stdoutText)
      }
      if c.wantStderr != "" && !strings.Contains(stderrText, c.wantStderr) {
        t.Fatalf("stderr does not name %q: %q", c.wantStderr, stderrText)
      }
    })
  }
  if matches, _ := filepath.Glob(filepath.Join(out, "*")); len(matches) != 0 {
    t.Fatalf("a refused request wrote output: %v", matches)
  }
}
