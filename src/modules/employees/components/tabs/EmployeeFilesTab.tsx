import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import type { EmployeeBusinessFileKind } from "../../model";
import type { EmployeeTabProps } from "./types";
import { Plus, Trash2 } from "lucide-react";

const KINDS: EmployeeBusinessFileKind[] = [
  "instruction",
  "access",
  "agreement",
  "power_of_attorney",
  "signature_scan",
  "other",
];

export function EmployeeFilesTab({ draft, patch }: EmployeeTabProps) {
  const { t } = useTranslation();

  const addFile = () => {
    const id = `file-${Date.now()}`;
    patch((p) => ({
      ...p,
      files: [
        ...p.files,
        {
          id,
          fileKind: "other",
          title: "",
          uploadedAt: new Date().toISOString().slice(0, 10),
          comment: "",
        },
      ],
    }));
  };

  const updateFile = (index: number, next: (typeof draft.files)[0]) => {
    patch((p) => {
      const files = p.files.slice();
      files[index] = next;
      return { ...p, files };
    });
  };

  const removeFile = (index: number) => {
    patch((p) => ({ ...p, files: p.files.filter((_, i) => i !== index) }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div>
          <CardTitle className="text-sm">{t("employees.tabs.files.title")}</CardTitle>
          <CardDescription className="text-xs">{t("employees.tabs.files.hint")}</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addFile}>
          <Plus className="h-3.5 w-3.5" />
          {t("employees.actions.addFile")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.files.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("employees.tabs.files.empty")}</div>
        ) : (
          draft.files.map((f, i) => (
            <div key={f.id} className="grid gap-2 rounded-md border border-border/60 p-2 md:grid-cols-12">
              <div className="md:col-span-2">
                <Label className="text-[10px] text-muted-foreground">{t("employees.fields.fileKind")}</Label>
                <select
                  className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={f.fileKind}
                  onChange={(e) => updateFile(i, { ...f, fileKind: e.target.value as EmployeeBusinessFileKind })}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`employees.fileKind.${k}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <Label className="text-[10px] text-muted-foreground">{t("employees.fields.fileTitle")}</Label>
                <Input
                  className="mt-0.5 h-8 text-xs"
                  value={f.title}
                  onChange={(e) => updateFile(i, { ...f, title: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-[10px] text-muted-foreground">{t("employees.fields.uploadedAt")}</Label>
                <Input
                  type="date"
                  className="mt-0.5 h-8 text-xs"
                  value={f.uploadedAt.slice(0, 10)}
                  onChange={(e) => updateFile(i, { ...f, uploadedAt: e.target.value })}
                />
              </div>
              <div className="md:col-span-4">
                <Label className="text-[10px] text-muted-foreground">{t("employees.fields.fileComment")}</Label>
                <Input
                  className="mt-0.5 h-8 text-xs"
                  value={f.comment}
                  onChange={(e) => updateFile(i, { ...f, comment: e.target.value })}
                />
              </div>
              <div className="flex items-end justify-end md:col-span-1">
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeFile(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
