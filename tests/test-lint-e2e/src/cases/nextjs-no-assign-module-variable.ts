// Positive: local declaration that shadows the CommonJS `module` binding.
// expect: nextjs/no-assign-module-variable error
const module = {};

// Negative: a distinct local name.
const mod = {};

JSON.stringify({ module, mod });
