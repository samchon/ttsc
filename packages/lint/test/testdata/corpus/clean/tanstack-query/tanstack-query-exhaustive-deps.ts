// @ttsc-corpus-clean: tanstack-query/exhaustive-deps
import { useQuery } from "@tanstack/react-query"; import { fetchTodo } from "./api"; export function useTodo(todoId: string) { return useQuery({ queryKey: ["todo", todoId], queryFn: () => fetchTodo(todoId) }); }
