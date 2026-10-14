/**
 * « 05 » → « 5 », « 007 » → « 7 » ; « 0 », « 0.5 » et un champ vide restent
 * tels quels. Utilisé par les champs numériques (`Input type="number"`).
 */
export function stripLeadingZeros(text: string): string {
  return text.replace(/^0+(?=\d)/, "");
}
