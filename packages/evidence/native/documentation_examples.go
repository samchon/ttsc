package evidence

import (
  "strings"
  "unicode"
)

// documentationBody strips a native block wrapper when present. A mapped body
// has no wrapper: its first line's indentation is content and must survive.
func documentationBody(comment string) (string, int, bool) {
  trimmed := strings.TrimLeftFunc(comment, unicode.IsSpace)
  documented := strings.HasPrefix(trimmed, "/**")
  prefix := "/*"
  if documented {
    prefix = "/**"
  }
  if !strings.HasPrefix(trimmed, prefix) {
    return comment, 0, false
  }
  leadingLines := strings.Count(comment[:len(comment)-len(trimmed)], "\n")
  return strings.TrimSuffix(strings.TrimRightFunc(trimmed[len(prefix):], unicode.IsSpace), "*/"), leadingLines, documented
}

// documentationLine retains its original line slot while separating visible
// annotation prose from fenced examples. Masking never removes a newline.
type documentationLine struct {
  text   string
  fenced bool
}

// documentationExamples removes comment decoration without erasing relative
// indentation, then resolves fences, inline code and HTML comments in lexical
// order. The caller supplies a comment body, not its artifact's outer HTML host.
// An open HTML comment ends at its first close; its apparent fences are inert.
// Slash decoration is enabled only by consumers whose host accepts it. The one
// ordinary padding space after a decoration is removed before tab expansion.
//
// One preprocessing owner supplies the same visible lines and fence boundaries
// to citations, reviews and withdrawal without merging their annotation types.
// HTML masking applies inside an already extracted documentation host, so it
// neither removes Markdown's outer host nor invents annotation prose.
//
// Decoration, indentation and region scans visit the supplied bytes. A per-line
// closing-run index pairs exact inline delimiters without rescanning candidate
// suffixes. Line buffers and indexes retain at most the comment bytes during
// this parse; no cached result or external resource outlives it.
func documentationExamples(comment string, slashDecoration bool) []documentationLine {
  lines := strings.Split(comment, "\n")
  baseline := -1
  for index, line := range lines {
    stripped := strings.TrimLeft(line, " \t\r")
    if slashDecoration && strings.HasPrefix(stripped, "///") {
      line = strings.TrimPrefix(stripped[3:], " ")
    } else if strings.HasPrefix(stripped, "*") {
      line = strings.TrimPrefix(stripped[1:], " ")
    }
    lines[index] = line
    if strings.TrimSpace(line) != "" {
      columns, _ := documentationIndent(line)
      if baseline < 0 || columns < baseline {
        baseline = columns
      }
    }
  }
  result := make([]documentationLine, len(lines))
  fence := commentFence{}
  html := false
  for index, line := range lines {
    columns, cursor := documentationIndent(line)
    relative := columns - baseline
    // markdownFence owns marker, length and info-string syntax; only its
    // indentation input differs between an artifact and a documentation body.
    delimiter := line
    if relative >= 0 && relative <= 3 {
      delimiter = strings.Repeat(" ", relative) + line[cursor:]
    } else {
      delimiter = "    " + line[cursor:]
    }
    if !html && fence.consume(delimiter) {
      result[index].fenced = true
      continue
    }
    literal := relative >= 4
    masked := []byte(line)
    // Pair equal, unescaped backtick runs from right to left. Each run gets
    // its next exact mate, so unmatched runs leave later markup visible.
    mates := make(map[int]int)
    next := make(map[int]int)
    for end := len(line); end > 0; {
      end--
      if line[end] != '`' {
        continue
      }
      start := end
      for start > 0 && line[start-1] == '`' {
        start--
      }
      slashes := 0
      for before := start - 1; before >= 0 && line[before] == '\\'; before-- {
        slashes++
      }
      if slashes%2 == 0 {
        length := end - start + 1
        if closing, ok := next[length]; ok {
          mates[start] = closing + length
        }
        next[length] = start
      }
      end = start
    }
    for offset := 0; offset < len(line); {
      if html {
        closing := strings.Index(line[offset:], "-->")
        end := len(line)
        if closing >= 0 {
          end = offset + closing + 3
          html = false
        }
        for at := offset; at < end; at++ {
          masked[at] = ' '
        }
        offset = end
        continue
      }
      if !literal {
        if end, ok := mates[offset]; ok {
          offset = end
          continue
        }
        if strings.HasPrefix(line[offset:], "<!--") {
          length := 0
          if strings.HasPrefix(line[offset:], "<!-->") {
            length = 5
          } else if strings.HasPrefix(line[offset:], "<!--->") {
            length = 6
          }
          if length != 0 {
            for at := offset; at < offset+length; at++ {
              masked[at] = ' '
            }
            offset += length
            continue
          }
          html = true
          for at := offset; at < offset+4; at++ {
            masked[at] = ' '
          }
          offset += 4
          continue
        }
        if line[offset] == '<' {
          if end := documentationMarkupEnd(line, offset); end > offset {
            offset = end
            continue
          }
        }
      }
      offset++
    }
    result[index].text = strings.TrimSpace(string(masked))
  }
  return result
}

// documentationMarkupEnd skips an ordinary HTML tag when looking for
// comment openings. A quoted attribute's literal delimiter is not a comment;
// the tag itself remains visible prose, without adding an element-code policy.
// An incomplete tag owns the remainder of this line for delimiter recognition.
func documentationMarkupEnd(line string, start int) int {
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

// documentationIndent measures tabs at four-column stops, before trimming any
// content. The byte cursor lets fence recognition reuse its ordinary grammar.
func documentationIndent(line string) (int, int) {
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
