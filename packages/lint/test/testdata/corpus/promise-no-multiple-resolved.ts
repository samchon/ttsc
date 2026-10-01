new Promise((resolve, reject) => {
  resolve(1);
  // expect: promise/no-multiple-resolved error
  reject(new Error("already resolved"));
});
