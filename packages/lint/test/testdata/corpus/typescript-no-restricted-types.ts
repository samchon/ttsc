// @ttsc-corpus-skip(options): rule requires a configured `types` map; the flat corpus supplies no per-rule options. Positive Go coverage lives at packages/lint/linthost/no_restricted_types_matches_every_official_type_surface_exactly_test.go.
// @ttsc-corpus-rule: typescript/no-restricted-types

// No type spelling is restricted by default.
const wrapper: Object = {};
type Local = string;
const local: Local = "value";

JSON.stringify({ wrapper, local });
