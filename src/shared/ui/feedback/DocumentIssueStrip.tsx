import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";
import type { Issue } from "@/shared/issues";
import { issuesToDisplayLists } from "@/shared/i18n/issueDisplay";

export type DocumentIssueStripProps = {
  /** Issues to show (translated in-strip). */
  issues: Issue[];
};

/**
 * Reusable document-issue strip and expandable panel for PO/SO.
 * Preserves existing doc-health-strip* look and behavior (collapsed summary, chevron, expanded list).
 * Renders nothing when both errors and warnings are empty.
 */
export function DocumentIssueStrip({ issues }: DocumentIssueStripProps) {
  const { t } = useTranslation();
  const { errors, warnings } = useMemo(
    () => issuesToDisplayLists(issues, t),
    [issues, t],
  );
  const [expanded, setExpanded] = useState(false);
  const totalCount = errors.length + warnings.length;
  const hasAny = totalCount > 0;

  useEffect(() => {
    if (totalCount <= 1) setExpanded(false);
  }, [totalCount]);

  if (!hasAny) return null;

  return (
    <div className="doc-health-strip-wrap">
      <div className="doc-health-strip" role="status" aria-live="polite">
        <span className="doc-health-strip__label">{t("ops.issueStrip.label")}</span>
        <span className="doc-health-strip__sep">·</span>
        {errors.length > 0 && (
          <span className="doc-health-strip__errors">
            {errors.length}{" "}
            {errors.length === 1 ? t("ops.issueStrip.error") : t("ops.issueStrip.errors")}
          </span>
        )}
        {errors.length > 0 && warnings.length > 0 && (
          <span className="doc-health-strip__sep">·</span>
        )}
        {warnings.length > 0 && (
          <span className="doc-health-strip__warnings">
            {warnings.length}{" "}
            {warnings.length === 1 ? t("ops.issueStrip.warning") : t("ops.issueStrip.warnings")}
          </span>
        )}
        {totalCount === 1 && (errors.length === 1 ? (
          <>
            <span className="doc-health-strip__sep">·</span>
            <span className="doc-health-strip__msg">{errors[0]}</span>
          </>
        ) : warnings.length === 1 ? (
          <>
            <span className="doc-health-strip__sep">·</span>
            <span className="doc-health-strip__msg">{warnings[0]}</span>
          </>
        ) : null)}
        {totalCount > 1 && (
          <button
            type="button"
            className="doc-health-strip__chevron"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t("ops.issueStrip.collapseAria") : t("ops.issueStrip.expandAria")}
          >
            <span className="doc-health-strip__sep">·</span>
            {expanded ? (
              <ChevronUp className="doc-health-strip__chevron-icon" aria-hidden />
            ) : (
              <ChevronDown className="doc-health-strip__chevron-icon" aria-hidden />
            )}
          </button>
        )}
      </div>
      {expanded && totalCount > 1 && (
        <div className="doc-health-strip-panel">
          {errors.length > 0 && (
            <div className="doc-health-strip-panel__section">
              <div className="doc-health-strip-panel__section-title">{t("ops.issueStrip.errorsTitle")}</div>
              <ul className="doc-health-strip-panel__list" role="list">
                {errors.map((msg, i) => (
                  <li
                    key={i}
                    className="doc-health-strip-panel__item doc-health-strip-panel__item--error"
                    role="listitem"
                  >
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="doc-health-strip-panel__section">
              <div className="doc-health-strip-panel__section-title">{t("ops.issueStrip.warningsTitle")}</div>
              <ul className="doc-health-strip-panel__list" role="list">
                {warnings.map((msg, i) => (
                  <li
                    key={i}
                    className="doc-health-strip-panel__item doc-health-strip-panel__item--warning"
                    role="listitem"
                  >
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
