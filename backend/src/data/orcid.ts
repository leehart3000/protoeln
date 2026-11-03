// An ORCID iD is 16 characters in groups of four (e.g. 0000-0002-1825-0097). The last character is
// a check digit (ISO 7064 MOD 11-2), which can be X.
const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/

export function isValidOrcid(id: string): boolean {
  if (!ORCID_PATTERN.test(id)) {
    return false
  }
  const characters = id.replaceAll('-', '')
  let total = 0
  for (const digit of characters.slice(0, -1)) {
    total = (total + Number(digit)) * 2
  }
  const result = (12 - (total % 11)) % 11
  const checkCharacter = result === 10 ? 'X' : String(result)
  return characters.at(-1) === checkCharacter
}
