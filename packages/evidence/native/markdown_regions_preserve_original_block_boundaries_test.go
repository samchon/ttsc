package evidence

import (
  "strings"
  "testing"
)

// TestMarkdownRegionsPreserveOriginalBlockBoundaries verifies opaque examples
// cannot join paragraphs or erase the containers deciding code ownership.
//
// Removing a multiline example can pair two backtick runs that were separated
// by a blank line. Conversely, a real comment block ends before the following
// indented code. Both boundaries decide whether the next comment is metadata.
//
// 1. Scan authored blank-line, comment-block and nested-container boundaries.
// 2. Require every authored genuine citation and its original source line.
// 3. Repeat with CRLF without changing the expected host or target.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown and asserts the authored genuine citations' count, targets, source lines and public heading hosts, plus exact unit and unreadable-tag counts. Code examples and a blank-separated unmatched code run cannot hide it or add another declaration.
// @evidence contracts/testing.md#independent-expectations CommonMark code spans cannot cross paragraph boundaries, indented code after an HTML comment block remains code, and quote/list fences own their content. Literal source strings independently locate the genuine citation without deriving expectations from scanner regions.
// @evidence contracts/testing.md#distinguishing-cases Contrasts a blank line inside an MDX template with neighboring unmatched double-backtick runs, an HTML comment followed by indented code, nested quoted/list fences and real citations after every supported close. Contrasts incomplete/malformed tag syntax with actual quoted carriers and preserves the existing raw title of real headings while preventing inline markup from synthesizing heading or tag prefixes. H1 through H6 retain their single-line ATX source boundary while a non-ATX prefix keeps real multiline code ownership; a comment closing prefix cannot invent a heading. LF and CRLF preserve the same annotation identity and line.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit entry owns its table subtests and executes the native scanner on strings in the same process. It requires no consumer installation, native artifact production or product host.
func TestMarkdownRegionsPreserveOriginalBlockBoundaries(t *testing.T) {
  real := "<!-- @evidence docs/spec.md#rule Actual. -->"
  fake := "<!-- @evidence docs/spec.md#fake Example. -->"
  for _, row := range []struct {
    name string
    body string
    declarations int
    units int
    unreadable int
  }{
    {"comment then indented code", "<!-- ordinary -->\n    " + fake + "\n" + real + "\n", 1, 2, 0},
    {"nested quote fence", "> > ~~~md\n> > " + fake + "\n> > ~~~\n\n" + real + "\n", 1, 2, 0},
    {"quoted ordered list fence", "> 1. ```md\n>    " + fake + "\n>    ```\n\n" + real + "\n", 1, 2, 0},
 {"comment before MDX",real+" <Code code={`\n```md\n`} /> "+real+"\n",2,2,0},
 {"blank MDX paragraph","``pre <Code code={`\n\n`} /> "+real+" post``\n",1,2,0},
 {"malformed pre name","<pre.foo>\n"+real+"\n@evidence docs/spec.md#rule Bare.\n",1,2,1},
 {"incomplete generic quote","<span title=\"\n"+real+"\n",1,2,0},
 {"inline HTML before heading marker","<b># Hidden\n"+real+"\n",1,2,0},
 {"inline HTML before mention","<i> @evidence docs/spec.md#rule Mention.\n"+real+"\n",1,2,0},
 {"MDX blank before fence","<Code code={`\n\n```md\n"+fake+"\n```\n`} /> "+real+"\n",1,2,0},
 {"MDX headed interior fence","# Detail <Code code={`\n```md\n"+fake+"\n`} /> "+real+"\n",1,3,0},
 {"MDX plain prefix interior fence","body <Code code={`\n```md\n"+fake+"\n`} /> "+real+"\n",1,2,0},
 {"MDX quoted blank fence","> <Code code={`\n>\n> ```md\n> "+fake+"\n> ```\n> `} />\n"+real+"\n",1,2,0},
 {"MDX quoted tail fence","<Code code={`ok`} tail=\"\n```md\n\" />\n"+real+"\n",1,2,0},
 {"plain quoted attribute fence","<Code tail=\"\n```md\n\" />\n"+real+"\n",1,2,0},
 {"MDX quoted tail tilde","<Code code={`ok`} tail=\"\n~~~md\n\" />\n"+real+"\n",1,2,0},
 {"list MDX missing prefix","- <Code code={`\n```md\n`} />\n"+real+"\n",1,2,0},
 {"quote MDX missing prefix","> <Code code={`\n```md\n`} />\n"+real+"\n",1,2,0},
 {"same-line close comment","<Code code={`\n```md\n`} />"+real+"\n",1,2,0},
 {"same-line close inline code","<Code code={`\n```md\n`} /> `"+fake+"` "+real+"\n",1,2,0},
 {"preceding code owns MDX","``first\nx <Code code={`\nlast``\n"+real+"\n",1,2,0},
 {"two actual templates","<Code code={`\n```md\n`} /><Code code={`\n~~~md\n`} />"+real+"\n",1,2,0},
 {"code after template owns MDX","<Code code={`\n~~~md\n`} /> ``<Code code={` literal`` "+real+"\n",1,2,0},
  } {
    for _, newline := range []string{"\n", "\r\n"} {
      t.Run(row.name+"/"+strings.ReplaceAll(newline, "\n", "LF"), func(t *testing.T) {
        content := strings.ReplaceAll("# Public\n\n"+row.body, "\n", newline)
        inventory, problems := scanProjectMarkdown("docs/claim.md", content)
        if len(problems) != 0 || len(inventory.Unreadable) != row.unreadable || len(inventory.Declarations) != row.declarations || len(inventory.Units) != row.units {
          t.Fatalf("block boundary changed metadata: problems=%v unreadable=%v declarations=%v", problems, inventory.Unreadable, inventory.Declarations)
        }
        position := 0
        for _, declaration := range inventory.Declarations {
          position += strings.Index(content[position:], real)
          expectedLine := strings.Count(content[:position], "\n") + 1
          if declaration.Target != "docs/spec.md#rule" || declaration.Line != expectedLine ||
            declaration.HostID != inventory.Units[len(inventory.Units)-1].ID {
            t.Fatalf("genuine citation lost source identity: line=%d declaration=%+v units=%v", expectedLine, declaration, inventory.Units)
          }
          position += len(real)
        }
      })
    }
  }
  for _, newline := range []string{"\n", "\r\n"} {
    t.Run("inline heading title/"+strings.ReplaceAll(newline, "\n", "LF"), func(t *testing.T) {
      content := strings.ReplaceAll("# Public <b>Bold</b>\n"+real+"\n", "\n", newline)
      inventory, problems := scanProjectMarkdown("docs/claim.md", content)
      if len(problems) != 0 || len(inventory.Units) != 2 ||
        inventory.Units[1].Target != "docs/claim.md#public-bboldb" || len(inventory.Declarations) != 1 ||
        inventory.Declarations[0].HostID != inventory.Units[1].ID {
        t.Fatalf("inline markup changed the existing heading identity: units=%v declarations=%v problems=%v", inventory.Units, inventory.Declarations, problems)
      }
    })
  }
  for level := 1; level <= 6; level++ {
    for _, newline := range []string{"\n", "\r\n"} {
      t.Run("ATX source boundary/"+decimal(level)+"/"+strings.ReplaceAll(newline, "\n", "LF"), func(t *testing.T) {
        content := strings.ReplaceAll(strings.Repeat("#", level)+" Public ``pre <Code code={`\n`} /> "+real+" post``\n", "\n", newline)
        inventory, problems := scanProjectMarkdown("docs/claim.md", content)
        expectedUnits := 1
        if level <= 4 { expectedUnits++ }
        if len(problems) != 0 || len(inventory.Units) != expectedUnits || len(inventory.Declarations) != 1 ||
          inventory.Declarations[0].Target != "docs/spec.md#rule" || inventory.Declarations[0].Line != 2 ||
          !strings.HasSuffix(inventory.Declarations[0].HostID, ":h"+decimal(level)+":1") {
          t.Fatalf("ATX line joined a later block: declarations=%v problems=%v", inventory.Declarations, problems)
        }
      })
    }
  }
  for _, newline := range []string{"\n", "\r\n"} {
    t.Run("ordinary paragraph boundary/"+strings.ReplaceAll(newline, "\n", "LF"), func(t *testing.T) {
      content := strings.ReplaceAll("#word ``pre <Code code={`\n`} /> "+real+" post``\n", "\n", newline)
      inventory, problems := scanProjectMarkdown("docs/claim.md", content)
      if len(problems) != 0 || len(inventory.Declarations) != 0 {
        t.Fatalf("non-ATX prefix split a real multiline code span: declarations=%v problems=%v", inventory.Declarations, problems)
      }
    })
    t.Run("comment closing prefix/"+strings.ReplaceAll(newline, "\n", "LF"), func(t *testing.T) {
      content := strings.ReplaceAll("<!-- ordinary\n--># Hidden\n"+real+"\n", "\n", newline)
      inventory, problems := scanProjectMarkdown("docs/claim.md", content)
      if len(problems) != 0 || len(inventory.Units) != 1 || len(inventory.Declarations) != 1 ||
        inventory.Declarations[0].Line != 3 || inventory.Declarations[0].HostID != inventory.Units[0].ID {
        t.Fatalf("comment close invented a heading: units=%v declarations=%v problems=%v", inventory.Units, inventory.Declarations, problems)
      }
    })
  }
}
