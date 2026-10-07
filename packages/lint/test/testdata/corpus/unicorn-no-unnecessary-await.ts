async function f() {
  // expect: unicorn/no-unnecessary-await error
  const x = await 42;
  void x;
}
void f;
