package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

const dirtyBufferFormatContributorName = "test/dirty-buffer-format"

// TestLSPFormatBufferTypeAwareContributorUsesDirtyContent guards the public
// contributor path that requires a real Program and Checker.
//
// The synthetic FormatRule consults an imported value's inferred type before
// applying two cascading edits. Disk and editor contents deliberately differ,
// so returning a disk-derived edit would either overwrite `bufferOnly` or use
// a range measured against the wrong document. A syntactically invalid dirty
// buffer must also fail closed instead of formatting the valid disk twin.
func TestLSPFormatBufferTypeAwareContributorUsesDirtyContent(t *testing.T) {
  registerDirtyBufferFormatContributor(t)

  disk := `import { imported } from "./dep";
const value = imported;
const diskOnly = "FIRST";
`

  t.Run("checker-backed multi-pass edits use the buffer", func(t *testing.T) {
    root := seedDirtyBufferFormatProject(t, disk)
    target := filepath.Join(root, "src", "main.ts")
    uri := lintTestFileURI(t, target)
    buffer := `import { imported } from "./dep";
const value = imported;
const bufferOnly = "FIRST";
`
    want := `import { imported } from "./dep";
const value = imported;
const bufferOnly = "FINAL";
`

    got := executeLSPFormatBufferAppliedTextForTest(t, root, uri, buffer, buffer)
    if got != want {
      t.Fatalf("type-aware dirty-buffer format:\nwant %q\ngot  %q", want, got)
    }
    assertFileText(t, target, disk)
  })

  t.Run("syntax errors do not fall back to disk", func(t *testing.T) {
    root := seedDirtyBufferFormatProject(t, disk)
    target := filepath.Join(root, "src", "main.ts")
    uri := lintTestFileURI(t, target)
    broken := `import { imported } from "./dep";
const value: = imported;
const bufferOnly = "FIRST";
`

    edit := executeLSPFormatBufferEditForTest(t, root, uri, broken)
    if len(edit.Changes) != 0 {
      t.Fatalf("syntax-error dirty buffer edit = %#v, want no changes", edit)
    }
    assertFileText(t, target, disk)
  })
}

func registerDirtyBufferFormatContributor(t *testing.T) {
  t.Helper()
  if existing := LookupRule(dirtyBufferFormatContributorName); existing != nil {
    t.Fatalf("unexpected pre-registered %q rule", dirtyBufferFormatContributorName)
  }
  metadata, err := inspectContributor(dirtyBufferFormatContributor{})
  if err != nil {
    t.Fatalf("inspect contributor: %v", err)
  }
  Register(formatContributorAdapter{
    contributorAdapter: newContributorAdapter(metadata),
  })
}

func seedDirtyBufferFormatProject(t *testing.T, disk string) string {
  t.Helper()
  root := seedLintProject(t, disk)
  writeFile(t, filepath.Join(root, "src", "dep.ts"), "export let imported = 1;\n")
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{},
    "rules": map[string]any{
      dirtyBufferFormatContributorName: "error",
    },
  })
  return root
}

// dirtyBufferFormatContributor requires the imported `value` binding to be a
// number before it rewrites the stage marker. This prevents a checker that was
// built without the dirty target or its dependency graph from satisfying the
// fixture. FIRST -> SECOND -> FINAL requires two independently rebuilt Program
// cycles and therefore shields the complete cascade, not only its first pass.
type dirtyBufferFormatContributor struct{}

func (dirtyBufferFormatContributor) Name() string {
  return dirtyBufferFormatContributorName
}

func (dirtyBufferFormatContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIdentifier}
}

func (dirtyBufferFormatContributor) IsFormat() bool { return true }

func (dirtyBufferFormatContributor) Check(ctx *publicrule.Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || ctx.File == nil || node == nil ||
    shimast.NodeText(node) != "value" || node.Parent == nil ||
    node.Parent.Kind != shimast.KindVariableDeclaration {
    return
  }
  valueType := ctx.Checker.GetTypeAtLocation(node)
  if valueType == nil || ctx.Checker.TypeToString(valueType) != "number" {
    return
  }

  source := ctx.File.Text()
  from, to := "", ""
  switch {
  case strings.Contains(source, "FIRST"):
    from, to = "FIRST", "SECOND"
  case strings.Contains(source, "SECOND"):
    from, to = "SECOND", "FINAL"
  default:
    return
  }
  pos := strings.Index(source, from)
  ctx.ReportRangeFix(
    pos,
    pos+len(from),
    "advance dirty-buffer format cascade",
    publicrule.TextEdit{Pos: pos, End: pos + len(from), Text: to},
  )
}
