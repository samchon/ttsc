function f() {
  // expect: noThrowLiteral error
  throw "literal";
}
JSON.stringify(f);
