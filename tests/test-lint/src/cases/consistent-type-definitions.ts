// expect: consistentTypeDefinitions error
type Shape = {
  name: string;
};

JSON.stringify({} as Shape);
