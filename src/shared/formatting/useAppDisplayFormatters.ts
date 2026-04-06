import { useMemo } from "react";
import { useSettings } from "@/shared/settings";
import { createAppDisplayFormatters } from "./appFormatters";

export function useAppDisplayFormatters() {
  const { settings } = useSettings();
  return useMemo(
    () => createAppDisplayFormatters(settings.general.dateFormat, settings.general.numberFormat),
    [settings.general.dateFormat, settings.general.numberFormat],
  );
}

