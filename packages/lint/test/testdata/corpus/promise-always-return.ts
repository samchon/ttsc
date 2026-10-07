// expect: promise/always-return error
Promise.resolve(1).then(() => {
  console.log("side effect");
});
