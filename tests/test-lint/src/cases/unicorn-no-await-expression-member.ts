async function f() {
  // expect: unicorn/no-await-expression-member error
  return (await Promise.resolve({ a: 1 })).a;
}
JSON.stringify(f);
