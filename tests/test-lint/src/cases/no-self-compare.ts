function f(a: number) {
  // expect: no-self-compare error
  return a === a;
}
JSON.stringify(f);
