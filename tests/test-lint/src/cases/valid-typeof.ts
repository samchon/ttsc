function f(x: any) {
  // expect: valid-typeof error
  return typeof x === "stirng";
}
JSON.stringify(f);
