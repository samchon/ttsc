//go:build ttsc_typescript_7_1

package driver_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestContentMapperDependenciesFollowTheUpstreamProject verifies declared
// mapper inputs survive both native dependency and graph metadata.
//
// A mapper can read a schema without changing its SQL file, so source hashes
// alone cannot authorize reuse of types that depend on its project settings.
//
//  1. Load one dynamic mapper with an external schema and require both inputs.
//  2. Change and remove the schema across fresh Programs and inspect mapped types.
//  3. Reject a malformed upstream watched-file declaration and close every load.
//
// @evidence contracts/testing.md#behavioral-verification Real LoadProgram and NewTransformGraph expose manifest/schema inputs for both the source and mapped member; fresh loads read changed or absent schema and invalid declarations produce errors. Every acquired Program is closed through cleanup and explicit closure.
// @evidence contracts/testing.md#independent-expectations Literal upstream manifest and schema paths are the expected dependency set; authored string/number text and TS2322 diagnostics distinguish mapper execution epochs independently of reported hashes.
// @evidence contracts/testing.md#distinguishing-cases Configured dynamic versus existing static and permission-disabled fixtures, changed versus absent schema, per-file completeness and malformed relative watched paths cover declaration and failure boundaries.
// @evidence contracts/testing.md#execution-ownership The Go driver runner discovers this 7.1-only entry, which loads the native compiler in-process and owns the protocol's necessary Node child and temporary project; it does not install a consumer or launch a separate compiler host.
func TestContentMapperDependenciesFollowTheUpstreamProject(t *testing.T) {
  root := writeContentMapperProject(t)
  schema := filepath.Join(root, "node_modules", "sql-mapper", "schema.txt")
  writeProjectFile(t, root, "node_modules/sql-mapper/schema.txt", "string")
  writeProjectFile(t, root, "node_modules/sql-mapper/package.json", `{"name":"sql-mapper","version":"1.0.0","typescript":{"contentMapper":{"exec":["node","./mapper.js"],"dynamicConfig":true}}}`)
  script := strings.Replace(contentMapperMapperScript,
    `return { configIdentity: "" };`,
    `return { configIdentity: "schema", watchedFiles: [require("node:path").join(__dirname, "schema.txt")] };`, 1)
  script = strings.Replace(script, `": string };\n"`, `": " + (fs.existsSync(require("node:path").join(__dirname,"schema.txt")) ? fs.readFileSync(require("node:path").join(__dirname,"schema.txt"),"utf8") : "string") + " };\n"`, 1)
  writeProjectFile(t, root, "node_modules/sql-mapper/mapper.js", script)
  options := driver.LoadProgramOptions{TsgoArgs: []string{"--runExternalCode"}}
  // Both relative and absolute fallback coordinates are valid, including a
  // native mapper resolving a short Windows ancestor to its long spelling.
  checkInputs := func(inputs []string) {
    t.Helper()
    if len(inputs) != 2 {
      t.Fatalf("mapper input count: %#v", inputs)
    }
    seen := map[string]bool{}
    for _, input := range inputs {
      actual := filepath.FromSlash(input)
      if !filepath.IsAbs(actual) {
        actual = filepath.Join(root, actual)
      }
      name := filepath.Base(actual)
      if name != "package.json" && name != "schema.txt" {
        t.Fatalf("unexpected mapper input: %s", input)
      }
      expectedParent, err := os.Stat(filepath.Dir(schema))
      if err != nil {
        t.Fatal(err)
      }
      actualParent, err := os.Stat(filepath.Dir(actual))
      if err != nil {
        t.Fatal(err)
      }
      if !os.SameFile(expectedParent, actualParent) || seen[name] {
        t.Fatalf("wrong mapper input identity: %s", input)
      }
      seen[name] = true
    }
  }
  for _, kind := range []string{"string", "number", "missing"} {
    if kind == "missing" {
      if err := os.Remove(schema); err != nil {
        t.Fatal(err)
      }
    } else {
      writeProjectFile(t, root, "node_modules/sql-mapper/schema.txt", kind)
    }
    program, diags, err := driver.LoadProgram(root, "tsconfig.json", options)
    if err != nil || program == nil || len(diags) != 0 {
      t.Fatalf("load %s: %v %#v", kind, err, diags)
    }
    t.Cleanup(func() {
      if err := program.Close(); err != nil {
        t.Error(err)
      }
    })
    graph := driver.NewTransformGraph(program, root)
    checkInputs(graph.ContentMapperInputs)
    deps := program.TransformDependenciesFor(root)
    for _, file := range []string{"index.ts", "query.sql"} {
      checkInputs(deps.Dependencies[file])
    }
    diagnostics := program.Diagnostics()
    if kind == "number" {
      found := false
      for _, diagnostic := range diagnostics {
        if diagnostic.Code == 2322 {
          found = true
        }
      }
      if !found {
        t.Fatalf("schema change did not affect the mapped type: %#v", diagnostics)
      }
    } else if driver.CountErrors(diagnostics) != 0 {
      t.Fatalf("valid schema: %#v", diagnostics)
    }
    if err := program.Close(); err != nil {
      t.Fatal(err)
    }
  }
  writeProjectFile(t, root, "node_modules/sql-mapper/mapper.js", strings.Replace(script, `require("node:path").join(__dirname, "schema.txt")`, `"relative.txt"`, 1))
  program, diags, err := driver.LoadProgram(root, "tsconfig.json", options)
  if err != nil {
    t.Fatal(err)
  }
  if program != nil {
    defer program.Close()
    diags = append(diags, program.Diagnostics()...)
  }
  if driver.CountErrors(diags) == 0 {
    t.Fatal("invalid mapper watchedFiles was accepted")
  }
}
