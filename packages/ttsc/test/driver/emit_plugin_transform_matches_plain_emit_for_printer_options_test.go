package driver_test

import (
  "slices"
  "strings"
  "testing"
)

// printerOptionCase is one compiler-option setting and the observable property
// it must produce, checked on both emit lanes.
type printerOptionCase struct {
  name string
  // options is spliced into the fixture tsconfig's `compilerOptions`.
  options string
  source  string
  // file is the emitted artifact the witnesses below are read from.
  file string
  want []string
  deny []string
  // wantPrefix is a witness the artifact must begin with, for properties that
  // are about position rather than presence — `emitBOM`'s mark is only correct
  // as the file's first bytes.
  wantPrefix string
  // denyFiles are artifacts the option set must NOT produce.
  denyFiles []string
}

const (
  printerOptionComment   = "// TTSC_PRINTER_OPTIONS_COMMENT\nexport const a = 0;\n"
  printerOptionSeparator = "export const million = 1_000_000;\n"
  printerOptionDecorator = `function seal(target: Function): void {
  Object.seal(target);
}

@seal
export class Widget {
  public size: number = 7;
}
`
)

// TestEmitPluginTransformMatchesPlainEmitForPrinterOptions verifies that the
// plugin-transform emit lane honors every compiler option the pinned tsgo
// emitter applies while printing a file, and emits the same bytes as a plain
// build.
//
// `EmitWithPluginTransformers` hand-assembles tsgo's JavaScript emit because
// `Program.Emit` has no transformer hook, and prints through the shim's
// `PrintFileWithSourceMap`. That helper builds `printer.PrinterOptions` by hand
// from the oracle in `internal/compiler/emitter.go::emitJSFile`; every field it
// omits takes the Go zero value, so the option is silently ignored on the plugin
// lane while a plain build honors it. Three fields were missing at once
// (`removeComments` — found independently by pull request #1154 —
// `noEmitHelpers`, and `target`) because the only coverage spot-checked
// `sourceMap` alone. Comparing the two lanes per field, rather than asserting
// one lane's output in isolation, is what makes the next omission fail here: a
// wrong-but-consistent emit cannot pass, because the plain lane is the oracle.
//
// `emitBOM` belongs in the same table even though it is not a `PrinterOptions`
// field: `printSourceFile` applies it to the printed text, outside the struct,
// which is why forwarding the whole struct never reached it and why the emitted
// bytes are still the thing that proves it. Its witness is a prefix, not a
// substring — a mark anywhere but first is not a byte order mark.
//
//  1. For each option set, materialize one project and compile it twice: once
//     through `EmitAllRaw` (plain tsgo emit) and once through
//     `EmitLinkedTransforms` (the hand-assembled plugin lane, no transforms).
//  2. Assert the plugin lane carries the option's observable witness, with a
//     negative twin one property away where it must not.
//  3. Assert both lanes emitted the same artifact set with byte-identical text.
// @evidence contracts/testing.md#behavioral-verification Runs real raw and plugin-lane emits for nineteen authored option rows, checking literal required/forbidden tokens, prefixes and artifacts plus complete byte/set parity.
// @evidence contracts/testing.md#independent-expectations Literal witnesses independently specify comments, helpers, numeric separator threshold, line endings, BOM and map options; the raw native emitter separately owns compatibility of remaining bytes.
// @evidence contracts/testing.md#distinguishing-cases Positive/negative option twins and exact ES2020/ES2021 separator threshold distinguish forwarding errors; inline/external maps and BOM placement cover shared-artifact boundaries.
// @evidence contracts/testing.md#execution-ownership The owning Go unit uses actual emitter helpers with separately loaded Programs for raw/plugin lanes and local write maps, closes both Programs and invokes no native host.
func TestEmitPluginTransformMatchesPlainEmitForPrinterOptions(t *testing.T) {
  cases := []printerOptionCase{
    {
      name:    "remove_comments_strips_the_authored_comment",
      options: `"target": "es2020", "sourceMap": true, "removeComments": true`,
      source:  printerOptionComment,
      file:    "index.js",
      // The sourceMappingURL trailer is written as a printer comment after the
      // print pass, so it must survive removeComments — the one comment the
      // option is not allowed to strip.
      want: []string{"//# sourceMappingURL=index.js.map"},
      deny: []string{"TTSC_PRINTER_OPTIONS_COMMENT"},
    },
    {
      name:    "comments_survive_without_remove_comments",
      options: `"target": "es2020", "sourceMap": true`,
      source:  printerOptionComment,
      file:    "index.js",
      want:    []string{"TTSC_PRINTER_OPTIONS_COMMENT", "//# sourceMappingURL=index.js.map"},
    },
    {
      name:    "no_emit_helpers_suppresses_the_decorator_helper",
      options: `"target": "es2020", "experimentalDecorators": true, "noEmitHelpers": true`,
      source:  printerOptionDecorator,
      file:    "index.js",
      // The call site proves the construct still needs the helper; only its
      // definition is withheld, which is exactly what noEmitHelpers means.
      want: []string{"__decorate("},
      deny: []string{"var __decorate"},
    },
    {
      name:    "decorator_helper_is_emitted_without_no_emit_helpers",
      options: `"target": "es2020", "experimentalDecorators": true`,
      source:  printerOptionDecorator,
      file:    "index.js",
      want:    []string{"var __decorate"},
    },
    {
      name:    "target_es2022_preserves_a_numeric_separator",
      options: `"target": "es2022"`,
      source:  printerOptionSeparator,
      file:    "index.js",
      want:    []string{"1_000_000"},
    },
    {
      name: "target_es2021_preserves_a_numeric_separator",
      // ES2021 is the exact threshold in `getLiteralTextFlagsAllowNumericSeparator`
      // (`p.Options.Target >= core.ScriptTargetES2021`), so it is the inclusive
      // side of the boundary.
      options: `"target": "es2021"`,
      source:  printerOptionSeparator,
      file:    "index.js",
      want:    []string{"1_000_000"},
    },
    {
      name: "target_es2020_canonicalizes_a_numeric_separator",
      // One step below the threshold: the exclusive side of the same boundary.
      options: `"target": "es2020"`,
      source:  printerOptionSeparator,
      file:    "index.js",
      want:    []string{"1000000"},
      deny:    []string{"1_000_000"},
    },
    {
      name:    "target_es5_canonicalizes_a_numeric_separator",
      options: `"target": "es5"`,
      source:  printerOptionSeparator,
      file:    "index.js",
      want:    []string{"1000000"},
      deny:    []string{"1_000_000"},
    },
    {
      name:    "new_line_crlf_terminates_emitted_lines",
      options: `"target": "es2020", "newLine": "crlf"`,
      source:  printerOptionComment,
      file:    "index.js",
      want:    []string{"\r\n"},
    },
    {
      name:    "new_line_lf_terminates_emitted_lines",
      options: `"target": "es2020", "newLine": "lf"`,
      source:  printerOptionComment,
      file:    "index.js",
      deny:    []string{"\r\n"},
    },
    {
      name:      "inline_source_map_embeds_the_map_instead_of_a_map_file",
      options:   `"target": "es2020", "inlineSourceMap": true`,
      source:    printerOptionComment,
      file:      "index.js",
      want:      []string{"//# sourceMappingURL=data:application/json;base64,"},
      denyFiles: []string{"index.js.map"},
    },
    {
      name:    "inline_sources_embeds_the_source_text_in_the_map",
      options: `"target": "es2020", "sourceMap": true, "inlineSources": true`,
      source:  printerOptionComment,
      file:    "index.js.map",
      want:    []string{"sourcesContent"},
    },
    {
      name:    "external_map_omits_source_text_without_inline_sources",
      options: `"target": "es2020", "sourceMap": true`,
      source:  printerOptionComment,
      file:    "index.js.map",
      deny:    []string{"sourcesContent"},
    },
    {
      name:      "no_map_options_emit_no_source_mapping_url",
      options:   `"target": "es2020"`,
      source:    printerOptionComment,
      file:      "index.js",
      deny:      []string{"//# sourceMappingURL="},
      denyFiles: []string{"index.js.map"},
    },
    {
      name:    "emit_bom_marks_the_emitted_javascript",
      options: `"target": "es2020", "emitBOM": true`,
      source:  printerOptionComment,
      file:    "index.js",
      // The mark is the file's first bytes and nothing else moves; the authored
      // comment still follows it, so the option cannot be faked by emitting a
      // mark instead of the program.
      wantPrefix: utf8BOM,
      want:       []string{"TTSC_PRINTER_OPTIONS_COMMENT"},
    },
    {
      name:    "no_emit_bom_leaves_the_javascript_unmarked",
      options: `"target": "es2020"`,
      source:  printerOptionComment,
      file:    "index.js",
      deny:    []string{utf8BOM},
    },
    {
      name: "emit_bom_precedes_the_source_map_trailer",
      // The mark is applied after the whole printed text, trailer included, so
      // both must be present and the mark must still be first.
      options:    `"target": "es2020", "sourceMap": true, "emitBOM": true`,
      source:     printerOptionComment,
      file:       "index.js",
      wantPrefix: utf8BOM,
      want:       []string{"//# sourceMappingURL=index.js.map"},
    },
    {
      name: "emit_bom_leaves_the_external_source_map_unmarked",
      // printSourceFile writes the map through `writeText(sourceMapFilePath,
      // sourceMap, nil)` before the mark is applied to the JavaScript, so
      // `emitBOM` never reaches the `.js.map` — a mark there would also make it
      // unparseable to a strict JSON reader.
      options: `"target": "es2020", "sourceMap": true, "emitBOM": true`,
      source:  printerOptionComment,
      file:    "index.js.map",
      deny:    []string{utf8BOM},
    },
    {
      name: "emit_bom_marks_the_javascript_carrying_an_inline_map",
      // The inline map is base64 inside the JavaScript, so the mark and the map
      // share one artifact: the boundary where applying the mark to the wrong
      // string would corrupt the trailer.
      options:    `"target": "es2020", "inlineSourceMap": true, "emitBOM": true`,
      source:     printerOptionComment,
      file:       "index.js",
      wantPrefix: utf8BOM,
      want:       []string{"//# sourceMappingURL=data:application/json;base64,"},
      denyFiles:  []string{"index.js.map"},
    },
  }

  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      root := t.TempDir()
      writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "bin",
    "strict": true,
    `+testCase.options+`
  },
  "files": ["index.ts"]
}
`)
      writeProjectFile(t, root, "index.ts", testCase.source)

      plain := emitFixtureArtifacts(t, root, false)
      plugin := emitFixtureArtifacts(t, root, true)

      artifact, ok := plugin[testCase.file]
      if !ok {
        t.Fatalf("plugin lane did not emit %s; got %v", testCase.file, sortedKeys(plugin))
      }
      text := artifact.text
      if testCase.wantPrefix != "" && !strings.HasPrefix(text, testCase.wantPrefix) {
        t.Fatalf("plugin lane %s does not begin with %q; the option was not applied to the printed text:\n%q", testCase.file, testCase.wantPrefix, text)
      }
      for _, want := range testCase.want {
        if !strings.Contains(text, want) {
          t.Fatalf("plugin lane %s is missing %q; the compiler option did not reach the emitted text:\n%q", testCase.file, want, text)
        }
      }
      for _, deny := range testCase.deny {
        if strings.Contains(text, deny) {
          t.Fatalf("plugin lane %s still contains %q; the compiler option did not reach the emitted text:\n%q", testCase.file, deny, text)
        }
      }
      for _, denied := range testCase.denyFiles {
        if _, present := plugin[denied]; present {
          t.Fatalf("plugin lane emitted %s, which this option set must not produce; got %v", denied, sortedKeys(plugin))
        }
      }

      // The plain lane is the oracle: an option the hand-assembled lane drops
      // shows up here as a byte divergence even when no witness above names it.
      if got, want := sortedKeys(plugin), sortedKeys(plain); !slices.Equal(got, want) {
        t.Fatalf("emitted artifact sets differ: plugin lane %v, plain lane %v", got, want)
      }
      for name, plainArtifact := range plain {
        if plugin[name].text != plainArtifact.text {
          t.Fatalf("plugin lane %s diverges from the plain tsgo emit\nplain:\n%q\nplugin:\n%q", name, plainArtifact.text, plugin[name].text)
        }
      }
    })
  }
}
