package evidence

import (
  "strings"
  "unicode"
)

// documentationRegionLine preserves one source line while separating annotation
// prose from a fenced example. A fence is also a pending-annotation boundary.
type documentationRegionLine struct {
  // text is visible annotation prose with the original line slot retained.
  text string

  // fence ends pending prose and suppresses tags throughout the example.
  fence bool
}

// documentationCommentBody removes only a real native wrapper. Mapped Prisma
// and Markdown bodies have no wrapper, so their initial indentation and blank
// lines must survive to retain relative columns and diagnostic line offsets.
func documentationCommentBody(comment string) (string, int, bool) {
  trimmed := strings.TrimLeftFunc(comment, unicode.IsSpace)
  prefix := ""
  jsdoc := strings.HasPrefix(trimmed, "/**")
  if jsdoc {
    prefix = "/**"
  } else if strings.HasPrefix(trimmed, "/*") {
    prefix = "/*"
  }
  if prefix == "" {
    return comment, 0, false
  }
  leading := strings.Count(comment[:len(comment)-len(trimmed)], "\n")
  body := strings.TrimPrefix(trimmed, prefix)
  body = strings.TrimSuffix(strings.TrimRightFunc(body, unicode.IsSpace), "*/")
  return body, leading, jsdoc
}

// documentationRegions reads examples after removing comment decoration and
// ordinary common indentation. It shares region decisions between citations,
// reviews and withdrawal without merging their distinct semantic records.
// Fences take precedence over HTML and code spans; HTML contents cannot open a
// fence. Equal backtick runs protect literal HTML delimiters, including spans
// crossing a newline. Unmatched code delimiters remain ordinary prose.
func documentationRegions(body string, slashDecoration bool) []documentationRegionLine {
  lines := strings.Split(body, "\n")
  baseline := -1
  for index, line := range lines {
    line = strings.TrimSuffix(line, "\r")
    stripped := strings.TrimLeft(line, " \t")
    if strings.HasPrefix(stripped, "*") {
      line = strings.TrimPrefix(stripped[1:], " ")
    } else if slashDecoration && strings.HasPrefix(stripped, "///") {
      line = strings.TrimPrefix(stripped[3:], " ")
    }
    lines[index] = line
    if strings.TrimSpace(line) != "" {
      columns, _ := documentationColumns(line)
      if baseline < 0 || columns < baseline {
        baseline = columns
      }
    }
  }
  content := strings.Join(lines, "\n")
  mates := documentationCodeMates(content)
  result := make([]documentationRegionLine, len(lines))
  fence := commentFence{}
  html := false
  codeEnd := 0
  tagEnd := 0
  offset := 0
  for index, line := range lines {
    columns, cursor := documentationColumns(line)
    relative := columns - baseline
    delimiter := "    " + line[cursor:]
    if relative >= 0 && relative <= 3 {
      delimiter = strings.Repeat(" ", relative) + line[cursor:]
    }
    if !html && fence.consume(delimiter) {
      result[index].fence = true
      codeEnd, tagEnd = 0, 0
      offset += len(line) + 1
      continue
    }
    masked := []byte(line)
    for at := 0; at < len(line); {
      if html {
        end := len(line)
        if closing := strings.Index(line[at:], "-->"); closing >= 0 {
          end = at + closing + 3
          html = false
        }
        for position := at; position < end; position++ {
          masked[position] = ' '
        }
        at = end
        continue
      }
      if codeEnd > offset+at || tagEnd > offset+at {
        at++
        continue
      }
      if relative < 4 {
        if line[at] == '\\' && at+1 < len(line) {
          at += 2
          continue
        }
        if end, ok := mates[offset+at]; ok {
          codeEnd = end
          at++
          continue
        }
        if strings.HasPrefix(line[at:], "<!--") {
          html = true
          // Empty HTML comments may close with an overlapping final dash.
          if strings.HasPrefix(line[at:], "<!-->") {
            for position := at; position < at+5; position++ {
              masked[position] = ' '
            }
            at += 5
            html = false
          } else if strings.HasPrefix(line[at:], "<!--->") {
            for position := at; position < at+6; position++ {
              masked[position] = ' '
            }
            at += 6
            html = false
          }
          continue
        }
        if line[at] == '<' {
          if end := documentationTagEnd(content, offset+at); end > offset+at {
            tagEnd = end
            at++
            continue
          }
        }
      }
      at++
    }
    result[index].text = strings.TrimSpace(string(masked))
    offset += len(line) + 1
  }
  return result
}

// documentationCodeMates indexes the next equal backtick run in one linear
// reverse pass. A run without a closing mate must not hide later HTML syntax.
func documentationCodeMates(content string) map[int]int {
  mates := map[int]int{}
  next := map[int]int{}
  for end := len(content); end > 0; {
    end--
    if content[end] != '`' {
      continue
    }
    start := end
    for start > 0 && content[start-1] == '`' {
      start--
    }
    // Escapes apply to opening prose, not to a closing run inside code. The
    // forward reader skips escaped openers before consulting this mate index.
    length := end - start + 1
    if closing, ok := next[length]; ok {
      mates[start] = closing + length
    }
    next[length] = start
    end = start
  }
  return mates
}

// documentationTagEnd keeps quoted attribute delimiters literal without adding
// an element-specific policy such as treating every pre element as an example.
func documentationTagEnd(line string, start int) int {
  cursor := start + 1
  if cursor < len(line) && line[cursor] == '/' {
    cursor++
  }
  if cursor >= len(line) || !((line[cursor] >= 'a' && line[cursor] <= 'z') || (line[cursor] >= 'A' && line[cursor] <= 'Z')) {
    return start
  }
  quote := byte(0)
  for cursor++; cursor < len(line); cursor++ {
    char := line[cursor]
    if quote != 0 {
      if char == quote {
        quote = 0
      }
    } else if char == '\'' || char == '"' {
      quote = char
    } else if char == '>' {
      return cursor + 1
    }
  }
  return len(line)
}

// documentationColumns measures four-column tab stops while retaining the byte
// position where content starts. Fence grammar consumes the relative columns.
func documentationColumns(line string) (int, int) {
  columns, cursor := 0, 0
  for cursor < len(line) {
    if line[cursor] == ' ' {
      columns++
    } else if line[cursor] == '\t' {
      columns += 4 - columns%4
    } else {
      break
    }
    cursor++
  }
  return columns, cursor
}
