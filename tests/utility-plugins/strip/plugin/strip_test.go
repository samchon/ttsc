package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestStripSidecarRemovesSourceStatementsAndLeavesDeclarations(t *testing.T) {
  root := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"declaration":true,"sourceMap":true,"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/main.ts": strings.Join([]string{
      `export interface StripBox { value: string }`,
      `const assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };`,
      `debugger;`,
      `console.log("drop");`,
      `console.debug("drop");`,
      `assert.equal(1, 1);`,
      `console.info("keep");`,
      `export const box: StripBox = { value: "keep" };`,
      ``,
    }, "\n"),
  })
  manifest := mustJSON(t, []map[string]any{{
    "name":  "@ttsc/strip",
    "stage": "transform",
    "config": map[string]any{
      "transform":  "@ttsc/strip",
      "calls":      []any{"console.log", "console.debug", "assert.*"},
      "statements": []any{"debugger"},
    },
  }})

  status := run([]string{"build", "--cwd=" + root, "--tsconfig=" + filepath.Join(root, "tsconfig.json"), "--plugins-json=" + manifest, "--emit", "--quiet"})
  if status != 0 {
    t.Fatalf("build status=%d", status)
  }

  js := readFile(t, filepath.Join(root, "dist", "main.js"))
  for _, dropped := range []string{"debugger", "console.log", "console.debug", "assert.equal"} {
    if strings.Contains(js, dropped) {
      t.Fatalf("expected %q to be stripped from:\n%s", dropped, js)
    }
  }
  if !strings.Contains(js, `console.info("keep")`) {
    t.Fatalf("kept call missing:\n%s", js)
  }
  dts := readFile(t, filepath.Join(root, "dist", "main.d.ts"))
  if !strings.Contains(dts, "interface StripBox") || !strings.Contains(dts, "box: StripBox") {
    t.Fatalf("declaration output was damaged:\n%s", dts)
  }
  assertJSONMap(t, filepath.Join(root, "dist", "main.js.map"))
}

func TestStripSidecarRejectsOutputCommand(t *testing.T) {
  if status := run([]string{"output"}); status == 0 {
    t.Fatal("output command must not be accepted")
  }
}

func seedProject(t *testing.T, files map[string]string) string {
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

func mustJSON(t *testing.T, value any) string {
  t.Helper()
  data, err := json.Marshal(value)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

func readFile(t *testing.T, file string) string {
  t.Helper()
  data, err := os.ReadFile(file)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

func assertJSONMap(t *testing.T, file string) {
  t.Helper()
  var out map[string]any
  if err := json.Unmarshal([]byte(readFile(t, file)), &out); err != nil {
    t.Fatalf("%s is not JSON: %v", file, err)
  }
  if out["version"] != float64(3) {
    t.Fatalf("%s version=%v", file, out["version"])
  }
}
