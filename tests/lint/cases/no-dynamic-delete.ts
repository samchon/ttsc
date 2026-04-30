const key = "name";
const box: Record<string, string> = { name: "ttsc" };

// expect: no-dynamic-delete error
delete box[key];
delete box["name"];
