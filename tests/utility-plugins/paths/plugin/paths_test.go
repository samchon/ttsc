package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestPathsSidecarRewritesSourceAndDeclarationSpecifiers(t *testing.T) {
  root := seedProject(t, map[string]string{
    "tsconfig.json":          `{"compilerOptions":{"target":"ES2022","module":"ES2022","strict":true,"declaration":true,"declarationMap":true,"sourceMap":true,"paths":{"@lib/*":["./src/modules/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/modules/message.ts": `export interface MessageBox { value: string }` + "\n" + `export const message = "ok";` + "\n",
    "src/main.ts": strings.Join([]string{
      `declare const require: (id: string) => unknown;`,
      `import { message } from "@lib/message";`,
      `export type Imported = import("@lib/message").MessageBox;`,
      `export { message } from "@lib/message";`,
      `export const loaded = require("@lib/message");`,
      `export const value = message;`,
      `declare module "@lib/message" {`,
      `  export const augmented: string;`,
      `}`,
      ``,
    }, "\n"),
  })
  manifest := mustJSON(t, []map[string]any{{
    "name":   "@ttsc/paths",
    "stage":  "transform",
    "config": map[string]any{"transform": "@ttsc/paths"},
  }})

  status := run([]string{"build", "--cwd=" + root, "--tsconfig=" + filepath.Join(root, "tsconfig.json"), "--plugins-json=" + manifest, "--emit", "--quiet"})
  if status != 0 {
    t.Fatalf("build status=%d", status)
  }

  js := readFile(t, filepath.Join(root, "dist", "main.js"))
  dts := readFile(t, filepath.Join(root, "dist", "main.d.ts"))
  if !strings.Contains(js, `from "./modules/message.js"`) {
    t.Fatalf("JS specifier was not rewritten:\n%s", js)
  }
  if !strings.Contains(js, `require("./modules/message.js")`) {
    t.Fatalf("JS require specifier was not rewritten:\n%s", js)
  }
  if !strings.Contains(dts, `import("./modules/message.js")`) || !strings.Contains(dts, `from "./modules/message.js"`) || !strings.Contains(dts, `declare module "./modules/message.js"`) {
    t.Fatalf("declaration specifier was not rewritten:\n%s", dts)
  }
  if strings.Contains(js, "@lib/message") || strings.Contains(dts, "@lib/message") {
    t.Fatalf("alias leaked into outputs:\nJS:\n%s\nDTS:\n%s", js, dts)
  }
  assertJSONMap(t, filepath.Join(root, "dist", "main.js.map"))
  assertJSONMap(t, filepath.Join(root, "dist", "main.d.ts.map"))
}

func TestPathsSidecarRejectsOutputCommand(t *testing.T) {
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
