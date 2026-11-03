import { useQuery } from '@tanstack/vue-query'

import { fetchMe } from './api'

// Who is signed in on this browser (user is null if nobody). The header and the profile page
// share this one request (as useMe in ProtoLIMS).
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe })
}
