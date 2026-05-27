interface OnlyType {
  value: number;
}

type OnlyAlias = { kind: "alias" };

interface MixedType {
  ok: true;
}

const mixedValue = { ok: true };

// expect: typescript/consistent-type-exports error
export { OnlyType };

// expect: typescript/consistent-type-exports error
export { OnlyType, OnlyAlias };

// At least one exported name (`mixedValue`) is a value declaration in
// this file, so the rewrite would be wrong. Should NOT fire.
export { MixedType, mixedValue };

// Already `export type { ... }` — never fires.
export type { OnlyType as AliasA };

// Empty re-export marker — no specifiers to classify.
export {};
