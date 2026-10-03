// expect: promise/prefer-await-to-then error
Promise.resolve(1).then((value) => value);
