function f(x: unknown) {
  if (typeof x !== "number") {
    // expect: unicorn/prefer-type-error error
    throw new Error("must be number");
  }
  return x;
}
void f;
