declare const ok: boolean;
// expect: promise/always-return error
Promise.resolve(1).then(() => {
  if (ok) {
    return 1;
  }
});
