// @ttsc-corpus-skip: this rule requires a configured `types` map; the corpus
// runner enables rules with bare severities and intentionally supplies no
// per-rule options.

// No type spelling is restricted by default.
const wrapper: Object = {};
type Local = string;
const local: Local = "value";

JSON.stringify({ wrapper, local });
