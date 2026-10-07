// @ttsc-corpus-clean: tanstack-query/infinite-query-property-order
import { useInfiniteQuery } from "@tanstack/react-query"; export function usePages() { return useInfiniteQuery({ queryKey: ["pages"], queryFn: ({ pageParam }) => pageParam, getNextPageParam: last => last.next }); }
