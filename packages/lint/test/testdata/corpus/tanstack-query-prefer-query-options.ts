import { useQuery } from "@tanstack/react-query";
import { fetchTodo } from "./api";

export function useTodo(todoId: string) {
  // expect: tanstack-query/prefer-query-options error
  return useQuery({ queryKey: ["todo", todoId], queryFn: () => fetchTodo(todoId) });
}
