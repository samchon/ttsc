function f() {
  // expect: no-throw-literal error
  throw "literal";
}
JSON.stringify(f);