import { Datapoint, Onboarding } from "./types";

/**
 * Decide whether a datapoint applies, given the user's onboarding answers.
 *
 * Returns:
 *   "applies"       → user must report this
 *   "does-not-apply"→ excluded based on a hard condition
 *   "depends"       → can't decide from onboarding alone; user will be
 *                     asked contextually next to the group
 */
export type Applicability = "applies" | "does-not-apply" | "depends";

export function applicabilityFor(
  dp: Datapoint,
  onboarding: Onboarding
): Applicability {
  // Wrong module → always exclude
  if (dp.module === "Comprehensive" && onboarding.module === "Basic") {
    return "does-not-apply";
  }

  // Mandatory rows always apply (assuming module match)
  if (dp.status === "Mandatory") {
    return "applies";
  }

  // Conditional rows: try to resolve from onboarding. If we can't, defer.
  switch (dp.groupId) {
    // Multi-country employee breakdown
    case "B8_COUNTRY":
      return onboarding.operatesInMultipleCountries === true
        ? "applies"
        : "does-not-apply";

    // 50-employee threshold
    case "B8_TURNOVER":
      return (onboarding.employeeCount ?? 0) >= 50
        ? "applies"
        : "does-not-apply";

    // 150-employee threshold (drops to 100 from 7 June 2031, but for now use 150)
    case "B10_PAY_GAP":
      return (onboarding.employeeCount ?? 0) >= 150
        ? "applies"
        : "does-not-apply";

    // Cooperative-only
    case "B2_COOPERATIVE":
      return onboarding.isCooperative === true ? "applies" : "does-not-apply";

    // GHG target follow-ups (only relevant if user has set targets)
    case "C3_TARGETS":
      // C3-01 itself is Mandatory and asks the question; the rest depend on it
      if (dp.id === "C3-01") return "applies";
      return onboarding.hasGhgTargets === true ? "applies" : "does-not-apply";

    // Human rights policy follow-ups
    case "C6_HR_POLICY_COVERAGE":
      return onboarding.hasHumanRightsPolicy === true
        ? "applies"
        : "does-not-apply";

    // Everything else: we don't know enough to decide upfront.
    // The user will see the row with its triggering question shown.
    default:
      return "depends";
  }
}