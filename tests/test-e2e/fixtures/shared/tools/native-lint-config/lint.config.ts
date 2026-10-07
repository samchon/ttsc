export default async () => {
  console.log("loading TypeScript lint config");
  const shared = await import("./shared-lint.config.ts");
  return {
    ...shared,
    ignores: [".next/**/*.ts", "next-env.d.ts", "src/functional/**/*.ts"],
  };
};
