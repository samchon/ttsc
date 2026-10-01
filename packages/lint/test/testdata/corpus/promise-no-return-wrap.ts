Promise.resolve(1).then(() => {
  // expect: promise/no-return-wrap error
  return Promise.resolve(2);
});
