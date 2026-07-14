// regex_clean.go ports the `clean-regexp` npm package (v1.0.0), the exact
// dependency the upstream unicorn/better-regex rule uses for its
// `new RegExp("pattern", "flags")` string-constructor branch. Unlike the
// literal branch (which runs the full regexp-tree optimizer in
// regex_tree_optimizer.go), upstream's constructor branch applies a fixed,
// ordered table of character-class shorthands via a global substring
// replace, gated by whether the regex carries the flags a replacement needs.
// Reproducing that table verbatim is what keeps the constructor branch's
// diagnostics and fixes identical to upstream; the full optimizer would
// rewrite strictly more and diverge.
//
// clean-regexp source: https://github.com/sindresorhus/clean-regexp
package linthost

import "strings"

type regexCleanMapping struct {
  key   string
  value string
  flags string
}

// regexCleanMappings mirrors clean-regexp's `lib/mappings` Map in declaration
// order. Entries without flags always apply; entries with `flags: "i"` apply
// only when the regex is case-insensitive.
var regexCleanMappings = []regexCleanMapping{
  {key: "[0-9]", value: `\d`},
  {key: "[^0-9]", value: `\D`},

  // Word
  {key: "[a-zA-Z0-9_]", value: `\w`},
  {key: "[a-zA-Z_0-9]", value: `\w`},
  {key: "[a-z0-9A-Z_]", value: `\w`},
  {key: "[a-z0-9_A-Z]", value: `\w`},
  {key: "[a-z_A-Z0-9]", value: `\w`},
  {key: "[a-z_0-9A-Z]", value: `\w`},
  {key: "[A-Za-z0-9_]", value: `\w`},
  {key: "[A-Za-z_0-9]", value: `\w`},
  {key: "[A-Z0-9a-z_]", value: `\w`},
  {key: "[A-Z0-9_a-z]", value: `\w`},
  {key: "[A-Z_a-z0-9]", value: `\w`},
  {key: "[A-Z_0-9a-z]", value: `\w`},
  {key: "[0-9a-zA-Z_]", value: `\w`},
  {key: "[0-9a-z_A-Z]", value: `\w`},
  {key: "[0-9A-Za-z_]", value: `\w`},
  {key: "[0-9A-Z_a-z]", value: `\w`},
  {key: "[0-9_a-zA-Z]", value: `\w`},
  {key: "[0-9_A-Za-z]", value: `\w`},
  {key: "[_a-zA-Z0-9]", value: `\w`},
  {key: "[_a-z0-9A-Z]", value: `\w`},
  {key: "[_A-Za-z0-9]", value: `\w`},
  {key: "[_A-Z0-9a-z]", value: `\w`},
  {key: "[_0-9a-zA-Z]", value: `\w`},
  {key: "[_0-9A-Za-z]", value: `\w`},

  // Word with digit
  {key: `[a-zA-Z\d_]`, value: `\w`},
  {key: `[a-zA-Z_\d]`, value: `\w`},
  {key: `[a-z\dA-Z_]`, value: `\w`},
  {key: `[a-z\d_A-Z]`, value: `\w`},
  {key: `[a-z_A-Z\d]`, value: `\w`},
  {key: `[a-z_\dA-Z]`, value: `\w`},
  {key: `[A-Za-z\d_]`, value: `\w`},
  {key: `[A-Za-z_\d]`, value: `\w`},
  {key: `[A-Z\da-z_]`, value: `\w`},
  {key: `[A-Z\d_a-z]`, value: `\w`},
  {key: `[A-Z_a-z\d]`, value: `\w`},
  {key: `[A-Z_\da-z]`, value: `\w`},
  {key: `[\da-zA-Z_]`, value: `\w`},
  {key: `[\da-z_A-Z]`, value: `\w`},
  {key: `[\dA-Za-z_]`, value: `\w`},
  {key: `[\dA-Z_a-z]`, value: `\w`},
  {key: `[\d_a-zA-Z]`, value: `\w`},
  {key: `[\d_A-Za-z]`, value: `\w`},
  {key: `[_a-zA-Z\d]`, value: `\w`},
  {key: `[_a-z\dA-Z]`, value: `\w`},
  {key: `[_A-Za-z\d]`, value: `\w`},
  {key: `[_A-Z\da-z]`, value: `\w`},
  {key: `[_\da-zA-Z]`, value: `\w`},
  {key: `[_\dA-Za-z]`, value: `\w`},

  // Non-word
  {key: "[^a-zA-Z0-9_]", value: `\W`},
  {key: "[^a-zA-Z_0-9]", value: `\W`},
  {key: "[^a-z0-9A-Z_]", value: `\W`},
  {key: "[^a-z0-9_A-Z]", value: `\W`},
  {key: "[^a-z_A-Z0-9]", value: `\W`},
  {key: "[^a-z_0-9A-Z]", value: `\W`},
  {key: "[^A-Za-z0-9_]", value: `\W`},
  {key: "[^A-Za-z_0-9]", value: `\W`},
  {key: "[^A-Z0-9a-z_]", value: `\W`},
  {key: "[^A-Z0-9_a-z]", value: `\W`},
  {key: "[^A-Z_a-z0-9]", value: `\W`},
  {key: "[^A-Z_0-9a-z]", value: `\W`},
  {key: "[^0-9a-zA-Z_]", value: `\W`},
  {key: "[^0-9a-z_A-Z]", value: `\W`},
  {key: "[^0-9A-Za-z_]", value: `\W`},
  {key: "[^0-9A-Z_a-z]", value: `\W`},
  {key: "[^0-9_a-zA-Z]", value: `\W`},
  {key: "[^0-9_A-Za-z]", value: `\W`},
  {key: "[^_a-zA-Z0-9]", value: `\W`},
  {key: "[^_a-z0-9A-Z]", value: `\W`},
  {key: "[^_A-Za-z0-9]", value: `\W`},
  {key: "[^_A-Z0-9a-z]", value: `\W`},
  {key: "[^_0-9a-zA-Z]", value: `\W`},
  {key: "[^_0-9A-Za-z]", value: `\W`},

  // Non-word with digit
  {key: `[^a-zA-Z\d_]`, value: `\W`},
  {key: `[^a-zA-Z_\d]`, value: `\W`},
  {key: `[^a-z\dA-Z_]`, value: `\W`},
  {key: `[^a-z\d_A-Z]`, value: `\W`},
  {key: `[^a-z_A-Z\d]`, value: `\W`},
  {key: `[^a-z_\dA-Z]`, value: `\W`},
  {key: `[^A-Za-z\d_]`, value: `\W`},
  {key: `[^A-Za-z_\d]`, value: `\W`},
  {key: `[^A-Z\da-z_]`, value: `\W`},
  {key: `[^A-Z\d_a-z]`, value: `\W`},
  {key: `[^A-Z_a-z\d]`, value: `\W`},
  {key: `[^A-Z_\da-z]`, value: `\W`},
  {key: `[^\da-zA-Z_]`, value: `\W`},
  {key: `[^\da-z_A-Z]`, value: `\W`},
  {key: `[^\dA-Za-z_]`, value: `\W`},
  {key: `[^\dA-Z_a-z]`, value: `\W`},
  {key: `[^\d_a-zA-Z]`, value: `\W`},
  {key: `[^\d_A-Za-z]`, value: `\W`},
  {key: `[^_a-zA-Z\d]`, value: `\W`},
  {key: `[^_a-z\dA-Z]`, value: `\W`},
  {key: `[^_A-Za-z\d]`, value: `\W`},
  {key: `[^_A-Z\da-z]`, value: `\W`},
  {key: `[^_\da-zA-Z]`, value: `\W`},
  {key: `[^_\dA-Za-z]`, value: `\W`},

  // Word with case insensitivity
  {key: "[a-z0-9_]", value: `\w`, flags: "i"},
  {key: "[a-z_0-9]", value: `\w`, flags: "i"},
  {key: "[0-9a-z_]", value: `\w`, flags: "i"},
  {key: "[0-9_a-z]", value: `\w`, flags: "i"},
  {key: "[_a-z0-9]", value: `\w`, flags: "i"},
  {key: "[_0-9a-z]", value: `\w`, flags: "i"},
  {key: "[^a-z0-9_]", value: `\W`, flags: "i"},

  // Word with case insensitivity and digit
  {key: `[a-z\d_]`, value: `\w`, flags: "i"},
  {key: `[a-z_\d]`, value: `\w`, flags: "i"},
  {key: `[\da-z_]`, value: `\w`, flags: "i"},
  {key: `[\d_a-z]`, value: `\w`, flags: "i"},
  {key: `[_a-z\d]`, value: `\w`, flags: "i"},
  {key: `[_\da-z]`, value: `\w`, flags: "i"},

  // Non-word with case insensitivity
  {key: "[^a-z0-9_]", value: `\W`, flags: "i"},
  {key: "[^a-z_0-9]", value: `\W`, flags: "i"},
  {key: "[^0-9a-z_]", value: `\W`, flags: "i"},
  {key: "[^0-9_a-z]", value: `\W`, flags: "i"},
  {key: "[^_a-z0-9]", value: `\W`, flags: "i"},
  {key: "[^_0-9a-z]", value: `\W`, flags: "i"},

  // Non-word with case insensitivity and digit
  {key: `[^a-z\d_]`, value: `\W`, flags: "i"},
  {key: `[^a-z_\d]`, value: `\W`, flags: "i"},
  {key: `[^\da-z_]`, value: `\W`, flags: "i"},
  {key: `[^\d_a-z]`, value: `\W`, flags: "i"},
  {key: `[^_a-z\d]`, value: `\W`, flags: "i"},
  {key: `[^_\da-z]`, value: `\W`, flags: "i"},
}

// regexCleanRegexp applies clean-regexp's ordered substring replacements to a
// `new RegExp` pattern string, gated on `flags`. Mirrors clean-regexp's
// default export: for each mapping whose required flags are all present in the
// regex flags, globally replace the key substring with its shorthand.
func regexCleanRegexp(pattern, flags string) string {
  for _, mapping := range regexCleanMappings {
    if regexCleanHasFlags(flags, mapping.flags) {
      pattern = strings.ReplaceAll(pattern, mapping.key, mapping.value)
    }
  }
  return pattern
}

// regexCleanHasFlags reports whether every flag a replacement requires is
// present in the regex's flags (clean-regexp's `hasFlags`). An empty
// requirement is always satisfied.
func regexCleanHasFlags(regexFlags, replaceFlags string) bool {
  for _, flag := range replaceFlags {
    if !strings.ContainsRune(regexFlags, flag) {
      return false
    }
  }
  return true
}
