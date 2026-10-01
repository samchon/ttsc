import { useQuery } from "@tanstack/react-query";
import { fetchTodo } from "./api";

export function useTodo(todoId: string) {
  return useQuery({
    queryKey: ["todo"],
    // expect: tanstack-query/exhaustive-deps error
    queryFn: () => fetchTodo(todoId),
  });
}
