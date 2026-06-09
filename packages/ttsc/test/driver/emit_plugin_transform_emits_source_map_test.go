package driver_test

import (
  "encoding/json"
  "path/filepath"
  "strconv"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerEmitsSourceMap is the source-map contract guard
// for the AST plugin-transform emit path (the seam typia integrates through).
//
// A plugin transform can expand one source statement into many emitted lines, so
// `sourceMap: true` must still yield a `.js.map` next to the `.js` and a trailing
// `//# sourceMappingURL=` comment — exactly as a plain tsgo build does. The
// hand-assembled emit pipeline in EmitWithPluginTransformers historically wrote
// only the JavaScript and dropped the map, silently producing source-map-less
// output for every transformed file. This pins the map back on.
//
//  1. Compile a `sourceMap: true` project whose plugin transform prepends a block
//     of synthetic statements (one line becomes many).
//  2. Emit through EmitWithPluginTransformer.
//  3. Assert the `.js` carries the sourceMappingURL trailer and the emitted
//     `.js.map` is a valid v3 map that lists `index.ts` with non-empty mappings.
func TestEmitWithPluginTransformerEmitsSourceMap(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "sourceMap": true,
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Transform: prepend 50 synthetic `const _k = k;` statements so the single
  // authored line balloons into a many-line output, the shape that motivated the
  // source-map question in the first place.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindSourceFile {
        visited := visitor.VisitEachChild(node).AsSourceFile()
        injected := make([]*shimast.Node, 0, 50)
        for k := 0; k < 50; k++ {
          name := ec.Factory.NewIdentifier("_" + strconv.Itoa(k))
          init := ec.Factory.NewNumericLiteral(strconv.Itoa(k), 0)
          decl := ec.Factory.NewVariableDeclaration(name, nil, nil, init)
          list := ec.Factory.NewVariableDeclarationList(ec.Factory.NewNodeList([]*shimast.Node{decl}), shimast.NodeFlagsConst)
          injected = append(injected, ec.Factory.NewVariableStatement(nil, list))
        }
        stmts := append(injected, visited.Statements.Nodes...)
        return ec.Factory.UpdateSourceFile(visited, ec.Factory.NewNodeList(stmts), visited.EndOfFileToken)
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }

  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }

  js := emitted["index.js"]
  if js == "" {
    t.Fatalf("index.js was not emitted: %#v keys", keysOf(emitted))
  }
  if !strings.Contains(js, "//# sourceMappingURL=index.js.map") {
    t.Fatalf("index.js missing sourceMappingURL trailer:\n%s", js)
  }

  mapText := emitted["index.js.map"]
  if mapText == "" {
    t.Fatalf("index.js.map was not emitted; only got %v", keysOf(emitted))
  }
  var parsed struct {
    Version  int      `json:"version"`
    Sources  []string `json:"sources"`
    Mappings string   `json:"mappings"`
  }
  if err := json.Unmarshal([]byte(mapText), &parsed); err != nil {
    t.Fatalf("index.js.map is not valid JSON: %v\n%s", err, mapText)
  }
  if parsed.Version != 3 {
    t.Fatalf("source map version = %d, want 3:\n%s", parsed.Version, mapText)
  }
  if parsed.Mappings == "" {
    t.Fatalf("source map has empty mappings:\n%s", mapText)
  }
  foundSource := false
  for _, s := range parsed.Sources {
    if strings.HasSuffix(filepath.ToSlash(s), "index.ts") {
      foundSource = true
    }
  }
  if !foundSource {
    t.Fatalf("source map sources do not reference index.ts: %v", parsed.Sources)
  }

  // Presence is not enough: decode the mappings and prove they point at the real
  // authored line. The source is a single line (`export const a = 0;`), so every
  // mapping must resolve to source line 0 — the 50 synthetic statements the
  // transform prepended are positionless and must contribute no mapping. A map
  // that recorded positions against the transformed file, or collapsed onto the
  // wrong line, would still satisfy the presence checks above but fail here.
  segments := parseMappings(parsed.Mappings)
  if len(segments) == 0 {
    t.Fatalf("decoded no source mappings from: %q", parsed.Mappings)
  }
  for _, s := range segments {
    if s.srcLine != 0 {
      t.Fatalf("mapping points at source line %d, but the authored source has only line 0", s.srcLine)
    }
  }
}

// keysOf returns the keys of a string map for diagnostic messages.
func keysOf(m map[string]string) []string {
  out := make([]string, 0, len(m))
  for k := range m {
    out = append(out, k)
  }
  return out
}
