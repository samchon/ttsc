const key = "name";
const box: Record<string, string> = { name: "ttsc" };

// expect: typescript/no-dynamic-delete error
delete box[key];
delete box["name"];
