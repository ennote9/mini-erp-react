import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n";

type Props = {
  issues: string[];
  /** When false, banner is not rendered (e.g. demo preview). */
  show: boolean;
  className?: string;
  /** For Playwright / a11y */
  testId?: string;
};

/**
 * Shared domain validation messaging for workspace, station, batch preview, and template editor.
 */
export function LabelDomainIssuesBanner({ issues, show, className, testId = "labels-domain-issues" }: Props) {
  const { t } = useTranslation();
  if (!show || issues.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid={testId}
      className={cn(
        "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100",
        className,
      )}
    >
      <p className="font-medium">{t("labels.workspace.domainIssuesTitle")}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {issues.map((msg, i) => (
          <li key={`${i}-${msg.slice(0, 40)}`}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
