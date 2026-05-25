const key = "name";
const box: Record<string, string> = { name: "ttsc" };

// expect: noDynamicDelete error
delete box[key];
delete box["name"];
