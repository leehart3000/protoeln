import type { Me } from './api'

// Why nothing can be changed while the site is read-only (PROTOELN_READ_ONLY), as the API says
export const READ_ONLY_REASON = 'This site is read-only at the moment, so nothing can be changed.'

// Why the person using the website can't do something, or null if they can (as ProtoLIMS's
// refusalReason). `allowed` says whether they can, and `who` who can, as in "site admins".
// Null while it's still being checked: the API checks every change anyway.
export function refusal(me: Me | undefined, allowed: boolean, who: string): string | null {
  if (me?.readOnly) {
    return READ_ONLY_REASON
  }
  if (me === undefined || allowed) {
    return null
  }
  return me.user === null ? 'Sign in to do this.' : `Only ${who} can do this.`
}
