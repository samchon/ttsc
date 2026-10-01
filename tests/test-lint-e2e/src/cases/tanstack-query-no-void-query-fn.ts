import { useQuery } from "@tanstack/react-query";

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    // expect: tanstack-query/no-void-query-fn error
    queryFn: () => {
      console.log("missing return");
    },
  });
}
