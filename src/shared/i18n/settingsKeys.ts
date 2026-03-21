/** Registry ids use dots; i18n entry keys use double underscore. */
export function settingRegistryIdToI18nKey(id: string): string {
  return id.replace(/\./g, "__");
}
