const base = 1;

enum Value {
  Fixed = 1,
  // expect: prefer-literal-enum-member error
  Computed = base + 1,
}
