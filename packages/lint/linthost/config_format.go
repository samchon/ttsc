package linthost

import (
  "encoding/json"
  "fmt"
  "strings"
)

// expandFormatBlock translates a Prettier-style `format` block into the
// per-rule severity + options shape the existing rule parsers consume.
// The result is a `map[string]any` that mirrors what a user would
// have written under `rules` directly, entries like
// `"format/semi": ["off", {"prefer": "always"}]`, so the caller
// can route it through either `ParseRulesWithOptions` or
// `parseExternalRuleMapInto` without duplicating option-decoding logic.
//
// The block's default severity is off. That keeps check/build diagnostics
// independent from formatting policy unless the user explicitly sets
// `format.severity`; the options still exist so `ttsc format` can apply the
// formatter from the same config block.
//
// The block's enablement matrix:
//
//   - `format/semi`, always on. `semi: false` flips to `prefer: "never"`.
//   - `format/quotes`, always on. `singleQuote: true` flips to `prefer: "single"`.
//   - `format/arrow-parens`, always on. `arrowParens: "avoid"` strips a single bare-identifier arrow parameter's parens; default "always" adds them.
//   - `format/bracket-spacing`, always on. `bracketSpacing: false` removes the inner space of single-line object/destructure/import/export/type braces; default true keeps it.
//   - `format/quote-props`, always on. `quoteProps: "as-needed"` (default) unquotes identifier object keys; "consistent" keeps all keys quoted when any needs it; "preserve" leaves quoting alone.
//   - `format/trailing-comma`, always on with the requested mode.
//   - `format/print-width`, always on, driven by printWidth/tabWidth/useTabs/endOfLine.
//   - `format/clause-join`, always on, joins a single-statement clause body that fits printWidth.
//   - `format/declaration-header`, always on, reflows a class/interface header's type params and heritage clauses.
//   - `format/ternary-nullish-parens`, always on, parenthesizes a `??` operand of a conditional expression.
//   - `format/orphan-semi`, always on; under semi:false, merges a leading-semicolon ASI guard onto its statement.
//   - `format/parameter-properties`, always on, breaks a constructor's parameter list when it has parameter properties.
//   - `format/statement-split`, always on, driven by tabWidth/useTabs/endOfLine.
//   - `format/indent`, always on, driven by tabWidth/useTabs/endOfLine.
//   - `format/whitespace`, always on, driven by endOfLine.
//   - `format/sort-imports`, opt-in by setting `sortImports`.
//   - `format/jsdoc`, always-on; `jsDoc: false` opts out, an object customizes.
//
// The returned map is the raw form rules parsers expect. Callers MUST
// merge any user-supplied `rules` map on top of this one (rules-wins
// semantics) before invoking the existing parsers, `mergeRuleMaps`
// below performs the merge with the right precedence.
func expandFormatBlock(raw map[string]any) (map[string]any, error) {
  if raw == nil {
    return map[string]any{}, nil
  }
  if err := rejectUnknownFormatKeys(raw); err != nil {
    return nil, err
  }
  severity, err := formatBlockSeverity(raw)
  if err != nil {
    return nil, err
  }
  ruleEntry := func(options map[string]any) []any {
    return []any{severity.String(), options}
  }
  out := map[string]any{}

  // formatSemi
  semiPrefer := "always"
  if v, ok := raw["semi"]; ok {
    b, err := asBool("format.semi", v)
    if err != nil {
      return nil, err
    }
    if !b {
      semiPrefer = "never"
    }
  }
  out["format/semi"] = ruleEntry(map[string]any{"prefer": semiPrefer})

  // formatOrphanSemi, always on; mirrors the effective semi setting so
  // it only merges the leading-semicolon ASI guard under semi:false.
  out["format/orphan-semi"] = ruleEntry(map[string]any{"semi": semiPrefer == "always"})

  // formatQuotes
  quotesPrefer := "double"
  if v, ok := raw["singleQuote"]; ok {
    b, err := asBool("format.singleQuote", v)
    if err != nil {
      return nil, err
    }
    if b {
      quotesPrefer = "single"
    }
  }
  out["format/quotes"] = ruleEntry(map[string]any{"prefer": quotesPrefer})

  // formatArrowParens, always on. Mirrors Prettier's arrowParens; the
  // default "always" parenthesizes a single bare-identifier arrow parameter,
  // "avoid" strips the parens.
  arrowPrefer := "always"
  if v, ok := raw["arrowParens"]; ok {
    s, err := asString("format.arrowParens", v)
    if err != nil {
      return nil, err
    }
    switch s {
    case "always", "avoid":
      arrowPrefer = s
    default:
      return nil, fmt.Errorf("@ttsc/lint: format.arrowParens must be \"always\" or \"avoid\"; got %q", s)
    }
  }
  out["format/arrow-parens"] = ruleEntry(map[string]any{"prefer": arrowPrefer})

  // formatBracketSpacing, always on. Mirrors Prettier's bracketSpacing;
  // the default true pads single-line object/destructure/import/export/type
  // braces with one inner space, false removes it.
  bracketSpacing := true
  if v, ok := raw["bracketSpacing"]; ok {
    b, err := asBool("format.bracketSpacing", v)
    if err != nil {
      return nil, err
    }
    bracketSpacing = b
  }
  out["format/bracket-spacing"] = ruleEntry(map[string]any{"spacing": bracketSpacing})

  // formatQuoteProps, always on. Mirrors Prettier's quoteProps; the default
  // "as-needed" unquotes object keys that are valid identifiers, "consistent"
  // keeps every key quoted when any one needs it, "preserve" leaves quoting
  // untouched.
  quoteProps := "as-needed"
  if v, ok := raw["quoteProps"]; ok {
    s, err := asString("format.quoteProps", v)
    if err != nil {
      return nil, err
    }
    switch s {
    case "as-needed", "consistent", "preserve":
      quoteProps = s
    default:
      return nil, fmt.Errorf("@ttsc/lint: format.quoteProps must be \"as-needed\", \"consistent\", or \"preserve\"; got %q", s)
    }
  }
  out["format/quote-props"] = ruleEntry(map[string]any{"mode": quoteProps})

  // formatTrailingComma
  tcMode := "all"
  if v, ok := raw["trailingComma"]; ok {
    s, err := asString("format.trailingComma", v)
    if err != nil {
      return nil, err
    }
    switch s {
    case "all", "es5", "none":
      tcMode = s
    default:
      return nil, fmt.Errorf("@ttsc/lint: format.trailingComma must be \"all\", \"es5\", or \"none\"; got %q", s)
    }
  }
  out["format/trailing-comma"] = ruleEntry(map[string]any{"mode": tcMode})

  // formatPrintWidth
  //
  // `trailingComma` is mirrored into the print-width rule's options so
  // the printer's broken-list reflow emits the same trailing-comma
  // shape `format/trailing-comma` does. Without the mirror the two
  // rules disagree on `es5` / `none` projects and oscillate on every
  // cascade pass, the trailing-comma rule says "no comma" while the
  // printer adds one back. See `printArgList` in print_nodes_call.go.
  layoutOpts, err := collectLayoutOpts(raw)
  if err != nil {
    return nil, err
  }
  pwOpts := cloneStringAnyMap(layoutOpts)
  pwOpts["trailingComma"] = tcMode
  if v, ok := raw["printWidth"]; ok {
    n, err := asInt("format.printWidth", v)
    if err != nil {
      return nil, err
    }
    if n < 1 {
      return nil, fmt.Errorf("@ttsc/lint: format.printWidth must be a positive integer; got %d", n)
    }
    pwOpts["printWidth"] = n
  }
  out["format/print-width"] = ruleEntry(pwOpts)

  // formatClauseJoin, always on. Reuses the printWidth/tabWidth/useTabs
  // budget so it only joins a single-statement clause body back onto its
  // header when the joined line fits. A distinct map instance so it does
  // not alias the print-width blob.
  out["format/clause-join"] = ruleEntry(cloneStringAnyMap(pwOpts))

  // formatDeclarationHeader, always on. Reflows a class/interface header
  // (type parameters + heritage clauses) to Prettier's break shapes;
  // needs the same printWidth/tabWidth/useTabs budget.
  out["format/declaration-header"] = ruleEntry(cloneStringAnyMap(pwOpts))

  // formatTernaryNullishParens, always on, no options: wraps a `??`
  // operand of a conditional expression in parentheses (Prettier 3).
  out["format/ternary-nullish-parens"] = ruleEntry(map[string]any{})

  // formatStatementSplit + formatIndent, always on, Prettier-style.
  // Both reuse the indentation/EOL settings to synthesize line breaks
  // and indent strings. Only the keys the user actually set are mirrored
  // in (same conditional shape as print-width's pwOpts), so defaults are
  // applied rule-side. The two rules share the same option surface
  // collected once into layoutOpts above.
  //
  // Distinct map instances so the two rule entries don't alias one blob.
  out["format/statement-split"] = ruleEntry(cloneStringAnyMap(layoutOpts))
  out["format/indent"] = ruleEntry(cloneStringAnyMap(layoutOpts))

  // formatParameterProperties, always on. Force-breaks a constructor's
  // parameter list when it declares parameter properties; needs only the
  // indentation settings.
  out["format/parameter-properties"] = ruleEntry(cloneStringAnyMap(layoutOpts))

  // formatWhitespace, always on. Needs only endOfLine for the final
  // newline; indentation is irrelevant to text hygiene.
  wsOpts := map[string]any{}
  if v, ok := layoutOpts["endOfLine"]; ok {
    wsOpts["endOfLine"] = v
  }
  out["format/whitespace"] = ruleEntry(wsOpts)

  // formatSortImports, opt-in by `sortImports` (a boolean or options object).
  if v, ok := raw["sortImports"]; ok && v != nil {
    siOpts, enabled, err := expandSortImportsBlock(v)
    if err != nil {
      return nil, err
    }
    if enabled {
      out["format/sort-imports"] = ruleEntry(siOpts)
    }
  }

  // formatJsdoc, always-on. `jsDoc: false` opts out; a
  // `{ tagSynonyms, sortTags }` object customizes it. The config key is
  // camelCased (jsDoc) to match the other multi-word keys; the emitted rule id
  // stays `format/jsdoc`.
  //
  // Today the rule only rewrites tag synonyms (@return → @returns, ...); tag
  // sorting, column alignment, and wrapping are on the roadmap. It is on by
  // default so JSDoc tag names normalize without opt-in, matching the rest of
  // the always-on format set.
  jdOpts := map[string]any{}
  jdEnabled := true
  if v, ok := raw["jsDoc"]; ok && v != nil {
    switch j := v.(type) {
    case bool:
      jdEnabled = j
    case map[string]any:
      for key, val := range j {
        switch key {
        case "tagSynonyms":
          ts, ok := val.(map[string]any)
          if !ok {
            return nil, fmt.Errorf("@ttsc/lint: format.jsDoc.tagSynonyms must be an object, got %T", val)
          }
          // Element values must be strings; surface
          // typos early instead of after a downstream
          // JSON-decode failure.
          for k, v := range ts {
            if _, ok := v.(string); !ok {
              return nil, fmt.Errorf("@ttsc/lint: format.jsDoc.tagSynonyms[%q] must be a string, got %T", k, v)
            }
          }
          jdOpts["tagSynonyms"] = ts
        case "sortTags":
          b, err := asBool("format.jsDoc.sortTags", val)
          if err != nil {
            return nil, err
          }
          jdOpts["sortTags"] = b
        default:
          return nil, fmt.Errorf("@ttsc/lint: format.jsDoc unknown key %q (allowed: tagSynonyms, sortTags)", key)
        }
      }
    default:
      return nil, fmt.Errorf("@ttsc/lint: format.jsDoc must be a boolean or object, got %T", v)
    }
  }
  if jdEnabled {
    out["format/jsdoc"] = ruleEntry(jdOpts)
  }

  return out, nil
}

// expandSortImportsBlock translates the `format.sortImports` value (a boolean
// or an options object) into the rule's option map. The bool reports whether
// the rule is enabled: `true` and any object enable it, `false` keeps it off.
func expandSortImportsBlock(v any) (map[string]any, bool, error) {
  switch sv := v.(type) {
  case bool:
    return map[string]any{}, sv, nil
  case map[string]any:
    opts := map[string]any{}
    for key, val := range sv {
      switch key {
      case "order":
        order, err := asStringSlice("format.sortImports.order", val)
        if err != nil {
          return nil, false, err
        }
        if len(order) == 0 {
          return nil, false, fmt.Errorf("@ttsc/lint: format.sortImports.order must contain at least one entry; omit it to use the default order")
        }
        opts["order"] = order
      case "caseSensitive":
        b, err := asBool("format.sortImports.caseSensitive", val)
        if err != nil {
          return nil, false, err
        }
        opts["caseSensitive"] = b
      case "combineTypeAndValue":
        b, err := asBool("format.sortImports.combineTypeAndValue", val)
        if err != nil {
          return nil, false, err
        }
        opts["combineTypeAndValue"] = b
      case "unsafeSortRuntimeImports":
        b, err := asBool("format.sortImports.unsafeSortRuntimeImports", val)
        if err != nil {
          return nil, false, err
        }
        opts["unsafeSortRuntimeImports"] = b
      default:
        return nil, false, fmt.Errorf("@ttsc/lint: format.sortImports unknown key %q (allowed: order, caseSensitive, combineTypeAndValue, unsafeSortRuntimeImports)", key)
      }
    }
    return opts, true, nil
  default:
    return nil, false, fmt.Errorf("@ttsc/lint: format.sortImports must be a boolean or object, got %T", v)
  }
}

// formatBlockSeverity extracts the optional `severity` field from a format
// block. Defaults to SeverityOff so that format rules never produce check/build
// diagnostics unless the user explicitly opts in. SeverityOff still allows
// `ttsc format` to apply formatting; it only suppresses error/warning output.
func formatBlockSeverity(raw map[string]any) (Severity, error) {
  value, ok := raw["severity"]
  if !ok || value == nil {
    return SeverityOff, nil
  }
  severity, err := parseSeverity(value)
  if err != nil {
    return SeverityOff, fmt.Errorf("@ttsc/lint: format.severity: %w", err)
  }
  return severity, nil
}

// isFormatRuleName reports whether `name` is a formatter rule id. Such
// rules are configured exclusively through the `format` block; a `format/*`
// key in the user's `rules` map is dropped before the merge, so the config
// layer never carries a formatter setting in two places.
func isFormatRuleName(name string) bool {
  return strings.HasPrefix(name, "format/")
}

// mergeRuleMaps overlays `overrides` on `base` and returns the merged
// map. Identical keys in `overrides` replace the entire entry from
// `base`; option objects are NOT deep-merged. `overrides` (the user's
// `rules` map) never contains a `format/*` key, those are dropped before
// the merge, so the merge only ever layers lint-rule severities on top of
// the format block's expanded entries.
func mergeRuleMaps(base, overrides map[string]any) map[string]any {
  out := make(map[string]any, len(base)+len(overrides))
  for k, v := range base {
    out[k] = v
  }
  for k, v := range overrides {
    out[k] = v
  }
  return out
}

// cloneStringAnyMap returns a shallow copy of `m`. expandFormatBlock uses
// it so `format/statement-split` and `format/indent` each receive their
// own options blob rather than aliasing one shared map, a later mutation
// or marshal of one entry then cannot leak into the other.
func cloneStringAnyMap(m map[string]any) map[string]any {
  out := make(map[string]any, len(m))
  for k, v := range m {
    out[k] = v
  }
  return out
}

// collectLayoutOpts parses the shared tabWidth/useTabs/endOfLine layout
// fields from a format block once. Only keys the user actually set are
// emitted, so rule-side defaults still apply for absent fields. Both the
// print-width blob (which adds trailingComma + printWidth) and the
// statement-split/indent/parameter-properties entries derive from this
// single source so their parse-and-validate logic stays in one place.
func collectLayoutOpts(raw map[string]any) (map[string]any, error) {
  layoutOpts := map[string]any{}
  if v, ok := raw["tabWidth"]; ok {
    n, err := asInt("format.tabWidth", v)
    if err != nil {
      return nil, err
    }
    if n < 1 {
      return nil, fmt.Errorf("@ttsc/lint: format.tabWidth must be a positive integer; got %d", n)
    }
    layoutOpts["tabWidth"] = n
  }
  if v, ok := raw["useTabs"]; ok {
    b, err := asBool("format.useTabs", v)
    if err != nil {
      return nil, err
    }
    layoutOpts["useTabs"] = b
  }
  if v, ok := raw["endOfLine"]; ok {
    s, err := asString("format.endOfLine", v)
    if err != nil {
      return nil, err
    }
    if s != "lf" && s != "crlf" {
      return nil, fmt.Errorf("@ttsc/lint: format.endOfLine must be \"lf\" or \"crlf\"; got %q", s)
    }
    layoutOpts["endOfLine"] = s
  }
  return layoutOpts, nil
}

// asBool coerces a raw config value to a bool, returning a typed error on
// failure. Used by expandFormatBlock to validate boolean format fields.
func asBool(field string, v any) (bool, error) {
  if b, ok := v.(bool); ok {
    return b, nil
  }
  return false, fmt.Errorf("@ttsc/lint: %s must be a boolean, got %T", field, v)
}

// asString coerces a raw config value to a string, returning a typed error on
// failure. Used by expandFormatBlock to validate string format fields.
func asString(field string, v any) (string, error) {
  if s, ok := v.(string); ok {
    return s, nil
  }
  return "", fmt.Errorf("@ttsc/lint: %s must be a string, got %T", field, v)
}

// asInt coerces a raw config value to an int. Accepts all integer-shaped Go
// numeric types plus float64 (the default JSON decode type) and json.Number,
// rejecting fractional float64 values since no format option takes a non-integer.
func asInt(field string, v any) (int, error) {
  switch n := v.(type) {
  case int:
    return n, nil
  case int32:
    return int(n), nil
  case int64:
    return int(n), nil
  case float64:
    // JSON numbers decode as float64; coerce when integer-valued.
    if float64(int(n)) == n {
      return int(n), nil
    }
  case json.Number:
    i, err := n.Int64()
    if err == nil {
      return int(i), nil
    }
  }
  return 0, fmt.Errorf("@ttsc/lint: %s must be an integer, got %T", field, v)
}

// asStringSlice coerces a raw config value to a []string, returning a typed
// error on failure. Used by expandFormatBlock to validate sortImports.order.
func asStringSlice(field string, v any) ([]string, error) {
  arr, ok := v.([]any)
  if !ok {
    return nil, fmt.Errorf("@ttsc/lint: %s must be an array of strings, got %T", field, v)
  }
  out := make([]string, 0, len(arr))
  for i, item := range arr {
    s, ok := item.(string)
    if !ok {
      return nil, fmt.Errorf("@ttsc/lint: %s[%d] must be a string, got %T", field, i, item)
    }
    out = append(out, s)
  }
  return out, nil
}

// rejectUnknownFormatKeys surfaces typos in top-level format-block
// keys at the boundary rather than silently ignoring them. The
// key set mirrors `ITtscLintFormat` exactly.
func rejectUnknownFormatKeys(raw map[string]any) error {
  allowed := map[string]struct{}{
    "severity":       {},
    "semi":           {},
    "singleQuote":    {},
    "arrowParens":    {},
    "bracketSpacing": {},
    "quoteProps":     {},
    "trailingComma":  {},
    "printWidth":     {},
    "tabWidth":       {},
    "useTabs":        {},
    "endOfLine":      {},
    "sortImports":    {},
    "jsDoc":          {},
  }
  for key := range raw {
    if _, ok := allowed[key]; !ok {
      return fmt.Errorf("@ttsc/lint: format unknown key %q; see ITtscLintFormat for the allowed surface", key)
    }
  }
  return nil
}
