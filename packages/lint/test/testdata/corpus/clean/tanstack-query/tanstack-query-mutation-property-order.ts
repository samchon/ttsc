// @ttsc-corpus-clean: tanstack-query/mutation-property-order
import { useMutation } from "@tanstack/react-query"; export function useSave() { return useMutation({ mutationFn: async input => input, onMutate: () => ({ snapshot: true }), onError: () => {} }); }
