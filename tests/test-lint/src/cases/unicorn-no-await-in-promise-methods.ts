async function f() {
  // expect: unicorn/no-await-in-promise-methods error
  await Promise.all([await Promise.resolve(1), Promise.resolve(2)]);
}
