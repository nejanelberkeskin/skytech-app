import { accessErrorDetails } from "./error-details";
export default function AccessProblem({
  problem,
}: {
  problem: { message: string; code?: string; details?: unknown };
}) {
  const lines = accessErrorDetails(problem.code ?? "", problem.details);
  return (
    <div
      role="alert"
      className="border border-red-400/40 rounded-xl p-4 text-sm text-red-200 space-y-2 break-words"
    >
      <p>{problem.message}</p>
      {lines.length > 0 && (
        <ul className="list-disc pl-5">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
