package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestBannerSidecarBuildsJavaScriptAndDeclarations(t *testing.T) {
  root := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"declaration":true,"declarationMap":true,"sourceMap":true,"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/main.ts":   `export interface Box { value: string }` + "\n" + `export const box: Box = { value: "ok" };` + "\n",
  })
  manifest := mustJSON(t, []map[string]any{{
    "name":  "@ttsc/banner",
    "stage": "transform",
    "config": map[string]any{
      "transform": "@ttsc/banner",
      "banner":    "unit banner",
    },
  }})

  status := run([]string{"build", "--cwd=" + root, "--tsconfig=" + filepath.Join(root, "tsconfig.json"), "--plugins-json=" + manifest, "--emit", "--quiet"})
  if status != 0 {
    t.Fatalf("build status=%d", status)
  }

  js := readFile(t, filepath.Join(root, "dist", "main.js"))
  dts := readFile(t, filepath.Join(root, "dist", "main.d.ts"))
  if !strings.Contains(js, bannerPrefix("unit banner")) {
    t.Fatalf("missing JS banner:\n%s", js)
  }
  if !strings.HasPrefix(dts, bannerPrefix("unit banner")) {
    t.Fatalf("missing declaration banner:\n%s", dts)
  }
  assertJSONMap(t, filepath.Join(root, "dist", "main.js.map"))
  assertJSONMap(t, filepath.Join(root, "dist", "main.d.ts.map"))
}

func TestBannerSidecarCheckRunsProjectDiagnostics(t *testing.T) {
  root := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/main.ts":   `export const value: string = 1;` + "\n",
  })
  manifest := mustJSON(t, []map[string]any{{
    "name":  "@ttsc/banner",
    "stage": "transform",
    "config": map[string]any{
      "transform": "@ttsc/banner",
      "banner":    "unit banner",
    },
  }})

  status := run([]string{"check", "--cwd=" + root, "--tsconfig=" + filepath.Join(root, "tsconfig.json"), "--plugins-json=" + manifest, "--quiet"})
  if status == 0 {
    t.Fatal("check must fail on project diagnostics")
  }
}

func TestBannerSidecarRejectsOutputCommand(t *testing.T) {
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

func bannerPrefix(text string) string {
  sep := strings.Repeat("-", 64)
  return "/**\n * " + sep + "\n * " + text + "\n *\n * @packageDocumentation\n */\n"
}
