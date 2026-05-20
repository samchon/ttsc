package linthost

import (
  "encoding/json"
  "fmt"
)

// expandFormatBlock translates a Prettier-style `format` block into the
// per-rule severity + options shape the existing rule parsers consume.
// The result is a `map[string]any` that mirrors what a user would
// have written under `rules` directly — entries like
// `"format/semi": ["off", {"prefer": "always"}]` — so the caller
// can route it through either `ParseRulesWithOptions` (inline path) or
// `parseExternalRuleMapInto` (flat-config path) without duplicating
// option-decoding logic.
//
// The block's default severity is off. That keeps check/build diagnostics
// independent from formatting policy unless the user explicitly sets
// `format.severity`; the options still exist so `ttsc format` can apply the
// formatter from the same config block.
//
// The block's enablement matrix:
//
//   - `format/semi` — always on. `semi: false` flips to `prefer: "never"`.
//   - `format/quotes` — always on. `singleQuote: true` flips to `prefer: "single"`.
//   - `format/trailing-comma` — always on with the requested mode.
//   - `format/print-width` — always on, driven by printWidth/tabWidth/useTabs/endOfLine.
//   - `format/sort-imports` — opt-in by setting `importOrder`.
//   - `format/jsdoc` — opt-in by setting `jsdoc` truthy.
//
// The returned map is the raw form rules parsers expect. Callers MUST
// merge any user-supplied `rules` map on top of this one (rules-wins
// semantics) before invoking the existing parsers — `mergeRuleMaps`
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

  // format/semi
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

  // format/quotes
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

  // format/trailing-comma
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

  // format/print-width
  pwOpts := map[string]any{}
  if v, ok := raw["printWidth"]; ok {
    n, err := asInt("format.printWidth", v)
    if err != nil {
      return nil, err
    }
    pwOpts["printWidth"] = n
  }
  if v, ok := raw["tabWidth"]; ok {
    n, err := asInt("format.tabWidth", v)
    if err != nil {
      return nil, err
    }
    pwOpts["tabWidth"] = n
  }
  if v, ok := raw["useTabs"]; ok {
    b, err := asBool("format.useTabs", v)
    if err != nil {
      return nil, err
    }
    pwOpts["useTabs"] = b
  }
  if v, ok := raw["endOfLine"]; ok {
    s, err := asString("format.endOfLine", v)
    if err != nil {
      return nil, err
    }
    if s != "lf" && s != "crlf" {
      return nil, fmt.Errorf("@ttsc/lint: format.endOfLine must be \"lf\" or \"crlf\"; got %q", s)
    }
    pwOpts["endOfLine"] = s
  }
  out["format/print-width"] = ruleEntry(pwOpts)

  // format/sort-imports — opt-in by `importOrder`.
  if v, ok := raw["importOrder"]; ok {
    siOpts := map[string]any{}
    order, err := asStringSlice("format.importOrder", v)
    if err != nil {
      return nil, err
    }
    if len(order) == 0 {
      return nil, fmt.Errorf("@ttsc/lint: format.importOrder must contain at least one entry; omit the field to keep format/sort-imports off")
    }
    siOpts["importOrder"] = order
    if x, ok := raw["importOrderSeparation"]; ok {
      b, err := asBool("format.importOrderSeparation", x)
      if err != nil {
        return nil, err
      }
      siOpts["importOrderSeparation"] = b
    }
    if x, ok := raw["importOrderSortSpecifiers"]; ok {
      b, err := asBool("format.importOrderSortSpecifiers", x)
      if err != nil {
        return nil, err
      }
      siOpts["importOrderSortSpecifiers"] = b
    }
    if x, ok := raw["importOrderCaseInsensitive"]; ok {
      b, err := asBool("format.importOrderCaseInsensitive", x)
      if err != nil {
        return nil, err
      }
      siOpts["importOrderCaseInsensitive"] = b
    }
    out["format/sort-imports"] = ruleEntry(siOpts)
  }

  // format/jsdoc — opt-in by `jsdoc` truthy (boolean or object).
  if v, ok := raw["jsdoc"]; ok && v != nil {
    jdOpts := map[string]any{}
    enabled := false
    switch j := v.(type) {
    case bool:
      enabled = j
    case map[string]any:
      enabled = true
      for key, val := range j {
        switch key {
        case "tagSynonyms":
          ts, ok := val.(map[string]any)
          if !ok {
            return nil, fmt.Errorf("@ttsc/lint: format.jsdoc.tagSynonyms must be an object, got %T", val)
          }
          // Element values must be strings; surface
          // typos early instead of after a downstream
          // JSON-decode failure.
          for k, v := range ts {
            if _, ok := v.(string); !ok {
              return nil, fmt.Errorf("@ttsc/lint: format.jsdoc.tagSynonyms[%q] must be a string, got %T", k, v)
            }
          }
          jdOpts["tagSynonyms"] = ts
        case "sortTags":
          b, err := asBool("format.jsdoc.sortTags", val)
          if err != nil {
            return nil, err
          }
          jdOpts["sortTags"] = b
        default:
          return nil, fmt.Errorf("@ttsc/lint: format.jsdoc unknown key %q (allowed: tagSynonyms, sortTags)", key)
        }
      }
    default:
      return nil, fmt.Errorf("@ttsc/lint: format.jsdoc must be a boolean or object, got %T", v)
    }
    if enabled {
      out["format/jsdoc"] = ruleEntry(jdOpts)
    }
  }

  return out, nil
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

// mergeRuleMaps overlays `overrides` on `base` and returns the merged
// map. Identical keys in `overrides` replace the entire entry from
// `base`; option objects are NOT deep-merged, which matches the
// conflict-resolution policy spec: a `rules` entry that names a
// `format/*` rule fully replaces the corresponding entry expanded
// from the `format` block.
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
// error on failure. Used by expandFormatBlock to validate importOrder.
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
// key set mirrors `ITtscLintFormatConfig` exactly.
func rejectUnknownFormatKeys(raw map[string]any) error {
  allowed := map[string]struct{}{
    "severity":                   {},
    "semi":                       {},
    "singleQuote":                {},
    "trailingComma":              {},
    "printWidth":                 {},
    "tabWidth":                   {},
    "useTabs":                    {},
    "endOfLine":                  {},
    "importOrder":                {},
    "importOrderSeparation":      {},
    "importOrderSortSpecifiers":  {},
    "importOrderCaseInsensitive": {},
    "jsdoc":                      {},
  }
  for key := range raw {
    if _, ok := allowed[key]; !ok {
      return fmt.Errorf("@ttsc/lint: format unknown key %q; see ITtscLintFormatConfig for the allowed surface", key)
    }
  }
  return nil
}
