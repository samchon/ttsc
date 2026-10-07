// expect: unicorn/prevent-abbreviations error
const errCb = (error: Error): void => {
  console.error(error);
};

errCb(new Error("fixture"));
