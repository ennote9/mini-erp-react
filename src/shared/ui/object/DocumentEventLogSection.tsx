import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAuditEventsForEntity } from "../../audit/eventLogRepository";
import { auditEventLabel, auditEventSummary } from "../../audit/eventLogLabels";
import type { AuditEntityType, AuditEventRecord } from "../../audit/eventLogTypes";

type Props = {
  entityType: AuditEntityType;
  entityId: string | undefined;
  /** Bump when document data is refreshed so the list re-reads the store. */
  refresh: number;
};

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export function DocumentEventLogSection({ entityType, entityId, refresh }: Props) {
  const entries = useMemo((): AuditEventRecord[] => {
    if (!entityId) return [];
    return listAuditEventsForEntity(entityType, entityId);
  }, [entityType, entityId, refresh]);

  if (!entityId) return null;

  return (
    <Card className="max-w-2xl border-0 shadow-none mt-6">
      <CardHeader className="p-2 pb-0.5">
        <CardTitle className="text-[0.9rem] font-semibold">Event log</CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-1">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <ul className="doc-event-log space-y-1.5 text-sm max-h-64 overflow-y-auto erp-dark-scrollbar">
            {entries.map((e) => (
              <li
                key={e.id}
                className="doc-event-log__row flex flex-wrap gap-x-2 gap-y-0.5 border-b border-border/50 pb-1.5 last:border-0"
              >
                <span className="text-muted-foreground tabular-nums shrink-0">{formatWhen(e.createdAt)}</span>
                <span className="font-medium text-foreground shrink-0">{auditEventLabel(e.eventType)}</span>
                <span className="text-foreground/90 min-w-0 break-words">{auditEventSummary(e.payload)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
