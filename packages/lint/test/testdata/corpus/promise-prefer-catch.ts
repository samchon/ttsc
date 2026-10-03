Promise.resolve(1).then(
  (value) => value,
  // expect: promise/prefer-catch error
  (error) => console.error(error),
);
