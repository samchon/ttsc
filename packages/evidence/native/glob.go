package evidence

import (
  "errors"
  "path/filepath"
  "strings"
)

type globSet struct {
  Patterns []globPattern
}

type globPattern struct {
  Raw      string
  Segments []string
  Exclude  bool
}

func newGlobSet(patterns []string) (globSet, error) {
  set := globSet{Patterns: make([]globPattern, 0, len(patterns))}
  positive := false
  for _, raw := range patterns {
    pattern, err := compileGlob(raw)
    if err != nil {
      return globSet{}, err
    }
    if !pattern.Exclude {
      positive = true
    }
    set.Patterns = append(set.Patterns, pattern)
  }
  if !positive {
    return globSet{}, errors.New("the files array must contain at least one positive glob")
  }
  return set, nil
}

func compileGlob(raw string) (globPattern, error) {
  if strings.TrimSpace(raw) == "" {
    return globPattern{}, errors.New("glob strings must not be empty")
  }
  exclude := strings.HasPrefix(raw, "!")
  value := raw
  if exclude {
    value = strings.TrimPrefix(value, "!")
  }
  value = strings.ReplaceAll(value, "\\", "/")
  for strings.HasPrefix(value, "./") {
    value = strings.TrimPrefix(value, "./")
  }
  if value == "" {
    if exclude && strings.TrimPrefix(raw, "!") == "" {
      return globPattern{}, errors.New("the exclusion marker '!' must be followed by a glob")
    }
    return globPattern{}, errors.New("glob '" + raw + "' names no path below the project root")
  }
  if filepath.IsAbs(value) ||
    hasWindowsDrivePrefix(value) ||
    strings.HasPrefix(value, "/") {
    return globPattern{}, errors.New("glob '" + raw + "' is absolute; every files pattern must be project-relative")
  }
  value = strings.TrimSuffix(value, "/")
  segments := strings.Split(value, "/")
  for _, segment := range segments {
    if segment == "" {
      return globPattern{}, errors.New("glob '" + raw + "' contains an empty path segment")
    }
    if segment == ".." {
      return globPattern{}, errors.New("glob '" + raw + "' escapes the project root through '..'")
    }
  }
  return globPattern{Raw: raw, Segments: segments, Exclude: exclude}, nil
}

func hasWindowsDrivePrefix(value string) bool {
  if len(value) < 2 || value[1] != ':' {
    return false
  }
  letter := value[0]
  return (letter >= 'A' && letter <= 'Z') ||
    (letter >= 'a' && letter <= 'z')
}

func (set globSet) matches(path string) bool {
  segments := splitProjectPath(path)
  included := false
  for _, pattern := range set.Patterns {
    if !matchGlobSegments(pattern.Segments, segments) {
      continue
    }
    if pattern.Exclude {
      included = false
    } else {
      included = true
    }
  }
  return included
}

func (set globSet) couldMatchDescendant(directory string) bool {
  prefix := splitProjectPath(directory)
  for _, pattern := range set.Patterns {
    if pattern.Exclude || !couldMatchGlobBelow(pattern.Segments, prefix) {
      continue
    }
    return true
  }
  return false
}

func couldMatchGlobBelow(pattern []string, prefix []string) bool {
  type state struct{ pattern, prefix int }
  memo := map[state]bool{}
  known := map[state]bool{}
  var match func(int, int) bool
  match = func(patternIndex int, prefixIndex int) bool {
    key := state{pattern: patternIndex, prefix: prefixIndex}
    if known[key] {
      return memo[key]
    }
    known[key] = true
    result := false
    switch {
    case prefixIndex == len(prefix):
      result = patternIndex < len(pattern)
    case patternIndex == len(pattern):
      result = false
    case pattern[patternIndex] == "**":
      result = match(patternIndex+1, prefixIndex) ||
        match(patternIndex, prefixIndex+1)
    case matchGlobSegment(pattern[patternIndex], prefix[prefixIndex]):
      result = match(patternIndex+1, prefixIndex+1)
    }
    memo[key] = result
    return result
  }
  return match(0, 0)
}

func splitProjectPath(value string) []string {
  value = strings.ReplaceAll(value, "\\", "/")
  for strings.HasPrefix(value, "./") {
    value = strings.TrimPrefix(value, "./")
  }
  value = strings.Trim(value, "/")
  if value == "" {
    return nil
  }
  return strings.Split(value, "/")
}

func matchGlobSegments(pattern []string, path []string) bool {
  type state struct{ pattern, path int }
  memo := map[state]bool{}
  known := map[state]bool{}
  var match func(int, int) bool
  match = func(patternIndex int, pathIndex int) bool {
    key := state{pattern: patternIndex, path: pathIndex}
    if known[key] {
      return memo[key]
    }
    known[key] = true
    result := false
    switch {
    case patternIndex == len(pattern):
      result = pathIndex == len(path)
    case pattern[patternIndex] == "**":
      result = match(patternIndex+1, pathIndex)
      if !result && pathIndex < len(path) {
        result = match(patternIndex, pathIndex+1)
      }
    case pathIndex < len(path) && matchGlobSegment(pattern[patternIndex], path[pathIndex]):
      result = match(patternIndex+1, pathIndex+1)
    }
    memo[key] = result
    return result
  }
  return match(0, 0)
}

func matchGlobSegment(pattern string, value string) bool {
  patternRunes := []rune(pattern)
  valueRunes := []rune(value)
  patternIndex := 0
  valueIndex := 0
  starPattern := -1
  starValue := 0
  for valueIndex < len(valueRunes) {
    switch {
    case patternIndex < len(patternRunes) && patternRunes[patternIndex] == '*':
      starPattern = patternIndex
      starValue = valueIndex
      patternIndex++
    case patternIndex < len(patternRunes) &&
      (patternRunes[patternIndex] == '?' || patternRunes[patternIndex] == valueRunes[valueIndex]):
      patternIndex++
      valueIndex++
    case starPattern >= 0:
      patternIndex = starPattern + 1
      starValue++
      valueIndex = starValue
    default:
      return false
    }
  }
  for patternIndex < len(patternRunes) && patternRunes[patternIndex] == '*' {
    patternIndex++
  }
  return patternIndex == len(patternRunes)
}
