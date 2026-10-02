package banner_test

import (
  "bytes"
  "encoding/base64"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  _ "github.com/samchon/ttsc/packages/banner/driver"
  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes verifies actual
// utility compiler maps in incompatible inline and removeComments modes.
//
// The JSON banner deliberately supplies the original four authored text lines
// directly to the native plugin. Installed CJS discovery remains in the shared
// external-map boundary; these units do not evaluate CJS or start Node.
//
//  1. Copy the static original source/base/mode inputs and JSON text equivalent.
//  2. Emit both compiler modes directly with the actual banner registration.
//  3. Require the inline preamble once, then independently inspect map bounds
//     and removeComments banner absence.
//
// @evidence contracts/testing.md#behavioral-verification RunBuildWithIO loads and emits actual compiler Programs with the registered banner. Inline output contains each of the four authored text lines and package marker exactly once; embedded inline mapping and emitted JS/DTS sidecar mappings address the original source lines, while removeComments outputs omit the preamble.
// @evidence contracts/testing.md#independent-expectations The source-map v3 VLQ format, original authored source line count, minimum zero and literal banner markers define expectations. The test decoder is independent of the production source-map corrector and rejects invalid encoding rather than inventing mappings.
// @evidence contracts/testing.md#distinguishing-cases Inline base64 maps and removeComments JS/DTS maps are incompatible emit profiles; actual inline preamble presence, nonempty mapping, original-line bounds, zero anchoring and preamble absence are collected independently. A missing banner cannot satisfy the inline map checks alone. External maps, embedded source byte identity and installed CJS loading retain their original shared E2E boundary.
// @evidence contracts/testing.md#execution-ownership This owning Go unit directly calls the actual banner plugin and compiler utility in one process, with two temporary roots and Programs closed by RunBuildWithIO. Native JSON supplies identical authored banner text; no artifact producer, consumer installation or child process executes, and CJS authority is not certified here.
func TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes(t *testing.T) {
  data, err := os.ReadFile("../testdata/utility-map-matrix.json")
  if err != nil {
    t.Fatal(err)
  }
  var inputs map[string]string
  if err := json.Unmarshal(data, &inputs); err != nil {
    t.Fatal(err)
  }
  for _, mode := range []string{"inline-map", "remove-comments"} {
    t.Run(mode, func(t *testing.T) {
      root := t.TempDir()
      for name, text := range inputs {
        shared.WriteFile(t, filepath.Join(root, filepath.FromSlash(name)), text)
      }
      cwd := filepath.Join(root, mode)
      manifest, err := json.Marshal([]map[string]any{{"name": "@ttsc/banner", "stage": "transform", "config": map[string]any{"transform": "@ttsc/banner", "configFile": filepath.Join(root, "shared", "banner.config.json")}}})
      if err != nil {
        t.Fatal(err)
      }
      var stdout, stderr bytes.Buffer
      code := utility.RunBuildWithIO([]string{"--cwd", cwd, "--emit", "--plugins-json", string(manifest)}, &stdout, &stderr)
      if code != 0 {
        t.Fatalf("emit status=%d stdout=%s stderr=%s", code, stdout.String(), stderr.String())
      }
      checkMap := func(t *testing.T, raw []byte) {
        t.Helper()
        var value struct {
          Version  int    `json:"version"`
          Mappings string `json:"mappings"`
        }
        if err := json.Unmarshal(raw, &value); err != nil {
          t.Fatal(err)
        }
        if value.Version != 3 {
          t.Errorf("map version=%d, want 3", value.Version)
        }
        lines, err := decodeUtilityBannerSourceLines(value.Mappings)
        if err != nil {
          t.Fatal(err)
        }
        if len(lines) == 0 {
          t.Fatal("map contains no original source positions")
        }
        minimum := lines[0]
        count := len(strings.Split(inputs["shared/main.ts"], "\n"))
        for _, line := range lines {
          if line < minimum {
            minimum = line
          }
          if line < 0 || line >= count {
            t.Errorf("source line=%d outside [0,%d)", line, count)
          }
        }
        if minimum != 0 {
          t.Errorf("first authored source line=%d, want zero", minimum)
        }
      }
      if mode == "inline-map" {
        t.Run("inline_banner", func(t *testing.T) {
          js, err := os.ReadFile(filepath.Join(cwd, "dist", "main.js"))
          if err != nil {
            t.Fatal(err)
          }
          for _, marker := range []string{"Copyright", "MIT License", "third line", "fourth line", "@packageDocumentation"} {
            if count := strings.Count(string(js), marker); count != 1 {
              t.Errorf("inline output marker %q count=%d, want one authored banner", marker, count)
            }
          }
        })
        t.Run("inline_base64", func(t *testing.T) {
          js, err := os.ReadFile(filepath.Join(cwd, "dist", "main.js"))
          if err != nil {
            t.Fatal(err)
          }
          match := regexp.MustCompile(`sourceMappingURL=data:application/json;base64,([A-Za-z0-9+/=]+)`).FindSubmatch(js)
          if len(match) != 2 {
            t.Fatal("actual output lacks inline source map")
          }
          raw, err := base64.StdEncoding.DecodeString(string(match[1]))
          if err != nil {
            t.Fatal(err)
          }
          checkMap(t, raw)
        })
      } else {
        for _, name := range []string{"main.js", "main.d.ts"} {
          t.Run(name, func(t *testing.T) {
            output, err := os.ReadFile(filepath.Join(cwd, "dist", name))
            if err != nil {
              t.Fatal(err)
            }
            if regexp.MustCompile(`@packageDocumentation|Copyright|MIT License`).Match(output) {
              t.Errorf("removeComments left banner in %s", name)
            }
          })
          t.Run(name+".map", func(t *testing.T) {
            raw, err := os.ReadFile(filepath.Join(cwd, "dist", name+".map"))
            if err != nil {
              t.Fatal(err)
            }
            checkMap(t, raw)
          })
        }
      }
    })
  }
}

// decodeUtilityBannerSourceLines decodes the third signed VLQ field according
// to the source-map v3 format. Source-line deltas accumulate across groups;
// generated-only segments contain no source field and supply no observation.
func decodeUtilityBannerSourceLines(mappings string) ([]int, error) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  var lines []int
  sourceLine := 0
  for _, group := range strings.Split(mappings, ";") {
    for _, segment := range strings.Split(group, ",") {
      if segment == "" {
        continue
      }
      var fields []int
      value, shift := 0, uint(0)
      for _, char := range segment {
        digit := strings.IndexRune(alphabet, char)
        if digit < 0 {
          return nil, fmt.Errorf("invalid source-map digit %q", char)
        }
        if shift > 30 {
          return nil, fmt.Errorf("VLQ exceeds source-line integer range")
        }
        value |= (digit & 31) << shift
        if digit&32 != 0 {
          shift += 5
          continue
        }
        signed := value >> 1
        if value&1 != 0 {
          signed = -signed
        }
        fields = append(fields, signed)
        value = 0
        shift = 0
      }
      if shift != 0 {
        return nil, fmt.Errorf("truncated VLQ segment %q", segment)
      }
      if len(fields) != 1 && len(fields) != 4 && len(fields) != 5 {
        return nil, fmt.Errorf("invalid mapping field count %d", len(fields))
      }
      if len(fields) >= 4 {
        sourceLine += fields[2]
        lines = append(lines, sourceLine)
      }
    }
  }
  return lines, nil
}
