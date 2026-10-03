import { useMutation } from "@tanstack/react-query";

export function useSave() {
  return useMutation({
    mutationFn: async (input: string) => input,
    // expect: tanstack-query/mutation-property-order error
    onError: () => {},
    onMutate: () => ({ snapshot: true }),
  });
}
