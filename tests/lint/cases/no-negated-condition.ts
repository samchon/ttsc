function f(a: any) {
  // expect: no-negated-condition error
  if (!a) { return 1; } else { return 2; }
}
JSON.stringify(f);