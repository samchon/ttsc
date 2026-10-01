async function f() {
  // expect: unicorn/no-useless-promise-resolve-reject error
  return Promise.resolve(1);
}
void f;
