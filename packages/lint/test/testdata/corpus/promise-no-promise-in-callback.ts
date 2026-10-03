function done(err: Error | null) {
  if (err) throw err;
  // expect: promise/no-promise-in-callback error
  Promise.resolve(1);
}
