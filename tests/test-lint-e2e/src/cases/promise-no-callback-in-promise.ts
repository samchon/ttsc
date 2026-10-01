declare const cb: () => void;
Promise.resolve(1).then(() => {
  // expect: promise/no-callback-in-promise error
  cb();
});
