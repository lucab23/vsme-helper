export type Status = "Mandatory" | "Conditional" | "Voluntary";
export type ModuleType = "Basic" | "Comprehensive";
export type Category = "General" | "Environmental" | "Social" | "Governance";

export type Datapoint = {
  id: string;
  module: ModuleType;
  groupId: string;
  disclosure: string;
  datapoint: string;
  status: Status;
  condition: string;
  triggeringQuestion: string;
  calculated: boolean;
  category: Category;
  dataType: string;
  unit: string;
  paragraphRef: string;
};

export type Group = {
  id: string;
  disclosure: string;
  category: Category;
  triggeringQuestion: string;
  members: string[];
};

export type VsmeData = {
  version: string;
  generatedAt: string;
  datapoints: Datapoint[];
  optionalDatapoints: Datapoint[];
  groups: Group[];
};

export type Onboarding = {
  module: ModuleType | null;
  employeeCount: number | null;
  operatesInMultipleCountries: boolean | null;
  isCooperative: boolean | null;
  hasGhgTargets: boolean | null;
  hasHumanRightsPolicy: boolean | null;
};

export type DatapointAnswer = {
  value: string;            // raw user input
  notApplicable: boolean;   // user-marked "not applicable"
  note: string;             // free-text note
};

export type AppState = {
  onboarding: Onboarding;
  answers: Record<string, DatapointAnswer>;
  lastUpdated: string;
};

export const initialOnboarding: Onboarding = {
  module: null,
  employeeCount: null,
  operatesInMultipleCountries: null,
  isCooperative: null,
  hasGhgTargets: null,
  hasHumanRightsPolicy: null,
};

export const initialAppState: AppState = {
  onboarding: initialOnboarding,
  answers: {},
  lastUpdated: new Date(0).toISOString(),
};

/**
 * A row counts as "done" if either:
 *   - the user has marked it not-applicable, OR
 *   - the value is non-empty (any non-whitespace input).
 * Calculated rows are never "done" by user action — Day 3 will compute them.
 */
export function isAnswered(a: DatapointAnswer | undefined): boolean {
  if (!a) return false;
  if (a.notApplicable) return true;
  return a.value.trim().length > 0;
}