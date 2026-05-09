"use client";

import { useMemo, useState } from "react";
import vsmeData from "@/data/vsme-data.json";
import { useAppState } from "@/lib/useAppState";
import {
  Category,
  Datapoint,
  Group,
  ModuleType,
  VsmeData,
} from "@/lib/types";
import { applicabilityFor } from "@/lib/applicability";

const data = vsmeData as VsmeData;

export default function Home() {
  const { state, loaded, setOnboarding, setAnswer, getAnswer, resetAll } =
    useAppState();

  if (!loaded) return null;

  const onboardingComplete = state.onboarding.module !== null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">VSME Helper</h1>
          <p className="text-gray-600">
            A free tool to help SMEs prepare a VSME-compliant sustainability report.
          </p>
        </div>
        {onboardingComplete && (
          <button
            onClick={() => {
              if (confirm("This will erase all your progress. Continue?")) {
                resetAll();
              }
            }}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Reset
          </button>
        )}
      </header>

      {!onboardingComplete ? (
        <OnboardingForm onComplete={(answers) => setOnboarding(answers)} />
      ) : (
        <Checklist
          onboarding={state.onboarding}
          getAnswer={getAnswer}
          setAnswer={setAnswer}
        />
      )}
    </main>
  );
}

// ------------------------------------------------------------------
// Checklist
// ------------------------------------------------------------------

type ChecklistProps = {
  onboarding: ReturnType<typeof useAppState>["state"]["onboarding"];
  getAnswer: ReturnType<typeof useAppState>["getAnswer"];
  setAnswer: ReturnType<typeof useAppState>["setAnswer"];
};

function Checklist({ onboarding, getAnswer, setAnswer }: ChecklistProps) {
  const [categoryFilter, setCategoryFilter] = useState<Category | "All">("All");
  const [hideExcluded, setHideExcluded] = useState(true);

  // Compute which datapoints apply, group them, and filter
  const groupsWithRows = useMemo(() => {
    type Row = { dp: Datapoint; applies: boolean; depends: boolean };

    const result: { group: Group; rows: Row[] }[] = [];

    for (const group of data.groups) {
      const rows: Row[] = [];
      for (const memberId of group.members) {
        const dp = data.datapoints.find((d) => d.id === memberId);
        if (!dp) continue;

        const a = applicabilityFor(dp, onboarding);
        if (a === "does-not-apply" && hideExcluded) continue;

        rows.push({
          dp,
          applies: a !== "does-not-apply",
          depends: a === "depends",
        });
      }
      if (rows.length === 0) continue;
      if (categoryFilter !== "All" && group.category !== categoryFilter) continue;

      result.push({ group, rows });
    }
    return result;
  }, [onboarding, categoryFilter, hideExcluded]);

  // Progress: count applicable rows (not "depends" or excluded), and how many checked
  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const { rows } of groupsWithRows) {
      for (const row of rows) {
        if (!row.applies) continue;
        total += 1;
        if (getAnswer(row.dp.id).checked) done += 1;
      }
    }
    return { total, done };
  }, [groupsWithRows, getAnswer]);

  return (
    <section>
      {/* Progress header */}
      <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-blue-900">Progress</span>
          <span className="text-sm text-blue-900">
            {stats.done} of {stats.total} datapoints collected
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-blue-100">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{
              width: stats.total === 0 ? "0%" : `${(stats.done / stats.total) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        {(["All", "General", "Environmental", "Social", "Governance"] as const).map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1 text-sm ${
                categoryFilter === cat
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          )
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={hideExcluded}
            onChange={(e) => setHideExcluded(e.target.checked)}
          />
          Hide excluded rows
        </label>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {groupsWithRows.map(({ group, rows }) => (
          <GroupSection
            key={group.id}
            group={group}
            rows={rows}
            getAnswer={getAnswer}
            setAnswer={setAnswer}
          />
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Group section (collapsible)
// ------------------------------------------------------------------

function GroupSection({
  group,
  rows,
  getAnswer,
  setAnswer,
}: {
  group: Group;
  rows: { dp: Datapoint; applies: boolean; depends: boolean }[];
  getAnswer: ReturnType<typeof useAppState>["getAnswer"];
  setAnswer: ReturnType<typeof useAppState>["setAnswer"];
}) {
  const [open, setOpen] = useState(false);

  const applicableRows = rows.filter((r) => r.applies);
  const checkedCount = applicableRows.filter(
    (r) => getAnswer(r.dp.id).checked
  ).length;

  return (
    <div className="rounded border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex-1">
          <div className="font-medium text-gray-900">{group.disclosure}</div>
          <div className="text-xs text-gray-500">
            {group.category} · {applicableRows.length} datapoint
            {applicableRows.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            {checkedCount}/{applicableRows.length}
          </span>
          <span className="text-gray-400">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          {rows.map((row) => (
            <Row
              key={row.dp.id}
              dp={row.dp}
              applies={row.applies}
              depends={row.depends}
              answer={getAnswer(row.dp.id)}
              onCheck={(checked) =>
                setAnswer(row.dp.id, { checked })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Single row
// ------------------------------------------------------------------

function Row({
  dp,
  applies,
  depends,
  answer,
  onCheck,
}: {
  dp: Datapoint;
  applies: boolean;
  depends: boolean;
  answer: { checked: boolean };
  onCheck: (checked: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 border-b border-gray-200 py-2 last:border-b-0 ${
        !applies ? "opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={answer.checked}
        disabled={!applies}
        onChange={(e) => onCheck(e.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs text-gray-500">{dp.id}</span>
          <span
            className={
              dp.status === "Mandatory"
                ? "rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800"
                : "rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800"
            }
          >
            {dp.status}
          </span>
          {depends && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              Check if applies
            </span>
          )}
          {dp.calculated && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-800">
              Computed
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-gray-900">{dp.datapoint}</div>
        {depends && dp.triggeringQuestion && (
          <div className="mt-1 text-xs italic text-gray-600">
            {dp.triggeringQuestion}
          </div>
        )}
        <div className="mt-1 text-xs text-gray-500">
          ¶{dp.paragraphRef} · {dp.dataType}
          {dp.unit && dp.unit !== "—" ? ` · ${dp.unit}` : ""}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Onboarding (unchanged from Step 2)
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

function Question({ label, children }: { label: string; children: React.ReactNode }) {
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