import type { Me } from './api'

// Why the person using the website can't do something, or null if they can (as ProtoLIMS's
// refusalReason). `allowed` says whether they can, and `who` who can, as in "site admins".
// Null while it's still being checked: the API checks every change anyway.
export function refusal(me: Me | undefined, allowed: boolean, who: string): string | null {
  if (me === undefined || allowed) {
    return null
  }
  return me.user === null ? 'Sign in to do this.' : `Only ${who} can do this.`
}
