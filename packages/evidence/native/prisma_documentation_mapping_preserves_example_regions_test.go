package evidence

import (
  "strings"
  "testing"
)

/**
 * TestPrismaDocumentationMappingPreservesExampleRegions verifies Prisma comment
 * ingestion preserves the indentation consumed by shared annotation parsing.
 *
 * A corrected parser cannot recover whitespace erased by the locator. This
 * case follows authored schema bytes through actual run mapping and host binding.
 *
 * 1. Scan literal and real fences through both line and block documentation.
 * 2. Require literal delimiters to preserve the citation at its original line.
 * 3. Reject hidden HTML examples and keep plain/fourth-slash comments ineligible.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaClaimOf invokes scanPrismaFile, actual mapped-run parsers and prismaDeclarationsFromComments; assertions compare citation target/reason/source line, reject HTML/fence examples as unsupported or buried tags, and retain real unsupported/buried-tag diagnostics.
 * @evidence contracts/testing.md#independent-expectations Prisma supports three-slash and block documentation while a fourth slash is content. Relative four-column indentation and authored line numbers independently determine fence classification and annotation location.
 * @evidence contracts/testing.md#distinguishing-cases Space/tab literal versus zero/three-space real fences, line/block forms, LF/CRLF and hidden HTML bodies exercise ingestion as well as parser semantics. Unsupported enums, detached carriers and attached fourth-slash examples distinguish shared region decisions from raw diagnostic scanning; real tags preserve the existing rejection policy.
 * @evidence contracts/testing.md#execution-ownership This direct native Go unit supplies decoded model records and calls native mapping/attachment operations in-process. It does not invoke a Node Prisma bridge, install a consumer or build a product artifact.
 */
func TestPrismaDocumentationMappingPreservesExampleRegions(t *testing.T) {
  for _, indent := range []string{"", "   ", "    ", "\t"} {
    literal := indent == "    " || indent == "\t"
    for _, block := range []bool{false, true} {
      prefix, suffix := "/// ", ""
      if block {
        prefix, suffix = "/*\n", "\n*/"
      }
      content := prefix + indent + "~~~text\n"
      if !block {
        content += "/// "
      }
      content += "@evidence docs/spec.md#rule Actual reason." + suffix + "\nmodel Sale {\n id Int @id\n}\n"
      for _, newline := range []string{"\n", "\r\n"} {
        t.Run(indent+"/"+decimal(boolLine(block))+"/"+decimal(len(newline)), func(t *testing.T) {
          declarations, problems := prismaClaimOf(strings.ReplaceAll(content, "\n", newline), prismaClaimModels)
          if len(problems) != 0 {
            t.Fatalf("valid documentation failed mapping: %v", problems)
          }
          if !literal {
            if len(declarations) != 0 {
              t.Fatalf("real fence exposed citation: %#v", declarations)
            }
          } else if len(declarations) != 1 || declarations[0].Target != "docs/spec.md#rule" || declarations[0].Reason != "Actual reason." || declarations[0].Line != 2+boolLine(block) {
            t.Fatalf("mapped indentation/location lost: %q %#v", content, declarations)
          }
        })
      }
    }
  }
  t.Run("hidden", func(t *testing.T) {
    hidden, problems := prismaClaimOf("/// <!--\n/// @evidence docs/spec.md#rule Hidden.\n/// -->\nmodel Sale {\n id Int @id\n}\n", prismaClaimModels)
    if len(problems) != 0 || len(hidden) != 0 {
      t.Fatalf("Prisma HTML example exposed citation: %#v %v", hidden, problems)
    }
  })
  for _, prefix := range []string{"// ", "//// "} {
    t.Run("unsupported/"+prefix, func(t *testing.T) {
      declarations, problems := prismaClaimOf(prefix+"@evidence docs/spec.md#rule Not eligible.\nmodel Sale {\n id Int @id\n}\n", prismaClaimModels)
      if len(declarations) != 0 || len(problems) != 1 {
        t.Fatalf("non-documentation policy changed: %q %#v %v", prefix, declarations, problems)
      }
    })
  }
  for _, scenario := range []struct {
    name, body, ending string
    wantProblems       int
  }{
    {"enum-html-example", "/// <!--\n/// @evidence spec.md Hidden.\n/// -->\n", "enum Status {\n ACTIVE\n}\n", 0},
    {"enum-fence-example", "/// ~~~text\n/// @evidence spec.md Hidden.\n/// ~~~\n", "enum Status {\n ACTIVE\n}\n", 0},
    {"enum-real-tag", "/// @evidence spec.md Actual.\n", "enum Status {\n ACTIVE\n}\n", 1},
    {"unattached-html-example", "/// <!--\n/// @evidence spec.md Hidden.\n/// -->\n", "\nmodel Sale {\n id Int @id\n}\n", 0},
    {"attached-html-buried-example", "/// <!--\n//// @evidence spec.md Hidden.\n/// -->\n", "model Sale {\n id Int @id\n}\n", 0},
    {"attached-fence-buried-example", "/// ~~~text\n//// @evidence spec.md Hidden.\n/// ~~~\n", "model Sale {\n id Int @id\n}\n", 0},
    {"attached-real-buried-tag", "//// @evidence spec.md Actual.\n", "model Sale {\n id Int @id\n}\n", 1},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      declarations, problems := prismaClaimOf(scenario.body+scenario.ending, prismaClaimModels)
      if len(declarations) != 0 || len(problems) != scenario.wantProblems {
        t.Fatalf("declarations=%#v problems=%#v; want %d problems", declarations, problems, scenario.wantProblems)
      }
    })
  }
}

// boolLine accounts for the additional block-comment opening line in the
// independently authored fixture, without deriving locations from the scanner.
func boolLine(value bool) int {
  if value {
    return 1
  }
  return 0
}
