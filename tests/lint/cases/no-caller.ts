function f() {
  // expect: no-caller error
  return arguments.callee;
}
JSON.stringify(f);
