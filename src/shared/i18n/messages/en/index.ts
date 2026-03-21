import type { MessageTree } from "../../resolve";
import { coreEn } from "./core";
import { settingsEn } from "./settings";
import { dashboardEn } from "./dashboard";
import { domainEn } from "./domain";
import { workspaceProfileEn } from "./workspaceProfile";
import { docCommonEn } from "./docCommon";
import { opsEn } from "./ops";
import { masterPagesEn } from "./masterPages";

/** English message tree (source of truth + fallback). */
export const enMessages: MessageTree = {
  ...coreEn,
  settings: settingsEn as unknown as MessageTree,
  dashboard: dashboardEn as unknown as MessageTree,
  domain: domainEn as unknown as MessageTree,
  workspaceProfile: workspaceProfileEn as unknown as MessageTree,
  doc: docCommonEn as unknown as MessageTree,
  ops: opsEn as unknown as MessageTree,
  master: masterPagesEn as unknown as MessageTree,
};
