Promise.resolve(1).finally(() => {
  // expect: promise/no-return-in-finally error
  return 2;
});
