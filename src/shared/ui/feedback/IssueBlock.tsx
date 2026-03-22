import type { Issue } from "../../issues";
import { issueSeverityClassName } from "../../issues";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n/context";
import { formatIssueForDisplay } from "@/shared/i18n/issueDisplay";

type IssueBlockProps = {
  /** Page-level issues (e.g. save/form errors). Renders nothing when empty. */
  issues: Issue[];
  /** Optional class for the container. */
  className?: string;
};

/**
 * Compact block for rendering page-level Issue[] (e.g. master-data form/save issues).
 * Renders nothing when issues.length === 0. Dark-theme friendly.
 */
export function IssueBlock({ issues, className }: IssueBlockProps) {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-2 max-w-2xl rounded border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm",
        className,
      )}
    >
      <ul className="list-disc list-inside space-y-0.5">
        {issues.map((issue, idx) => (
          <li
            key={idx}
            className={issueSeverityClassName[issue.severity] ?? issueSeverityClassName.error}
          >
            {formatIssueForDisplay(issue, t)}
          </li>
        ))}
      </ul>
    </div>
  );
}
