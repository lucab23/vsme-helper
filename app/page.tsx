"use client";

import { useEffect, useMemo, useState } from "react";
import vsmeData from "@/data/vsme-data.json";
import { useAppState } from "@/lib/useAppState";
import {
  Datapoint,
  DatapointAnswer,
  Group,
  ModuleType,
  VsmeData,
  isAnswered,
} from "@/lib/types";
import { applicabilityFor, Applicability } from "@/lib/applicability";
import { buildDisclosurePages, DisclosurePage } from "@/lib/disclosures";

const data = vsmeData as VsmeData;

const CALCULATED_FROM: Record<string, string> = {
  "B3-08": "Calculated as (Scope 1 + Scope 2 emissions) / Turnover. Fill in B3-06, B3-07, and B1-08.",
  "B8-08": "Calculated from your HR records: (employees who left during year) / (average employees during year) × 100.",
  "B9-02": "Calculated as (number of accidents in B9-01) / (total hours worked) × 200,000.",
  "B10-02": "Calculated from payroll data as (avg male hourly pay − avg female hourly pay) / avg male hourly pay × 100.",
};

// All disclosure pages, computed once. We filter this per-user based on module.
const ALL_PAGES = buildDisclosurePages(data.groups, data.datapoints);

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
    <main className="min-h-screen">
      {!onboardingComplete ? (
        <div className="mx-auto max-w-3xl p-8">
          <Header showControls={false} />
          <OnboardingForm onComplete={(answers) => setOnboarding(answers)} />
        </div>
      ) : (
        <Wizard
          state={state}
          getAnswer={getAnswer}
          setAnswer={setAnswer}
          exportState={exportState}
          importState={importState}
          resetAll={resetAll}
        />
      )}
    </main>
  );
}

function Header({
  showControls,
  exportState,
  importState,
  resetAll,
}: {
  showControls: boolean;
  exportState?: () => string;
  importState?: (json: string) => void;
  resetAll?: () => void;
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">VSME Helper</h1>
        <p className="text-gray-600">
          A free tool to help SMEs prepare a VSME-compliant sustainability report.
        </p>
      </div>
      {showControls && exportState && importState && resetAll && (
        <SaveLoadControls
          exportState={exportState}
          importState={importState}
          resetAll={resetAll}
        />
      )}
    </header>
  );
}

// ------------------------------------------------------------------
// Wizard: sidebar + content
// ------------------------------------------------------------------

type WizardProps = {
  state: ReturnType<typeof useAppState>["state"];
  getAnswer: ReturnType<typeof useAppState>["getAnswer"];
  setAnswer: ReturnType<typeof useAppState>["setAnswer"];
  exportState: () => string;
  importState: (json: string) => void;
  resetAll: () => void;
};

function Wizard({
  state,
  getAnswer,
  setAnswer,
  exportState,
  importState,
  resetAll,
}: WizardProps) {
  // Filter pages by selected module
  const pages = useMemo(() => {
    return ALL_PAGES.filter((p) => {
      if (state.onboarding.module === "Basic") return p.module === "Basic";
      return true; // Comprehensive users see Basic + Comprehensive
    });
  }, [state.onboarding.module]);

  const [currentCode, setCurrentCode] = useState<string>(pages[0]?.code ?? "B1");

  // If filters change and the current page is no longer in the list,
  // reset to the first available page.
  useEffect(() => {
    if (!pages.find((p) => p.code === currentCode)) {
      setCurrentCode(pages[0]?.code ?? "B1");
    }
  }, [pages, currentCode]);

  const currentIndex = pages.findIndex((p) => p.code === currentCode);
  const currentPage = pages[currentIndex];

  // Pre-compute applicability and progress per page so the sidebar can show counts
  const pageStats = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const page of pages) {
      let total = 0;
      let done = 0;
      for (const gid of page.groupIds) {
        const group = data.groups.find((g) => g.id === gid);
        if (!group) continue;
        for (const memberId of group.members) {
          const dp = data.datapoints.find((d) => d.id === memberId);
          if (!dp) continue;
          const a = applicabilityFor(dp, state.onboarding);
          if (a === "does-not-apply") continue;
          if (dp.calculated) continue;
          total += 1;
          if (isAnswered(getAnswer(dp.id))) done += 1;
        }
      }
      m.set(page.code, { total, done });
    }
    return m;
  }, [pages, state.onboarding, getAnswer]);

  // Overall progress across all pages
  const overall = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const stats of pageStats.values()) {
      total += stats.total;
      done += stats.done;
    }
    return { total, done };
  }, [pageStats]);

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentCode(pages[currentIndex - 1].code);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goNext = () => {
    if (currentIndex < pages.length - 1) {
      setCurrentCode(pages[currentIndex + 1].code);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl gap-8 p-8">
      {/* Sidebar */}
      <aside className="sticky top-8 hidden w-64 shrink-0 self-start lg:block">
        <Sidebar
          pages={pages}
          currentCode={currentCode}
          onSelect={(code) => {
            setCurrentCode(code);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          pageStats={pageStats}
          overall={overall}
        />
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <Header
          showControls
          exportState={exportState}
          importState={importState}
          resetAll={resetAll}
        />

        {/* Mobile sidebar fallback: simple page selector */}
        <div className="mb-6 lg:hidden">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Disclosure
          </label>
          <select
            value={currentCode}
            onChange={(e) => setCurrentCode(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {pages.map((p) => {
              const s = pageStats.get(p.code);
              return (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.title} ({s ? `${s.done}/${s.total}` : ""})
                </option>
              );
            })}
          </select>
        </div>

        {currentPage && (
          <DisclosurePageView
            page={currentPage}
            onboarding={state.onboarding}
            getAnswer={getAnswer}
            setAnswer={setAnswer}
          />
        )}

        <NavBar
          currentIndex={currentIndex}
          total={pages.length}
          prev={pages[currentIndex - 1]}
          next={pages[currentIndex + 1]}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sidebar
// ------------------------------------------------------------------

function Sidebar({
  pages,
  currentCode,
  onSelect,
  pageStats,
  overall,
}: {
  pages: DisclosurePage[];
  currentCode: string;
  onSelect: (code: string) => void;
  pageStats: Map<string, { total: number; done: number }>;
  overall: { total: number; done: number };
}) {
  // Group by module so we can show "Basic" / "Comprehensive" headings
  const basicPages = pages.filter((p) => p.module === "Basic");
  const comprehensivePages = pages.filter((p) => p.module === "Comprehensive");

  return (
    <nav className="space-y-6 text-sm">
      {/* Overall progress */}
      <div className="rounded border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-blue-900">Overall progress</span>
          <span className="text-xs text-blue-900">
            {overall.done}/{overall.total}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-blue-100">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{
              width: overall.total === 0 ? "0%" : `${(overall.done / overall.total) * 100}%`,
            }}
          />
        </div>
      </div>

      {basicPages.length > 0 && (
        <SidebarGroup
          label="Basic Module"
          pages={basicPages}
          currentCode={currentCode}
          onSelect={onSelect}
          pageStats={pageStats}
        />
      )}

      {comprehensivePages.length > 0 && (
        <SidebarGroup
          label="Comprehensive Module"
          pages={comprehensivePages}
          currentCode={currentCode}
          onSelect={onSelect}
          pageStats={pageStats}
        />
      )}
    </nav>
  );
}

function SidebarGroup({
  label,
  pages,
  currentCode,
  onSelect,
  pageStats,
}: {
  label: string;
  pages: DisclosurePage[];
  currentCode: string;
  onSelect: (code: string) => void;
  pageStats: Map<string, { total: number; done: number }>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </h3>
      <ul className="space-y-0.5">
        {pages.map((p) => {
          const stats = pageStats.get(p.code);
          const total = stats?.total ?? 0;
          const done = stats?.done ?? 0;
          const complete = total > 0 && done === total;
          const active = p.code === currentCode;

          return (
            <li key={p.code}>
              <button
                onClick={() => onSelect(p.code)}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left ${
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <SidebarStatusDot complete={complete} active={active} hasProgress={done > 0} />
                  <span className="truncate">
                    <span className="font-mono">{p.code}</span>
                    <span className={active ? "text-gray-300" : "text-gray-500"}>
                      {" "}— {p.title}
                    </span>
                  </span>
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    active ? "text-gray-300" : "text-gray-400"
                  }`}
                >
                  {total > 0 ? `${done}/${total}` : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SidebarStatusDot({
  complete,
  active,
  hasProgress,
}: {
  complete: boolean;
  active: boolean;
  hasProgress: boolean;
}) {
  if (complete) {
    return (
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
          active ? "bg-green-400 text-gray-900" : "bg-green-600 text-white"
        }`}
      >
        ✓
      </span>
    );
  }
  if (hasProgress) {
    return (
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          active ? "bg-blue-400" : "bg-blue-600"
        }`}
      />
    );
  }
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${
        active ? "bg-gray-400" : "bg-gray-300"
      }`}
    />
  );
}

// ------------------------------------------------------------------
// Disclosure page (the main content area)
// ------------------------------------------------------------------

function DisclosurePageView({
  page,
  onboarding,
  getAnswer,
  setAnswer,
}: {
  page: DisclosurePage;
  onboarding: ReturnType<typeof useAppState>["state"]["onboarding"];
  getAnswer: ReturnType<typeof useAppState>["getAnswer"];
  setAnswer: ReturnType<typeof useAppState>["setAnswer"];
}) {
  type Row = { dp: Datapoint; applicability: Applicability };

  const groups = useMemo(() => {
    const result: { group: Group; rows: Row[] }[] = [];
    for (const gid of page.groupIds) {
      const group = data.groups.find((g) => g.id === gid);
      if (!group) continue;
      const rows: Row[] = [];
      for (const memberId of group.members) {
        const dp = data.datapoints.find((d) => d.id === memberId);
        if (!dp) continue;
        const a = applicabilityFor(dp, onboarding);
        // We still show "does-not-apply" rows here, just greyed; lets the user
        // see what they were skipped from. Day 3 may revisit this.
        rows.push({ dp, applicability: a });
      }
      if (rows.length === 0) continue;
      result.push({ group, rows });
    }
    return result;
  }, [page, onboarding]);

  return (
    <article>
      <div className="mb-6">
        <div className="font-mono text-sm text-gray-500">{page.code}</div>
        <h2 className="text-2xl font-semibold">{page.title}</h2>
      </div>

      <div className="space-y-6">
        {groups.map(({ group, rows }) => (
          <div key={group.id}>
            {/* Only show a group sub-header if the page has multiple groups */}
            {groups.length > 1 && (
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
                {group.disclosure}
              </h3>
            )}
            <div className="space-y-3">
              {rows.map((row) => (
                <Row
                  key={row.dp.id}
                  dp={row.dp}
                  applies={row.applicability !== "does-not-apply"}
                  depends={row.applicability === "depends"}
                  answer={getAnswer(row.dp.id)}
                  onUpdate={(patch) => setAnswer(row.dp.id, patch)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

// ------------------------------------------------------------------
// Bottom navigation bar
// ------------------------------------------------------------------

function NavBar({
  currentIndex,
  total,
  prev,
  next,
  onPrev,
  onNext,
}: {
  currentIndex: number;
  total: number;
  prev?: DisclosurePage;
  next?: DisclosurePage;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-12 flex items-center justify-between border-t border-gray-200 pt-6">
      <button
        onClick={onPrev}
        disabled={!prev}
        className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {prev ? `← ${prev.code} ${prev.title}` : "← Previous"}
      </button>
      <span className="text-xs text-gray-500">
        Step {currentIndex + 1} of {total}
      </span>
      <button
        onClick={onNext}
        disabled={!next}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {next ? `${next.code} ${next.title} →` : "Next →"}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------
// Save / Load / Reset controls (unchanged)
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
// Row with inline data entry (unchanged)
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
      className={`rounded border border-gray-200 bg-white p-4 ${
        !applies && !answer.notApplicable ? "opacity-60" : ""
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
            {dp.paragraphRef} · {dp.dataType}
            {dp.unit && dp.unit !== "—" ? ` · ${dp.unit}` : ""}
          </div>

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
// Data input (unchanged)
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
    const sep = value.indexOf("|");
    const yn = sep === -1 ? value : value.slice(0, sep);
    const txt = sep === -1 ? "" : value.slice(sep + 1);

    const setYn = (next: string) => onChange(`${next}|${txt}`);
    const setTxt = (next: string) => onChange(`${yn}|${next}`);

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