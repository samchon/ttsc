package linthost

import (
  "sort"
  "strconv"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// regexpSourceRule implements the high-confidence, source-text subset of
// eslint-plugin-regexp. The first wave intentionally targets regex literals
// only: TypeScript-Go has already parsed those successfully, so these checks can
// stay AST-only and avoid pretending to evaluate arbitrary `RegExp(...)`
// constructor strings.
type regexpSourceRule struct {
  name  string
  check func(regexpLiteralParts) bool
}

type regexpLiteralParts struct {
  raw     string
  pattern string
  flags   string
}

func (r regexpSourceRule) Name() string { return r.name }
func (regexpSourceRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (r regexpSourceRule) Check(ctx *Context, node *shimast.Node) {
  parts, ok := parseRegexpLiteralParts(ctx, node)
  if !ok || r.check == nil || !r.check(parts) {
    return
  }
  ctx.Report(node, regexpRuleMessage(r.name))
}

type regexpNoUselessEscapeAlias struct{}

func (regexpNoUselessEscapeAlias) Name() string { return "regexp/no-useless-escape" }
func (regexpNoUselessEscapeAlias) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (regexpNoUselessEscapeAlias) Check(ctx *Context, node *shimast.Node) {
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 {
    return
  }
  reportRegexEscapes(ctx, ctx.File.Text()[pos:end], pos)
}

func parseRegexpLiteralParts(ctx *Context, node *shimast.Node) (regexpLiteralParts, bool) {
  raw := nodeText(ctx.File, node)
  if len(raw) < 2 || raw[0] != '/' {
    return regexpLiteralParts{}, false
  }
  closing := strings.LastIndexByte(raw, '/')
  if closing <= 0 {
    return regexpLiteralParts{}, false
  }
  return regexpLiteralParts{
    raw:     raw,
    pattern: raw[1:closing],
    flags:   raw[closing+1:],
  }, true
}

func regexpRuleMessage(name string) string {
  switch name {
  case "regexp/no-control-character":
    return "Unexpected control character in regular expression."
  case "regexp/no-dupe-characters-character-class":
    return "Unexpected duplicate character in character class."
  case "regexp/no-empty-alternative":
    return "Unexpected empty alternative."
  case "regexp/no-empty-capturing-group":
    return "Unexpected empty capturing group."
  case "regexp/no-empty-character-class":
    return "Unexpected empty character class."
  case "regexp/no-empty-group":
    return "Unexpected empty group."
  case "regexp/no-empty-lookarounds-assertion":
    return "Unexpected empty lookaround assertion."
  case "regexp/no-misleading-unicode-character":
    return "Unexpected misleading Unicode character in character class."
  case "regexp/no-useless-character-class":
    return "Unexpected character class with one character."
  case "regexp/no-useless-flag":
    return "Unexpected useless regular expression flag."
  case "regexp/no-useless-quantifier":
    return "Unexpected useless quantifier."
  case "regexp/no-useless-two-nums-quantifier":
    return "Unexpected quantifier with equal minimum and maximum."
  case "regexp/no-zero-quantifier":
    return "Unexpected quantifier that repeats zero times."
  case "regexp/prefer-d":
    return "Prefer \\d over [0-9]."
  case "regexp/prefer-plus-quantifier":
    return "Prefer + over {1,}."
  case "regexp/prefer-question-quantifier":
    return "Prefer ? over {0,1}."
  case "regexp/prefer-star-quantifier":
    return "Prefer * over {0,}."
  case "regexp/prefer-w":
    return "Prefer \\w over [A-Za-z0-9_]."
  case "regexp/require-unicode-regexp":
    return "Regular expression should use the u or v flag."
  case "regexp/require-unicode-sets-regexp":
    return "Regular expression should use the v flag."
  case "regexp/sort-flags":
    return "Regular expression flags should be sorted."
  default:
    return "Unexpected regular expression pattern."
  }
}

func regexpHasEmptyAlternative(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    if pattern[i] != '|' {
      return false
    }
    return i == 0 || i == len(pattern)-1 || pattern[i-1] == '|' || pattern[i-1] == '(' || pattern[i+1] == '|' || pattern[i+1] == ')'
  })
}

func regexpHasEmptyCapturingGroup(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    return pattern[i] == '(' && i+1 < len(pattern) && pattern[i+1] == ')'
  })
}

func regexpHasEmptyGroup(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    return strings.HasPrefix(pattern[i:], "(?:)")
  })
}

func regexpHasEmptyLookaround(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    return strings.HasPrefix(pattern[i:], "(?=)") ||
      strings.HasPrefix(pattern[i:], "(?!)") ||
      strings.HasPrefix(pattern[i:], "(?<=)") ||
      strings.HasPrefix(pattern[i:], "(?<!)")
  })
}

// regexpHasEmptyCharacterClass reports non-negated character classes whose
// parsed element list is empty. The compiler's regexp parser is the syntax
// authority; the structural walk runs only after that parser accepts the full
// literal, so malformed escapes, flags, and class-set expressions cannot
// create lint findings.
func regexpHasEmptyCharacterClass(parts regexpLiteralParts) bool {
  if !shimscanner.IsValidRegularExpressionLiteral(parts.raw) {
    return false
  }
  unicodeSets := strings.Contains(parts.flags, "v")
  depth := 0
  for i := 0; i < len(parts.pattern); i++ {
    switch parts.pattern[i] {
    case '\\':
      i++
    case '[':
      if depth != 0 && !unicodeSets {
        continue
      }
      depth++
      content := i + 1
      negated := content < len(parts.pattern) && parts.pattern[content] == '^'
      if negated {
        content++
      }
      if !negated && content < len(parts.pattern) && parts.pattern[content] == ']' {
        return true
      }
    case ']':
      if depth > 0 {
        depth--
      }
    }
  }
  return false
}

func regexpHasZeroQuantifier(parts regexpLiteralParts) bool {
  return scanRegexpQuantifiers(parts.pattern, func(min, max int, hasComma bool) bool {
    return min == 0 && (!hasComma || max == 0)
  })
}

func regexpHasUselessTwoNumsQuantifier(parts regexpLiteralParts) bool {
  return scanRegexpQuantifiers(parts.pattern, func(min, max int, hasComma bool) bool {
    return hasComma && min == max && min >= 0
  })
}

func regexpHasUselessQuantifier(parts regexpLiteralParts) bool {
  return scanRegexpQuantifiers(parts.pattern, func(min, max int, hasComma bool) bool {
    return !hasComma && min == 1 && max == -1
  })
}

func regexpHasPlusQuantifierCandidate(parts regexpLiteralParts) bool {
  return scanRegexpQuantifiers(parts.pattern, func(min, max int, hasComma bool) bool {
    return hasComma && min == 1 && max == -1
  })
}

func regexpHasStarQuantifierCandidate(parts regexpLiteralParts) bool {
  return scanRegexpQuantifiers(parts.pattern, func(min, max int, hasComma bool) bool {
    return hasComma && min == 0 && max == -1
  })
}

func regexpHasQuestionQuantifierCandidate(parts regexpLiteralParts) bool {
  return scanRegexpQuantifiers(parts.pattern, func(min, max int, hasComma bool) bool {
    return hasComma && min == 0 && max == 1
  })
}

func regexpNeedsUnicodeFlag(parts regexpLiteralParts) bool {
  return !strings.ContainsAny(parts.flags, "uv")
}

func regexpNeedsUnicodeSetsFlag(parts regexpLiteralParts) bool {
  return !strings.Contains(parts.flags, "v")
}

func regexpFlagsUnsorted(parts regexpLiteralParts) bool {
  sorted := []byte(parts.flags)
  sort.SliceStable(sorted, func(i, j int) bool {
    return regexpFlagOrder(sorted[i]) < regexpFlagOrder(sorted[j])
  })
  return string(sorted) != parts.flags
}

func regexpFlagOrder(flag byte) int {
  const order = "dgimsuvy"
  if i := strings.IndexByte(order, flag); i >= 0 {
    return i
  }
  return len(order) + int(flag)
}

func regexpHasUselessFlag(parts regexpLiteralParts) bool {
  if strings.Contains(parts.flags, "i") && !regexpPatternHasAsciiLetter(parts.pattern) {
    return true
  }
  if strings.Contains(parts.flags, "m") && !regexpPatternHasLineAnchor(parts.pattern) {
    return true
  }
  return false
}

func regexpHasPreferD(parts regexpLiteralParts) bool {
  return strings.Contains(parts.pattern, "[0-9]")
}

func regexpHasPreferW(parts regexpLiteralParts) bool {
  return strings.Contains(parts.pattern, "[A-Za-z0-9_]") || strings.Contains(parts.pattern, "[a-zA-Z0-9_]")
}

func regexpHasDuplicateClassCharacter(parts regexpLiteralParts) bool {
  return walkRegexpCharacterClasses(parts.pattern, func(content string) bool {
    if classHasRange(content) {
      return false
    }
    seen := map[byte]struct{}{}
    for i := 0; i < len(content); i++ {
      ch := content[i]
      if ch == '\\' {
        i++
        continue
      }
      if ch == '^' && i == 0 {
        continue
      }
      if ch == '-' {
        continue
      }
      if _, ok := seen[ch]; ok {
        return true
      }
      seen[ch] = struct{}{}
    }
    return false
  })
}

func regexpHasUselessCharacterClass(parts regexpLiteralParts) bool {
  return walkRegexpCharacterClasses(parts.pattern, func(content string) bool {
    if len(content) != 1 {
      return false
    }
    ch := content[0]
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')
  })
}

func scanRegexpPattern(pattern string, visit func(pattern string, i int) bool) bool {
  inClass := false
  for i := 0; i < len(pattern); i++ {
    switch pattern[i] {
    case '\\':
      i++
    case '[':
      if !inClass {
        inClass = true
      }
    case ']':
      inClass = false
    default:
      if !inClass && visit(pattern, i) {
        return true
      }
    }
  }
  return false
}

func scanRegexpQuantifiers(pattern string, visit func(min, max int, hasComma bool) bool) bool {
  return scanRegexpPattern(pattern, func(pattern string, i int) bool {
    if pattern[i] != '{' {
      return false
    }
    end := i + 1
    for end < len(pattern) && pattern[end] != '}' {
      end++
    }
    if end >= len(pattern) {
      return false
    }
    body := pattern[i+1 : end]
    hasComma := strings.Contains(body, ",")
    min, max := -1, -1
    if hasComma {
      pair := strings.SplitN(body, ",", 2)
      min = parseRegexpQuantifierNumber(pair[0])
      if pair[1] != "" {
        max = parseRegexpQuantifierNumber(pair[1])
      }
    } else {
      min = parseRegexpQuantifierNumber(body)
    }
    return min >= 0 && visit(min, max, hasComma)
  })
}

func parseRegexpQuantifierNumber(text string) int {
  if text == "" {
    return -1
  }
  for i := 0; i < len(text); i++ {
    if text[i] < '0' || text[i] > '9' {
      return -1
    }
  }
  value, err := strconv.Atoi(text)
  if err != nil {
    return -1
  }
  return value
}

func walkRegexpCharacterClasses(pattern string, visit func(content string) bool) bool {
  for i := 0; i < len(pattern); i++ {
    if pattern[i] == '\\' {
      i++
      continue
    }
    if pattern[i] != '[' {
      continue
    }
    start := i + 1
    for j := start; j < len(pattern); j++ {
      if pattern[j] == '\\' {
        j++
        continue
      }
      if pattern[j] == ']' {
        if visit(pattern[start:j]) {
          return true
        }
        i = j
        break
      }
    }
  }
  return false
}

func classHasRange(content string) bool {
  for i := 1; i+1 < len(content); i++ {
    if content[i] == '\\' {
      i++
      continue
    }
    if content[i] == '-' {
      return true
    }
  }
  return false
}

func regexpPatternHasAsciiLetter(pattern string) bool {
  return scanRegexpPattern(pattern, func(pattern string, i int) bool {
    ch := pattern[i]
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
  })
}

func regexpPatternHasLineAnchor(pattern string) bool {
  return scanRegexpPattern(pattern, func(pattern string, i int) bool {
    return pattern[i] == '^' || pattern[i] == '$'
  })
}

func init() {
  Register(regexpSourceRule{name: "regexp/no-control-character", check: func(parts regexpLiteralParts) bool {
    return regexContainsControl(parts.raw)
  }})
  Register(regexpSourceRule{name: "regexp/no-dupe-characters-character-class", check: regexpHasDuplicateClassCharacter})
  Register(regexpSourceRule{name: "regexp/no-empty-alternative", check: regexpHasEmptyAlternative})
  Register(regexpSourceRule{name: "regexp/no-empty-capturing-group", check: regexpHasEmptyCapturingGroup})
  Register(regexpSourceRule{name: "regexp/no-empty-character-class", check: regexpHasEmptyCharacterClass})
  Register(regexpSourceRule{name: "regexp/no-empty-group", check: regexpHasEmptyGroup})
  Register(regexpSourceRule{name: "regexp/no-empty-lookarounds-assertion", check: regexpHasEmptyLookaround})
  Register(regexpSourceRule{name: "regexp/no-misleading-unicode-character", check: func(parts regexpLiteralParts) bool {
    return regexHasSurrogatePair(parts.raw)
  }})
  Register(regexpSourceRule{name: "regexp/no-useless-character-class", check: regexpHasUselessCharacterClass})
  Register(regexpNoUselessEscapeAlias{})
  Register(regexpSourceRule{name: "regexp/no-useless-flag", check: regexpHasUselessFlag})
  Register(regexpSourceRule{name: "regexp/no-useless-quantifier", check: regexpHasUselessQuantifier})
  Register(regexpSourceRule{name: "regexp/no-useless-two-nums-quantifier", check: regexpHasUselessTwoNumsQuantifier})
  Register(regexpSourceRule{name: "regexp/no-zero-quantifier", check: regexpHasZeroQuantifier})
  Register(regexpSourceRule{name: "regexp/prefer-d", check: regexpHasPreferD})
  Register(regexpSourceRule{name: "regexp/prefer-plus-quantifier", check: regexpHasPlusQuantifierCandidate})
  Register(regexpSourceRule{name: "regexp/prefer-question-quantifier", check: regexpHasQuestionQuantifierCandidate})
  Register(regexpSourceRule{name: "regexp/prefer-star-quantifier", check: regexpHasStarQuantifierCandidate})
  Register(regexpSourceRule{name: "regexp/prefer-w", check: regexpHasPreferW})
  Register(regexpSourceRule{name: "regexp/require-unicode-regexp", check: regexpNeedsUnicodeFlag})
  Register(regexpSourceRule{name: "regexp/require-unicode-sets-regexp", check: regexpNeedsUnicodeSetsFlag})
  Register(regexpSourceRule{name: "regexp/sort-flags", check: regexpFlagsUnsorted})
}
