import { useInfiniteQuery } from "@tanstack/react-query";

export function usePages() {
  return useInfiniteQuery({
    queryKey: ["pages"],
    // expect: tanstack-query/infinite-query-property-order error
    getNextPageParam: (last) => last.next,
    queryFn: ({ pageParam }) => pageParam,
  });
}
