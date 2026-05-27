declare const cond: boolean;
function f(): number {
  // expect: unicorn/prefer-ternary error
  if (cond) {
    return 1;
  } else {
    return 2;
  }
}
void f;
