"use client";

import { useMemo, useState } from "react";
import vsmeData from "@/data/vsme-data.json";
import { useAppState } from "@/lib/useAppState";
import {
  Category,
  Datapoint,
  DatapointAnswer,
  Group,
  ModuleType,
  VsmeData,
  isAnswered,
} from "@/lib/types";
import { applicabilityFor } from "@/lib/applicability";

const data = vsmeData as VsmeData;

// Static map describing how each calculated row is derived. Day 3 will
// actually do the math; for now we just explain it to the user.
const CALCULATED_FROM: Record<string, string> = {
  "B3-08": "Calculated as (Scope 1 + Scope 2 emissions) / Turnover. Fill in B3-06, B3-07, and B1-08.",
  "B8-08": "Calculated from your HR records: (employees who left during year) / (average employees during year) × 100.",
  "B9-02": "Calculated as (number of accidents in B9-01) / (total hours worked) × 200,000.",
  "B10-02": "Calculated from payroll data as (avg male hourly pay − avg female hourly pay) / avg male hourly pay × 100.",
};

export default function Home() {
  const {
    state,
    loaded,
    setOnboarding,
    setAnswer,
    getAnswer,
    resetAll,
    exportState,
    importState,
  } = useAppState();

  if (!loaded) return null;

  const onboardingComplete = state.onboarding.module !== null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">VSME Helper</h1>
          <p className="text-gray-600">
            A free tool to help SMEs prepare a VSME-compliant sustainability report.
          </p>
        </div>
        {onboardingComplete && (
          <SaveLoadControls
            exportState={exportState}
            importState={importState}
            resetAll={resetAll}
          />
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
// Save / Load / Reset controls
// ------------------------------------------------------------------

function SaveLoadControls({
  exportState,
  importState,
  resetAll,
}: {
  exportState: () => string;
  importState: (json: string) => void;
  resetAll: () => void;
}) {
  const handleDownload = () => {
    const blob = new Blob([exportState()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vsme-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importState(reader.result as string);
      } catch (err) {
        alert(`Could not load file: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
    // Reset the input so uploading the same file again still triggers onChange
    e.target.value = "";
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        onClick={handleDownload}
        className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
      >
        Download progress
      </button>
      <label className="cursor-pointer rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
        Upload progress
        <input
          type="file"
          accept="application/json"
          onChange={handleUpload}
          className="hidden"
        />
      </label>
      <button
        onClick={() => {
          if (confirm("This will erase all your progress. Continue?")) {
            resetAll();
          }
        }}
        className="text-gray-500 underline hover:text-gray-700"
      >
        Reset
      </button>
    </div>
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

  type Row = { dp: Datapoint; applies: boolean; depends: boolean };

  const groupsWithRows = useMemo(() => {
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

  // Progress: count applicable, non-calculated rows. Calculated rows are
  // excluded from progress because the user can't directly fill them in.
  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const { rows } of groupsWithRows) {
      for (const row of rows) {
        if (!row.applies) continue;
        if (row.dp.calculated) continue;
        total += 1;
        if (isAnswered(getAnswer(row.dp.id))) done += 1;
      }
    }
    return { total, done };
  }, [groupsWithRows, getAnswer]);

  return (
    <section>
      <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-blue-900">Progress</span>
          <span className="text-sm text-blue-900">
            {stats.done} of {stats.total} datapoints completed
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-blue-100">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{
              width:
                stats.total === 0 ? "0%" : `${(stats.done / stats.total) * 100}%`,
            }}
          />
        </div>
      </div>

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
// Group section
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

  // Count applicable, non-calculated rows
  const fillable = rows.filter((r) => r.applies && !r.dp.calculated);
  const doneCount = fillable.filter((r) => isAnswered(getAnswer(r.dp.id))).length;

  return (
    <div className="rounded border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex-1">
          <div className="font-medium text-gray-900">{group.disclosure}</div>
          <div className="text-xs text-gray-500">
            {group.category} · {fillable.length} datapoint
            {fillable.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={
              fillable.length > 0 && doneCount === fillable.length
                ? "font-medium text-green-700"
                : "text-gray-600"
            }
          >
            {doneCount}/{fillable.length}
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
              onUpdate={(patch) => setAnswer(row.dp.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Row with inline data entry
// ------------------------------------------------------------------

function Row({
  dp,
  applies,
  depends,
  answer,
  onUpdate,
}: {
  dp: Datapoint;
  applies: boolean;
  depends: boolean;
  answer: DatapointAnswer;
  onUpdate: (patch: Partial<DatapointAnswer>) => void;
}) {
  const answered = isAnswered(answer);
  const calc = dp.calculated;

  return (
    <div
      className={`border-b border-gray-200 py-3 last:border-b-0 ${
        !applies && !answer.notApplicable ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            answered
              ? "bg-green-600 text-white"
              : "border-2 border-gray-300 bg-white"
          }`}
          aria-hidden
        >
          {answered ? "✓" : ""}
        </div>

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
            {calc && (
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

          {/* Input area */}
          <div className="mt-3">
            {calc ? (
              <CalculatedField dp={dp} />
            ) : answer.notApplicable ? (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="italic">Marked as not applicable.</span>
                <button
                  onClick={() => onUpdate({ notApplicable: false })}
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Undo
                </button>
              </div>
            ) : (
              <DataInput
                dp={dp}
                value={answer.value}
                onChange={(value) => onUpdate({ value })}
              />
            )}
          </div>

          {/* Bottom row of meta actions */}
          {!calc && !answer.notApplicable && applies && (
            <button
              onClick={() => onUpdate({ notApplicable: true, value: "" })}
              className="mt-2 text-xs text-gray-500 underline hover:text-gray-700"
            >
              Mark as not applicable
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Data input — chooses widget based on dataType
// ------------------------------------------------------------------

function DataInput({
  dp,
  value,
  onChange,
}: {
  dp: Datapoint;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = dp.dataType;

  if (t === "number") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value"
          className="w-48 rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        {dp.unit && dp.unit !== "—" && (
          <span className="text-sm text-gray-500">{dp.unit}</span>
        )}
      </div>
    );
  }

  if (t === "yes-no") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => onChange(value === "yes" ? "" : "yes")}
          className={`rounded border-2 px-4 py-1 text-sm font-medium ${
            value === "yes"
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 hover:border-gray-400"
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => onChange(value === "no" ? "" : "no")}
          className={`rounded border-2 px-4 py-1 text-sm font-medium ${
            value === "no"
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 hover:border-gray-400"
          }`}
        >
          No
        </button>
      </div>
    );
  }

  if (t === "yes-no + text") {
    // Try to parse "yes|<text>" or "no|<text>"; default empty parts otherwise.
    const sep = value.indexOf("|");
    const yn = sep === -1 ? value : value.slice(0, sep);
    const txt = sep === -1 ? "" : value.slice(sep + 1);

    const setYn = (next: string) => {
      onChange(`${next}|${txt}`);
    };
    const setTxt = (next: string) => {
      onChange(`${yn}|${next}`);
    };

    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setYn(yn === "yes" ? "" : "yes")}
            className={`rounded border-2 px-4 py-1 text-sm font-medium ${
              yn === "yes"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => setYn(yn === "no" ? "" : "no")}
            className={`rounded border-2 px-4 py-1 text-sm font-medium ${
              yn === "no"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            No
          </button>
        </div>
        <textarea
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder="Add details if relevant"
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          rows={2}
        />
      </div>
    );
  }

  if (t === "text") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your response"
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        rows={3}
      />
    );
  }

  // Fallback for list / table / matrix / dropdown — handled properly on Day 3.
  // For now, accept free text so the user can at least record their answer.
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter your response (${t})`}
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        rows={3}
      />
      <p className="mt-1 text-xs text-gray-500">
        A structured editor for &quot;{t}&quot; data is coming soon. For now you
        can paste or write a free-text answer.
      </p>
    </div>
  );
}

function CalculatedField({ dp }: { dp: Datapoint }) {
  return (
    <div className="rounded border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-900">
      <strong>Computed automatically.</strong>{" "}
      {CALCULATED_FROM[dp.id] ?? "This value will be calculated from your other inputs."}
    </div>
  );
}

// ------------------------------------------------------------------
// Onboarding (unchanged)
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