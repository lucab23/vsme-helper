"use client";

import { useState } from "react";
import { useAppState } from "@/lib/useAppState";
import { ModuleType } from "@/lib/types";

export default function Home() {
  const { state, loaded, setOnboarding, resetAll } = useAppState();

  // Don't render anything until we've read localStorage, to avoid flicker
  if (!loaded) {
    return null;
  }

  const onboardingComplete = state.onboarding.module !== null;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">VSME Helper</h1>
        <p className="text-gray-600">
          A free tool to help SMEs prepare a VSME-compliant sustainability report.
        </p>
      </header>

      {!onboardingComplete ? (
        <OnboardingForm onComplete={(answers) => setOnboarding(answers)} />
      ) : (
        <ChecklistPlaceholder onReset={resetAll} module={state.onboarding.module!} />
      )}
    </main>
  );
}

// ------------------------------------------------------------------
// Onboarding
// ------------------------------------------------------------------

type OnboardingFormProps = {
  onComplete: (answers: {
    module: ModuleType;
    employeeCount: number;
    operatesInMultipleCountries: boolean;
    isCooperative: boolean;
    hasGhgTargets: boolean;
    hasHumanRightsPolicy: boolean;
  }) => void;
};

function OnboardingForm({ onComplete }: OnboardingFormProps) {
  // Local form state — we only commit to global state on submit.
  const [module, setModule] = useState<ModuleType | null>(null);
  const [employeeCount, setEmployeeCount] = useState<string>("");
  const [multipleCountries, setMultipleCountries] = useState<boolean | null>(null);
  const [cooperative, setCooperative] = useState<boolean | null>(null);
  const [ghgTargets, setGhgTargets] = useState<boolean | null>(null);
  const [hrPolicy, setHrPolicy] = useState<boolean | null>(null);

  const canSubmit =
    module !== null &&
    employeeCount !== "" &&
    multipleCountries !== null &&
    cooperative !== null &&
    (module === "Basic" || (ghgTargets !== null && hrPolicy !== null));

  const handleSubmit = () => {
    if (!canSubmit) return;
    onComplete({
      module: module!,
      employeeCount: parseInt(employeeCount, 10),
      operatesInMultipleCountries: multipleCountries!,
      isCooperative: cooperative!,
      // For Basic-only users we still store these as false (they're not asked)
      hasGhgTargets: ghgTargets ?? false,
      hasHumanRightsPolicy: hrPolicy ?? false,
    });
  };

  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold">Tell us about your company</h2>
      <p className="mb-6 text-sm text-gray-600">
        A few quick questions so we only show you the disclosures that actually apply.
        You can change your answers later.
      </p>

      <div className="space-y-6">
        <Question label="Which VSME module are you preparing?">
          <Choice
            label="Basic Module only"
            description="The minimum required by the standard. Recommended starting point."
            selected={module === "Basic"}
            onSelect={() => setModule("Basic")}
          />
          <Choice
            label="Basic + Comprehensive Module"
            description="Adds disclosures often requested by banks, investors, and large corporate clients."
            selected={module === "Comprehensive"}
            onSelect={() => setModule("Comprehensive")}
          />
        </Question>

        <Question label="How many employees does your company have?">
          <input
            type="number"
            min={0}
            value={employeeCount}
            onChange={(e) => setEmployeeCount(e.target.value)}
            placeholder="e.g. 42"
            className="w-40 rounded border border-gray-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">
            Headcount or full-time equivalents (FTE). Affects which disclosures apply
            (thresholds at 50 and 150 employees).
          </p>
        </Question>

        <Question label="Does your company operate in more than one country?">
          <YesNo selected={multipleCountries} onSelect={setMultipleCountries} />
        </Question>

        <Question label="Is your company a cooperative?">
          <YesNo selected={cooperative} onSelect={setCooperative} />
        </Question>

        {module === "Comprehensive" && (
          <>
            <Question label="Has your company set GHG emission reduction targets?">
              <YesNo selected={ghgTargets} onSelect={setGhgTargets} />
            </Question>

            <Question label="Does your company have a code of conduct or human rights policy?">
              <YesNo selected={hrPolicy} onSelect={setHrPolicy} />
            </Question>
          </>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-8 rounded bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Continue
      </button>
    </section>
  );
}

// ------------------------------------------------------------------
// Reusable question components
// ------------------------------------------------------------------

function Question({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block font-medium text-gray-900">{label}</label>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Choice({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded border-2 px-4 py-3 text-left transition ${
        selected
          ? "border-blue-600 bg-blue-50"
          : "border-gray-200 hover:border-gray-400"
      }`}
    >
      <div className="font-medium">{label}</div>
      {description && (
        <div className="mt-0.5 text-sm text-gray-600">{description}</div>
      )}
    </button>
  );
}

function YesNo({
  selected,
  onSelect,
}: {
  selected: boolean | null;
  onSelect: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onSelect(true)}
        className={`rounded border-2 px-6 py-2 font-medium transition ${
          selected === true
            ? "border-blue-600 bg-blue-50"
            : "border-gray-200 hover:border-gray-400"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onSelect(false)}
        className={`rounded border-2 px-6 py-2 font-medium transition ${
          selected === false
            ? "border-blue-600 bg-blue-50"
            : "border-gray-200 hover:border-gray-400"
        }`}
      >
        No
      </button>
    </div>
  );
}

// ------------------------------------------------------------------
// Placeholder shown after onboarding (Step 3 will replace this)
// ------------------------------------------------------------------

function ChecklistPlaceholder({
  module,
  onReset,
}: {
  module: ModuleType;
  onReset: () => void;
}) {
  return (
    <section>
      <div className="rounded border border-gray-200 bg-gray-50 p-6">
        <h2 className="mb-2 text-xl font-semibold">Onboarding complete</h2>
        <p className="mb-1 text-gray-700">
          You selected: <strong>{module}</strong> Module.
        </p>
        <p className="text-sm text-gray-500">
          The filtered checklist will appear here in the next step.
        </p>
      </div>

      <button
        onClick={() => {
          if (confirm("This will erase all your progress. Continue?")) {
            onReset();
          }
        }}
        className="mt-4 text-sm text-gray-500 underline hover:text-gray-700"
      >
        Reset and start over
      </button>
    </section>
  );
}