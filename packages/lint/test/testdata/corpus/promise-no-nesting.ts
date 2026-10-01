Promise.resolve(1).then(() => {
  // expect: promise/no-nesting error
  Promise.resolve(2).then((value) => value);
});
