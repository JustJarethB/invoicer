/**
 * Parse a currency field at the form boundary. Returns the numeric value, or
 * `undefined` when nothing meaningful was typed (so the field can stay blank
 * instead of storing NaN or 0). Preserves a leading minus and truncates to
 * two decimal places rather than rounding.
 */
export const parseCurrency = (v: string): number | undefined => {
  const s = v.toString().trim();
  if (s === "") return undefined;
  const negative = s.startsWith("-");
  // Allow a leading decimal (".5") by normalising it to "0.5" before matching.
  const normalised = s.replace(/^(-?)\./, "$10.");
  const match = normalised.match(/0*(\d+\.?\d{0,2})/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return negative ? -value : value;
};
