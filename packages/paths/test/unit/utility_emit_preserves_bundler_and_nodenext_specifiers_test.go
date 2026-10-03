package paths_test

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "regexp"
  "testing"

  _ "github.com/samchon/ttsc/packages/paths/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestUtilityEmitPreservesBundlerAndNodeNextSpecifiers verifies actual compiler
// emission of the original alias, JavaScript-extension and JSON input matrix.
//
// Output prediction alone cannot establish that the paths visitor's serialized
// specifier names a real copied compiler output. The actual registered plugin
// and utility emitter run in this Go process; no consumer installation, native
// artifact build, product subprocess or alternate printer is involved.
//
// 1. Seed the preserved Bundler and NodeNext authored projects in separate temporary roots.
// 2. Emit each configuration through RunBuildWithIO and the actual paths plugin.
// 3. Independently compare every original output spelling, alias absence and copied-file boundary.
//
// @evidence contracts/testing.md#behavioral-verification RunBuildWithIO loads the compiler Program, dispatches the actual paths plugin and writes real JavaScript, declarations and copied JSON. Literal regex checks distinguish all original import, export, import-type, dynamic import, require and extension results; actual file reads distinguish emission from prediction.
// @evidence contracts/testing.md#independent-expectations The original authored paths table and TypeScript Bundler/NodeNext output-extension contract determine the literal relative specifiers and JSON attribute. Regexes and required/absent files reproduce the original E2E expectations, not a paths helper's computed output.
// @evidence contracts/testing.md#distinguishing-cases Bundler retains exact/wildcard/directory mapping and four JavaScript extensions; NodeNext retains .mts/.cts and JSON outcomes with no invented JSON .js sibling. Independent subtests run both conflicting compiler configurations and collect every output contrast after each emit prerequisite succeeds.
// @evidence contracts/testing.md#execution-ownership The named Go unit is discovered under packages/paths/test/unit. Each of two incompatible module-resolution configurations owns one in-process Program, closed by RunBuildWithIO, and one t.TempDir; only the paths registration is linked and no registry reset or subprocess is used. Installed descriptor assembly and Node/ttsx runtime remain separate E2E boundaries.
func TestUtilityEmitPreservesBundlerAndNodeNextSpecifiers(t *testing.T) {
  data, err := os.ReadFile("../testdata/utility-emit-matrix.json")
  if err != nil {
    t.Fatal(err)
  }
  var matrix map[string]map[string]string
  if err := json.Unmarshal(data, &matrix); err != nil {
    t.Fatal(err)
  }
  for _, mode := range []string{"es-bundler", "nodenext"} {
    t.Run(mode, func(t *testing.T) {
      files, ok := matrix[mode]
      if !ok {
        t.Fatal("authored compiler input matrix is unavailable")
      }
      root := shared.SeedProject(t, files)
      var stdout, stderr bytes.Buffer
      status := utility.RunBuildWithIO([]string{"--cwd", root, "--emit", "--plugins-json", `[{"name":"@ttsc/paths","stage":"transform","config":{"transform":"@ttsc/paths"}}]`}, &stdout, &stderr)
      if status != 0 {
        t.Fatalf("actual compiler emit failed: status=%d stdout=%s stderr=%s", status, stdout.String(), stderr.String())
      }
      check := func(file string, includes, excludes []string) {
        t.Run(file, func(t *testing.T) {
          output, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(file)))
          if err != nil {
            t.Fatal(err)
          }
          for _, pattern := range includes {
            if !regexp.MustCompile(pattern).Match(output) {
              t.Errorf("missing %q in actual output:\n%s", pattern, output)
            }
          }
          for _, pattern := range excludes {
            if regexp.MustCompile(pattern).Match(output) {
              t.Errorf("unexpected %q in actual output:\n%s", pattern, output)
            }
          }
        })
      }
      exists := func(file string) {
        t.Run(file, func(t *testing.T) {
          if _, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(file))); err != nil {
            t.Errorf("required emitted file: %v", err)
          }
        })
      }
      if mode == "es-bundler" {
        check("dist/main.js", []string{`from "\./modules/exact\.js"`, `from "\./modules/message\.js"`, `from "\./pkg/index\.js"`, `require\("\./modules/message\.js"\)`, `import\("\./modules/message\.js"\)`}, []string{`@lib/message`, `@lib/exact`, `@pkg`})
        check("dist/main.d.ts", []string{`from "\./modules/message\.js"`, `import\("\./modules/message\.js"\)`, `declare module "\./modules/message\.js"`}, []string{`@lib/message`})
        for _, file := range []string{"dist/modules/plain.js", "dist/modules/native.mjs", "dist/modules/legacy.cjs", "dist/modules/view.jsx"} {
          exists(file)
        }
        check("dist/js-targets.mjs", []string{`from "\./modules/plain\.js"`, `from "\./modules/native\.mjs"`, `from "\./modules/view\.jsx"`}, []string{`@lib/`})
        check("dist/js-require-consumer.cjs", []string{`require\("\./modules/legacy\.cjs"\)`}, []string{`@lib/legacy`})
      } else {
        check("dist/main.mjs", []string{`from "\./modules/message\.mjs"`}, []string{`@lib/message`})
        check("dist/require-consumer.cjs", []string{`require\("\./modules/constant\.cjs"\)`}, []string{`@lib/constant`})
        check("dist/main.d.mts", []string{`import\("\./modules/message\.mjs"\)`}, []string{`@lib/message`})
        check("dist/json-main.mjs", []string{`from "\./data\.json"`, `type: "json"`}, []string{`\./data\.js["']`, `@data`})
        exists("dist/data.json")
        check("dist/json-main.d.mts", nil, []string{`data\.js"`})
        t.Run("no_invented_json_sibling", func(t *testing.T) {
          if _, err := os.Stat(filepath.Join(root, "dist", "data.js")); !os.IsNotExist(err) {
            t.Errorf("unexpected JSON .js sibling or observation failure: %v", err)
          }
        })
      }
    })
  }
}
