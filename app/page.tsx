import vsmeData from "@/data/vsme-data.json";

type Datapoint = {
  id: string;
  module: "Basic" | "Comprehensive";
  groupId: string;
  disclosure: string;
  datapoint: string;
  status: "Mandatory" | "Conditional" | "Voluntary";
  condition: string;
  triggeringQuestion: string;
  calculated: boolean;
  category: "General" | "Environmental" | "Social" | "Governance";
  dataType: string;
  unit: string;
  paragraphRef: string;
};

export default function Home() {
  const datapoints = vsmeData.datapoints as Datapoint[];

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-2 text-3xl font-bold">VSME Helper</h1>
      <p className="mb-8 text-gray-600">
        {datapoints.length} required datapoints loaded from VSME standard.
      </p>

      <ul className="space-y-2">
        {datapoints.map((dp) => (
          <li
            key={dp.id}
            className="rounded border border-gray-200 p-3 text-sm"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-gray-500">{dp.id}</span>
              <span
                className={
                  dp.status === "Mandatory"
                    ? "rounded bg-red-100 px-2 py-0.5 text-xs text-red-800"
                    : "rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
                }
              >
                {dp.status}
              </span>
              <span className="text-xs text-gray-500">{dp.category}</span>
            </div>
            <div className="mt-1">{dp.datapoint}</div>
            <div className="mt-1 text-xs text-gray-500">
              {dp.disclosure} · ¶{dp.paragraphRef}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}