// ABOUTME: Age verification utility for rental checkout
// ABOUTME: Checks if a customer or family member is a minor renting age-restricted content

const RESTRICTED_RATINGS = ['R', 'NC-17'];

export interface AgeRestrictionWarning {
  rating: string;
  requiresApproval: boolean;
  message: string;
}

export function isMinor(birthday: string | null | undefined, today?: Date): boolean | null {
  if (!birthday) return null;

  const now = today ?? new Date();
  const birth = new Date(birthday);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return age < 18;
}

export function checkAgeRestriction(
  birthday: string | null | undefined,
  rating: string | null | undefined,
): AgeRestrictionWarning | null {
  if (!birthday || !rating) return null;
  if (!RESTRICTED_RATINGS.includes(rating)) return null;

  const minor = isMinor(birthday);
  if (!minor) return null;

  return {
    rating,
    requiresApproval: true,
    message: `Customer is under 18. ${rating}-rated content requires parent/guardian approval.`,
  };
}
