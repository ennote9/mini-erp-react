import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { markdownRepository } from "../repository";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { useTranslation } from "@/shared/i18n/context";
import { Button } from "@/components/ui/button";
import {
  transitionMarkdownRecord,
  supersedeMarkdownRecord,
  isFinalMarkdownStatus,
} from "../service";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";

const LOCAL_ACTOR = "local-operator";

export function MarkdownRecordPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const appRevision = useAppReadModelRevision();
  const [message, setMessage] = useState<string | null>(null);

  const rec = useMemo(() => (id ? markdownRepository.getById(id) : undefined), [id, appRevision]);
  if (!rec) return <div className="doc-page">{t("markdown.notFound")}</div>;

  const item = itemRepository.getById(rec.itemId);
  const wh = warehouseRepository.getById(rec.warehouseId);
  const replacement = rec.supersededByMarkdownId
    ? markdownRepository.getById(rec.supersededByMarkdownId)
    : undefined;
  const supersededFrom = rec.supersedesMarkdownId
    ? markdownRepository.getById(rec.supersedesMarkdownId)
    : undefined;

  const isActive = rec.status === "ACTIVE";
  const finalized = isFinalMarkdownStatus(rec.status);

  const runTransition = (kind: "SOLD" | "CANCELLED" | "WRITTEN_OFF") => {
    setMessage(null);
    const r = transitionMarkdownRecord({ recordId: rec.id, transition: kind, actorId: LOCAL_ACTOR });
    if (!r.success) {
      setMessage(r.error);
      return;
    }
  };

  const runSupersede = () => {
    setMessage(null);
    const r = supersedeMarkdownRecord(rec.id, LOCAL_ACTOR);
    if (!r.success) {
      setMessage(r.error);
      return;
    }
    navigate(`/markdown-journal/${r.newRecord.id}`);
  };

  return (
    <div className="doc-page space-y-3">
      {message ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </div>
      ) : null}
      <div className="rounded-md border border-border/70 p-3">
        <div className="text-sm font-semibold">{t("markdown.record.title")}</div>
        <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
          <div>
            {t("markdown.fields.markdownCode")}: <span className="font-mono">{rec.markdownCode}</span>
          </div>
          <div>
            {t("common.status")}: {t(`markdown.status.${rec.status}`)}
          </div>
          <div>
            {t("markdown.fields.markdownPrice")}: {rec.markdownPrice.toFixed(2)}
          </div>
          <div>
            {t("markdown.fields.reason")}: {t(`markdown.reason.${rec.reasonCode}`)}
          </div>
          <div>
            {t("common.warehouse")}: {wh ? `${wh.code} — ${wh.name}` : rec.warehouseId}
          </div>
          <div>
            {t("markdown.fields.location")}: {rec.locationId ?? "—"}
          </div>
          <div className="sm:col-span-2">{t("common.description")}: {rec.comment ?? "—"}</div>
          <div>{t("markdown.fields.createdAt")}: {rec.createdAt}</div>
          <div>{t("markdown.fields.createdBy")}: {rec.createdBy}</div>
          {rec.batchId ? (
            <div className="sm:col-span-2">
              {t("markdown.fields.batch")}: {rec.batchId}
              {rec.batchSequenceIndex != null && rec.batchSequenceTotal != null
                ? ` (${rec.batchSequenceIndex} / ${rec.batchSequenceTotal})`
                : null}
            </div>
          ) : null}
          {finalized ? (
            <>
              <div>{t("markdown.fields.closedAt")}: {rec.closedAt ?? "—"}</div>
              <div>{t("markdown.fields.closedBy")}: {rec.closedBy ?? "—"}</div>
            </>
          ) : null}
          {rec.status === "SUPERSEDED" && replacement ? (
            <div className="sm:col-span-2">
              {t("markdown.fields.supersededBy")}:{" "}
              <Link className="list-table__link font-mono" to={`/markdown-journal/${replacement.id}`}>
                {replacement.markdownCode}
              </Link>
            </div>
          ) : null}
          {rec.supersedesMarkdownId && supersededFrom ? (
            <div className="sm:col-span-2">
              {t("markdown.fields.supersedes")}:{" "}
              <Link className="list-table__link font-mono" to={`/markdown-journal/${supersededFrom.id}`}>
                {supersededFrom.markdownCode}
              </Link>
            </div>
          ) : null}
        </div>
        {isActive ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => runTransition("SOLD")}>
              {t("markdown.actions.markSold")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runTransition("CANCELLED")}>
              {t("markdown.actions.cancel")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runTransition("WRITTEN_OFF")}>
              {t("markdown.actions.writeOff")}
            </Button>
            <Button type="button" size="sm" variant="default" onClick={runSupersede}>
              {t("markdown.actions.supersede")}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-border/70 p-3 text-xs">
        <div className="mb-2 text-sm font-semibold">{t("markdown.record.baseItemBlock")}</div>
        {item ? (
          <div className="space-y-1">
            <div>
              {t("doc.columns.code")}: {item.code}
            </div>
            <div>
              {t("doc.columns.name")}: {item.name}
            </div>
            <div>
              <Link className="list-table__link" to={`/items/${item.id}`}>
                {t("common.open")}
              </Link>
            </div>
          </div>
        ) : (
          <div>—</div>
        )}
      </div>
    </div>
  );
}
