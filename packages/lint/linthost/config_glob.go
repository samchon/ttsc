package linthost

import (
  "path/filepath"
  "runtime"
  "strings"
  "unicode/utf8"
)

// matchGlob preserves brace expansion before path splitting and native glob
// tokenization. Alternatives share their continuations instead of producing a
// Cartesian product of strings. All graph and matching state belongs to this
// call; no filesystem observation or result survives it.
func matchGlob(pattern, name string) bool {
  pattern = strings.Trim(pattern, "/")
  name = strings.Trim(name, "/")
  if pattern == "" {
    return name == ""
  }
  if !strings.Contains(pattern, "{") {
    return matchConfigGlobNative(pattern, name)
  }
  graph := compileConfigGlob(pattern)
  return graph.matches(name)
}

// matchConfigGlobNative leaves ordinary components with filepath.Match. Only
// multiple globstars need path-state memoization. With at most one globstar,
// path lengths fix the component alignment without any visited-state map.
func matchConfigGlobNative(pattern, name string) bool {
  patternParts := strings.Split(pattern, "/")
  nameParts := []string{}
  if name != "" { nameParts = strings.Split(name, "/") }
  globstar := -1
  for index, part := range patternParts {
    if part == "**" {
      if globstar >= 0 {
        matcher := configGlobNativeMatcher{pattern: patternParts, name: nameParts, states: make(map[[2]int]bool)}
        return matcher.matches(0, 0)
      }
      globstar = index
    }
  }
  offset := len(nameParts)-len(patternParts)
  if globstar < 0 && offset != 0 || globstar >= 0 && offset < -1 { return false }
  for index, part := range patternParts {
    if index == globstar { continue }
    nameIndex := index
    if globstar >= 0 && index > globstar { nameIndex += offset }
    matched, err := filepath.Match(part, nameParts[nameIndex])
    if err != nil || !matched { return false }
  }
  return true
}

// configGlobNativeMatcher retains at most (pattern components+1) times (name
// components+1) results for one call. Every transition advances a pattern or
// name index, so interleaved globstars cannot revisit an evaluated partition.
type configGlobNativeMatcher struct {
  pattern []string
  name []string
  states map[[2]int]bool
}

func (m *configGlobNativeMatcher) matches(pattern, name int) bool {
  key := [2]int{pattern, name}
  if matched, ok := m.states[key]; ok { return matched }
  matched := false
  if pattern == len(m.pattern) {
    matched = name == len(m.name)
  } else if m.pattern[pattern] == "**" {
    matched = m.matches(pattern+1, name) || name < len(m.name) && m.matches(pattern, name+1)
  } else if name < len(m.name) {
    ok, err := filepath.Match(m.pattern[pattern], m.name[name])
    matched = err == nil && ok && m.matches(pattern+1, name+1)
  }
  m.states[key] = matched
  return matched
}

// configGlob is an acyclic representation of the concrete strings a selector
// denotes. Node zero accepts; byte nodes consume one pattern byte, and forks
// consume none. Brace alternatives point at the same suffix.
type configGlob struct {
  nodes []configGlobNode
  start int
  heads map[int]configGlobHead
  runes map[configGlobEdge][]configGlobRune
}

type configGlobNode struct {
  value byte
  next int
  branches []int
}

type configGlobEdge struct {
  node int
  value byte
  next int
}

type configGlobHead struct {
  end bool
  edges []configGlobEdge
}

func compileConfigGlob(pattern string) *configGlob {
  graph := &configGlob{nodes: []configGlobNode{{}}, heads: make(map[int]configGlobHead), runes: make(map[configGlobEdge][]configGlobRune)}
  closes := make([]int, len(pattern))
  opens := []int{}
  for index := range closes {
    closes[index] = -1
    switch pattern[index] {
    case '{':
      opens = append(opens, index)
    case '}':
      if len(opens) > 0 {
        open := opens[len(opens)-1]
        opens = opens[:len(opens)-1]
        closes[open] = index
      }
    }
  }
  var build func(int, int, int) int
  literal := func(start, end, next int) int {
    for index := end-1; index >= start; index-- {
      graph.nodes = append(graph.nodes, configGlobNode{value: pattern[index], next: next})
      next = len(graph.nodes)-1
    }
    return next
  }
  build = func(start, end, next int) int {
    relative := strings.IndexByte(pattern[start:end], '{')
    if relative < 0 {
      return literal(start, end, next)
    }
    open := start+relative
    close := closes[open]
    if close < 0 || close >= end {
      // The first unmatched opening brace makes the remaining text literal,
      // including any later otherwise balanced brace groups.
      return literal(start, end, next)
    }
    suffix := build(close+1, end, next)
    branches := []int{}
    alternative := open+1
    for index := alternative; index < close; index++ {
      if pattern[index] == '{' {
        index = closes[index]
      } else if pattern[index] == ',' {
        branches = append(branches, build(alternative, index, suffix))
        alternative = index+1
      }
    }
    branches = append(branches, build(alternative, close, suffix))
    graph.nodes = append(graph.nodes, configGlobNode{branches: branches})
    return literal(start, open, len(graph.nodes)-1)
  }
  graph.start = build(0, len(pattern), 0)
  return graph
}

// head skips only epsilon forks. Memoization and duplicate elimination keep
// repeated empty alternatives from multiplying the following transitions.
func (g *configGlob) head(node int) configGlobHead {
  if cached, ok := g.heads[node]; ok {
    return cached
  }
  result := configGlobHead{end: node == 0}
  if node != 0 {
    current := g.nodes[node]
    if current.branches == nil {
      result.edges = []configGlobEdge{{node, current.value, current.next}}
    } else {
      seen := make(map[configGlobEdge]bool)
      for _, branch := range current.branches {
        head := g.head(branch)
        result.end = result.end || head.end
        for _, edge := range head.edges {
          if !seen[edge] {
            seen[edge] = true
            result.edges = append(result.edges, edge)
          }
        }
      }
    }
  }
  g.heads[node] = result
  return result
}

type configGlobPosition struct {
  node int
  part int
  offset int
  boundary bool
  globstar bool
}

// configGlobMatcher owns one intersection and releases its visited states with
// the call. The graph is selector syntax only; no result is cached across paths
// or filesystem observations.
type configGlobMatcher struct {
  graph *configGlob
  parts []string
  pending []configGlobPosition
  seen map[configGlobPosition]bool
  classes map[configGlobClassKey][]int
}

func newConfigGlobMatcher(graph *configGlob, name string) *configGlobMatcher {
  matcher := &configGlobMatcher{graph: graph, seen: make(map[configGlobPosition]bool), classes: make(map[configGlobClassKey][]int)}
  if name != "" {
    matcher.parts = strings.Split(name, "/")
  }
  matcher.enqueue(configGlobPosition{node: graph.start, boundary: true})
  return matcher
}

func (m *configGlobMatcher) enqueue(position configGlobPosition) {
  if !m.seen[position] {
    m.seen[position] = true
    m.pending = append(m.pending, position)
  }
}

// matches intersects the compact pattern with the supplied path. Each graph,
// path component, byte offset and boundary tuple is processed once. Globstars
// use zero/one-component transitions instead of retrying all path partitions.
// Native component tokens retain filepath.Match's byte literals, rune classes
// and question marks, and platform-specific backslash/separator behavior.
func (g *configGlob) matches(name string) bool {
  return newConfigGlobMatcher(g, name).matches()
}

func (m *configGlobMatcher) matches() bool {
  g, parts := m.graph, m.parts
  enqueue := m.enqueue
  for len(m.pending) > 0 {
    position := m.pending[len(m.pending)-1]
    m.pending = m.pending[:len(m.pending)-1]
    head := g.head(position.node)
    if position.globstar {
      zero := position
      zero.globstar = false
      enqueue(zero)
      if position.part < len(parts) {
        position.part++
        enqueue(position)
      }
      continue
    }
    if position.boundary {
      // An exact whole-component ** can itself be assembled by braces.
      for _, first := range head.edges {
        if first.value != '*' { continue }
        for _, second := range g.head(first.next).edges {
          if second.value != '*' { continue }
          tail := g.head(second.next)
          if tail.end { return true }
          for _, edge := range tail.edges {
            if edge.value == '/' {
              enqueue(configGlobPosition{node: edge.next, part: position.part, boundary: true, globstar: true})
            }
          }
        }
      }
      if position.part < len(parts) {
        position.boundary = false
        enqueue(position)
      }
      continue
    }
    part := parts[position.part]
    if head.end && position.offset == len(part) && position.part == len(parts)-1 {
      return true
    }
    for _, edge := range head.edges {
      next := configGlobPosition{node: edge.next, part: position.part, offset: position.offset}
      switch edge.value {
      case '/':
        if position.offset == len(part) {
          enqueue(configGlobPosition{node: edge.next, part: position.part+1, boundary: true})
        }
      case '*':
        enqueue(next)
        if position.offset < len(part) && part[position.offset] != filepath.Separator {
          positionCopy := position
          positionCopy.node = edge.node
          positionCopy.offset++
          enqueue(positionCopy)
        }
      case '?':
        if position.offset < len(part) && part[position.offset] != filepath.Separator {
          _, width := utf8.DecodeRuneInString(part[position.offset:])
          next.offset += width
          enqueue(next)
        }
      case '[':
        if position.offset < len(part) {
          value, width := utf8.DecodeRuneInString(part[position.offset:])
          key := configGlobClassKey{node: edge.next, value: value}
          ends, ok := m.classes[key]
          if !ok {
            ends = g.classEnds(edge.next, value)
            m.classes[key] = ends
          }
          for _, end := range ends {
            next.node = end
            next.offset = position.offset+width
            enqueue(next)
          }
        }
      case '\\':
        if runtime.GOOS != "windows" {
          for _, escaped := range g.head(edge.next).edges {
            if escaped.value != '/' && position.offset < len(part) && part[position.offset] == escaped.value {
              next.node = escaped.next
              next.offset++
              enqueue(next)
              next.offset--
            }
          }
          continue
        }
        fallthrough
      default:
        if position.offset < len(part) && part[position.offset] == edge.value {
          next.offset++
          enqueue(next)
        }
      }
    }
  }
  return false
}

type configGlobClassKey struct {
  node int
  value rune
}

type configGlobClassPosition struct {
  node int
  stage configGlobClassStage
  negated bool
  matched bool
  hasRange bool
  lowerMatches bool
  lowerAtMost bool
}

type configGlobClassStage uint8

const (
  configGlobClassInitial configGlobClassStage = iota
  configGlobClassRange
  configGlobClassLower
  configGlobClassUpper
)

// classEnds interprets bracket syntax across alternative boundaries. Its state
// retains only parser flags and the pending endpoint's comparison with value;
// complete class spellings are never enumerated. Invalid paths have no accepting
// transition and cannot suppress a valid sibling alternative.
func (g *configGlob) classEnds(start int, value rune) []int {
  pending := []configGlobClassPosition{{node: start}}
  seen := make(map[configGlobClassPosition]bool)
  ends := make(map[int]bool)
  for len(pending) > 0 {
    position := pending[len(pending)-1]
    pending = pending[:len(pending)-1]
    if seen[position] { continue }
    seen[position] = true
    head := g.head(position.node)
    if position.stage == configGlobClassLower {
      // Without a hyphen the lower endpoint is a singleton range. The normal
      // range-start phase rejects a leading hyphen, so this transition cannot
      // accidentally also interpret a range separator as a literal.
      singleton := position
      singleton.stage = configGlobClassRange
      singleton.lowerMatches, singleton.lowerAtMost = false, false
      singleton.hasRange = true
      singleton.matched = singleton.matched || position.lowerMatches
      pending = append(pending, singleton)
    }
    for _, edge := range head.edges {
      if edge.value == '/' { continue }
      if position.stage == configGlobClassInitial && edge.value == '^' {
        next := position
        next.node, next.stage, next.negated = edge.next, configGlobClassRange, true
        pending = append(pending, next)
        continue
      }
      if position.stage == configGlobClassRange && position.hasRange && edge.value == ']' {
        if position.matched != position.negated { ends[edge.next] = true }
        continue
      }
      if position.stage == configGlobClassLower {
        if edge.value == '-' {
          next := position
          next.node, next.stage = edge.next, configGlobClassUpper
          pending = append(pending, next)
        }
        continue
      }
      for _, parsed := range g.classRune(edge) {
        next := position
        next.node = parsed.node
        if position.stage == configGlobClassUpper {
          next.stage, next.hasRange = configGlobClassRange, true
          next.lowerMatches, next.lowerAtMost = false, false
          next.matched = next.matched || position.lowerAtMost && value <= parsed.value
        } else {
          next.stage = configGlobClassLower
          next.lowerMatches, next.lowerAtMost = parsed.value == value, parsed.value <= value
        }
        pending = append(pending, next)
      }
    }
  }
  result := make([]int, 0, len(ends))
  for end := range ends { result = append(result, end) }
  return result
}

type configGlobRune struct {
  node int
  value rune
}

// classRune follows filepath.Match's getEsc grammar. UTF-8 decoding consumes at
// most four pattern bytes, even when brace boundaries split their spelling.
func (g *configGlob) classRune(edge configGlobEdge) []configGlobRune {
  if cached, ok := g.runes[edge]; ok { return cached }
  if edge.value == '-' || edge.value == ']' {
    g.runes[edge] = nil
    return nil
  }
  edges := []configGlobEdge{edge}
  if edge.value == '\\' && runtime.GOOS != "windows" {
    edges = g.head(edge.next).edges
  }
  type prefix struct {
    bytes [utf8.UTFMax]byte
    length int
    node int
  }
  pending := []prefix{}
  for _, first := range edges {
    if first.value != '/' {
      pending = append(pending, prefix{bytes: [utf8.UTFMax]byte{first.value}, length: 1, node: first.next})
    }
  }
  result := []configGlobRune{}
  seen := make(map[prefix]bool)
  for len(pending) > 0 {
    current := pending[len(pending)-1]
    pending = pending[:len(pending)-1]
    if seen[current] { continue }
    seen[current] = true
    raw := current.bytes[:current.length]
    if utf8.FullRune(raw) {
      value, width := utf8.DecodeRune(raw)
      if value != utf8.RuneError || width != 1 {
        result = append(result, configGlobRune{current.node, value})
      }
      continue
    }
    if current.length == utf8.UTFMax { continue }
    for _, next := range g.head(current.node).edges {
      if next.value == '/' { continue }
      extended := current
      extended.bytes[extended.length] = next.value
      extended.length++
      extended.node = next.next
      pending = append(pending, extended)
    }
  }
  g.runes[edge] = result
  return result
}
