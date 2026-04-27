interface User {
  id: number;
  email: string;
}

export const userTypeName: string = __typeText<User>();
export const arrayTypeName: string = __typeText<string[]>();
console.log(userTypeName, arrayTypeName);
