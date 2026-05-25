// expect: noWrapperObjectTypes error
type Name = String;

JSON.stringify({} as Name);
