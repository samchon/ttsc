package driver_test

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
  "github.com/microsoft/typescript-go/shim/core"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestParseTSConfigPreservesNativeDiagnostics verifies config parsing rejects
// incomplete JSONC and option errors without losing the native diagnostic order.
//
// A recoverable JSON AST can contain syntax diagnostics even when option
// conversion succeeds. A failed read instead returns diagnostics with no AST.
//
// 1. Parse valid, syntax-invalid, option-invalid and combined configs.
// 2. Compare the adapter's ordered diagnostics to the native parser contract.
// 3. Exercise failed reads, missing files and repaired config bytes.
//
// @evidence contracts/testing.md#behavioral-verification Calls ParseTSConfig directly and rejects partial configs, missing syntax errors, duplicate diagnostics and read-error panics.
// @evidence contracts/testing.md#independent-expectations The native parser's complete diagnostic accessor defines order and content; literal malformed inputs independently require rejection while valid JSONC requires admission.
// @evidence contracts/testing.md#distinguishing-cases Valid comments, syntax-only, option-only, combined errors, unavailable reads, missing files and byte repair distinguish each parser result shape.
// @evidence contracts/testing.md#execution-ownership One discoverable driver-unit Go entry invokes the owning adapter and upstream parser in process with temporary files and a declared VFS read boundary, without building or launching a product host.
func TestParseTSConfigPreservesNativeDiagnostics(t *testing.T) {
  root := filepath.ToSlash(t.TempDir())
  config := root + "/tsconfig.json"
  if err := os.WriteFile(filepath.FromSlash(root+"/main.ts"), []byte("export {};"), 0o644); err != nil {
    t.Fatal(err)
  }
  for _, row := range []struct {
    name, text string
    invalid    bool
  }{
    {"valid-jsonc", "{ /* comment */ \"files\": [\"main.ts\"] }", false},
    {"syntax-only", "{", true},
    {"option-only", `{"compilerOptions":{"target":"not-a-target"},"files":["main.ts"]}`, true},
    {"syntax-and-options", `{"compilerOptions":{"target":"not-a-target"},"files":["main.ts"]`, true},
    {"repaired", `{"files":["main.ts"]}`, false},
  } {
    t.Run(row.name, func(t *testing.T) {
      if err := os.WriteFile(filepath.FromSlash(config), []byte(row.text), 0o644); err != nil {
        t.Fatal(err)
      }
      fs := driver.DefaultFS()
      host := driver.DefaultHost(fs)
      native, readDiagnostics := tsoptions.GetParsedCommandLineOfConfigFile(tspath.RootedFilePathFromAbsolute(config), &core.CompilerOptions{}, nil, fs, nil)
      expected := append([]*ast.Diagnostic{}, readDiagnostics...)
      if native != nil {
        expected = append(expected, native.GetConfigFileParsingDiagnostics()...)
      }
      if (len(expected) != 0) != row.invalid {
        t.Fatalf("native oracle invalid=%v: %v", row.invalid, expected)
      }
      parsed, diagnostics, err := driver.ParseTSConfig(fs, root, "tsconfig.json", host, nil)
      if err != nil {
        t.Fatal(err)
      }
      if (parsed == nil) != row.invalid {
        t.Errorf("partial config admission: parsed nil=%v, invalid=%v", parsed == nil, row.invalid)
      }
      if len(diagnostics) != len(expected) {
        t.Errorf("diagnostics count=%d, native=%d", len(diagnostics), len(expected))
        return
      }
      for i, want := range expected {
        got := diagnostics[i]
        if got.Code != want.Code() || got.Message != want.String() {
          t.Errorf("diagnostic %d=%+v, want native code %d and message %q", i, got, want.Code(), want.String())
        }
        if file := want.File(); file != nil && got.File != file.FileName().AsString() {
          t.Errorf("diagnostic %d file=%q, want native file %q", i, got.File, file.FileName())
        }
        // Every authored config is one ASCII line, so source positions have
        // literal line 1 and one-based columns without a copied line mapper.
        if want.File() != nil && want.Pos() >= 0 {
          if got.Line != 1 || got.Column != want.Pos()+1 {
            t.Errorf("diagnostic %d location=%d:%d, want 1:%d", i, got.Line, got.Column, want.Pos()+1)
          }
        } else if got.Line != 0 || got.Column != 0 {
          t.Errorf("diagnostic %d invented location=%d:%d", i, got.Line, got.Column)
        }
      }
    })
  }
  t.Run("read-unavailable", func(t *testing.T) {
    fs := &unreadableConfigFS{FS: driver.DefaultFS(), config: config}
    defer func() {
      if caught := recover(); caught != nil {
        t.Errorf("read diagnostics caused panic: %v", caught)
      }
    }()
    parsed, diagnostics, err := driver.ParseTSConfig(fs, root, "tsconfig.json", driver.DefaultHost(fs), nil)
    if err != nil || parsed != nil || len(diagnostics) != 1 || diagnostics[0].Code != 5083 {
      t.Errorf("read failure: parsed=%v, diagnostics=%+v, err=%v", parsed, diagnostics, err)
    }
  })
  t.Run("missing", func(t *testing.T) {
    fs := driver.DefaultFS()
    parsed, diagnostics, err := driver.ParseTSConfig(fs, root, "missing.json", driver.DefaultHost(fs), nil)
    if err == nil || parsed != nil || len(diagnostics) != 0 {
      t.Errorf("missing config: parsed=%v, diagnostics=%+v, err=%v", parsed, diagnostics, err)
    }
  })
}

type unreadableConfigFS struct {
  vfs.FS
  config string
}

func (fs *unreadableConfigFS) ReadFile(path tspath.RootedFilePath) (string, bool) {
  if path.AsString() == fs.config {
    return "", false
  }
  return fs.FS.ReadFile(path)
}
