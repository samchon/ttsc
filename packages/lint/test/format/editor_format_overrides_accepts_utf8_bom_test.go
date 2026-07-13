package linthost

import (
  "os"
  "path/filepath"
  "reflect"
  "testing"
)

// TestEditorFormatOverridesAcceptsUTF8BOM verifies VS Code formatter settings
// saved with a leading UTF-8 BOM retain the same JSONC and formatting behavior
// as settings saved without one.
//
// The loader previously passed the BOM through to encoding/json, which silently
// discarded every editor override. These cases pin the document boundary,
// malformed-input fallback, ancestor discovery, and command-level output.
//
//  1. Load BOM-prefixed JSONC and boundary cases through the real ancestor walk.
//  2. Compare valid BOM and no-BOM settings while preserving an embedded BOM.
//  3. Run the format command and assert the editor indentation reaches the file.
func TestEditorFormatOverridesAcceptsUTF8BOM(t *testing.T) {
  bom := []byte{0xEF, 0xBB, 0xBF}
  writeSettings := func(t *testing.T, root string, body []byte) {
    t.Helper()
    location := filepath.Join(root, ".vscode", "settings.json")
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      t.Fatalf("mkdir .vscode: %v", err)
    }
    if err := os.WriteFile(location, body, 0o644); err != nil {
      t.Fatalf("write settings: %v", err)
    }
  }
  withBOM := func(body string) []byte {
    return append(append([]byte{}, bom...), []byte(body)...)
  }

  t.Run("JSONC from nearest ancestor", func(t *testing.T) {
    root := t.TempDir()
    nested := filepath.Join(root, "packages", "app", "src")
    if err := os.MkdirAll(nested, 0o755); err != nil {
      t.Fatalf("mkdir nested source: %v", err)
    }
    writeSettings(t, root, withBOM(`{
  // VS Code permits comments and trailing commas.
  "editor.tabSize": 4,
  "editor.insertSpaces": false,
  "files.eol": "\r\n",
}`))

    got := editorFormatOverrides(nested, "typescript")
    want := map[string]any{
      "tabWidth":  float64(4),
      "useTabs":   true,
      "endOfLine": "crlf",
    }
    if !reflect.DeepEqual(got, want) {
      t.Fatalf("BOM JSONC overrides mismatch: want %#v, got %#v", want, got)
    }
  })

  t.Run("minimal and no-BOM parity", func(t *testing.T) {
    minimalRoot := t.TempDir()
    writeSettings(t, minimalRoot, withBOM(`{}`))
    minimal, ok := loadNearestVSCodeSettings(minimalRoot)
    if !ok || len(minimal.values) != 0 || len(minimal.languageSections) != 0 {
      t.Fatalf("BOM minimal object: want empty parsed object, got %#v, ok=%v", minimal, ok)
    }

    text := `{"editor.tabSize":3,"editor.insertSpaces":true}`
    bomRoot := t.TempDir()
    plainRoot := t.TempDir()
    writeSettings(t, bomRoot, withBOM(text))
    writeSettings(t, plainRoot, []byte(text))
    bomOverrides := editorFormatOverrides(bomRoot, "typescript")
    plainOverrides := editorFormatOverrides(plainRoot, "typescript")
    if !reflect.DeepEqual(bomOverrides, plainOverrides) {
      t.Fatalf("BOM parity mismatch: BOM %#v, plain %#v", bomOverrides, plainOverrides)
    }
  })

  t.Run("embedded BOM remains data", func(t *testing.T) {
    root := t.TempDir()
    body := withBOM(`{"marker":"`)
    body = append(body, bom...)
    body = append(body, []byte(`"}`)...)
    writeSettings(t, root, body)

    settings, ok := loadNearestVSCodeSettings(root)
    if !ok {
      t.Fatal("settings with an embedded BOM should parse")
    }
    if got := settings.values["marker"]; got != "\uFEFF" {
      t.Fatalf("embedded BOM: want %q, got %#v", "\uFEFF", got)
    }
  })

  t.Run("malformed input still falls back", func(t *testing.T) {
    for name, body := range map[string][]byte{
      "BOM only":       append([]byte{}, bom...),
      "malformed JSONC": withBOM(`{"editor.tabSize":}`),
    } {
      t.Run(name, func(t *testing.T) {
        root := t.TempDir()
        writeSettings(t, root, body)
        if settings, ok := loadNearestVSCodeSettings(root); ok ||
          settings.values != nil || len(settings.languageSections) != 0 {
          t.Fatalf("malformed settings: want nil, false; got %#v, %v", settings, ok)
        }
        if got := editorFormatOverrides(root, "typescript"); len(got) != 0 {
          t.Fatalf("malformed settings should fall back to defaults, got %#v", got)
        }
      })
    }
  })

  t.Run("format command uses BOM settings", func(t *testing.T) {
    root := seedLintProject(t, "function f() {\nreturn 1;\n}\n")
    writeSettings(t, root, withBOM(`{
  // Exercise the same JSONC boundary through the command front door.
  "editor.tabSize": 4,
  "editor.insertSpaces": true,
}`))

    code, stdout, stderr := captureCommandOutput(t, func() int {
      return run([]string{
        "format",
        "--cwd", root,
        "--plugins-json", lintManifest(t),
      })
    })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
    }
    output, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
    if err != nil {
      t.Fatalf("read formatted source: %v", err)
    }
    want := "function f() {\n    return 1;\n}\n"
    if string(output) != want {
      t.Fatalf("formatted output mismatch:\nwant %q\ngot  %q", want, string(output))
    }
  })
}
