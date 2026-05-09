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

// User-facing onboarding answers. Keep this small and add only when needed.
export type Onboarding = {
  module: ModuleType | null;
  employeeCount: number | null;
  operatesInMultipleCountries: boolean | null;
  isCooperative: boolean | null;
  hasGhgTargets: boolean | null;
  hasHumanRightsPolicy: boolean | null;
};

// Per-datapoint user state. We split "applies" from "checked" so the user
// can mark something as not-applicable and still see it greyed out, rather
// than it disappearing entirely.
export type DatapointAnswer = {
  applies: boolean | null;   // null = not yet decided
  checked: boolean;          // user has marked as data collected / done
  value: string;             // raw input value (Day 3 will use this)
  note: string;              // free-text note from the user
};

export type AppState = {
  onboarding: Onboarding;
  answers: Record<string, DatapointAnswer>;
  // Track when each row was last touched, so we can show "12 done out of 55"
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