// expect: promise/catch-or-return error
Promise.resolve(1).then((value) => value + 1);
