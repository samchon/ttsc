// expect: consistent-type-definitions error
type Shape = {
  name: string;
};

JSON.stringify({} as Shape);
