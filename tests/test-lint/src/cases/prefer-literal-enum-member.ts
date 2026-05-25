const base = 1;

enum Value {
  Fixed = 1,
  // expect: preferLiteralEnumMember error
  Computed = base + 1,
}
