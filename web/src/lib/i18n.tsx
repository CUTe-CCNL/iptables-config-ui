/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

const zhTW = {
  appRenderFailed: "介面渲染失敗",
  loadingHostStatus: "正在載入主機狀態",
  modeMock: "模擬模式",
  modeLive: "正式模式",
  rootUser: "root",
  nonRootUser: "非 root",
  commandsMissing: "命令缺少",
  commandsReady: "命令就緒",
  pendingCount: "{count} 項待套用",
  refresh: "重新整理",
  validate: "驗證",
  apply: "套用",
  rollback: "復原",
  shutdown: "關閉",
  useMockModeHint: "本機開發時若無法使用 iptables，請改用模擬模式。",
  snapshotDriftTitle: "線上規則已變更",
  snapshotDriftHint:
    "目前草稿已保留。請重新整理載入最新 iptables 快照，確認差異後再套用。",
  sessionTokenMissingTitle: "缺少工作階段 token",
  sessionTokenMissingDescription:
    "請開啟伺服器輸出的含 token 網址，或先在總覽貼上 token，再修改規則。",
  tabOverview: "總覽",
  tabFilter: "Filter",
  tabNat: "NAT",
  tabRaw: "Raw",
  toastRulesRefreshedTitle: "規則已重新整理",
  toastRulesRefreshedDescription: "已載入目前線上的 iptables 快照。",
  toastRefreshFailedTitle: "重新整理失敗",
  toastDraftInvalidTitle: "草稿無效",
  toastDraftValidTitle: "草稿有效",
  toastDraftValidDescription: "伺服器已接受目前規則集。",
  toastValidationFailedTitle: "驗證失敗",
  toastRulesAppliedTitle: "規則已套用",
  toastRulesAppliedDescription: "線上的 iptables 規則已更新。",
  toastRollbackRestoredTitle: "已還原復原點",
  toastRollbackRestoredDescription: "已重新啟用前一次套用前的記憶體快照。",
  toastServerShuttingDownTitle: "伺服器正在關閉",
  toastServerShuttingDownDescription: "本機 Go 服務已接受關閉請求。",
  toastRuleUpdated: "規則已更新",
  toastRuleAdded: "規則已新增",
  statusListenAddress: "監聽位址",
  statusSnapshot: "快照",
  statusFilterRules: "Filter 規則",
  statusNatRules: "NAT 規則",
  statusRawLines: "Raw 行數",
  statusPendingChanges: "待套用變更",
  unavailable: "不可用",
  sessionTitle: "工作階段",
  sessionDescription: "受 token 保護的 API 操作",
  ready: "就緒",
  missing: "缺少",
  sessionTokenLabel: "工作階段 token",
  sessionTokenPlaceholder: "貼上伺服器日誌中的 token",
  save: "儲存",
  toastSessionTokenSaved: "工作階段 token 已儲存",
  toastSessionTokenCleared: "工作階段 token 已清除",
  capabilitiesTitle: "功能",
  capabilitiesDescription: "伺服器回報的防火牆功能",
  noCapabilities: "沒有回報功能。",
  commandsTitle: "命令",
  commandsDescription: "主機 iptables 工具可用狀態",
  notFound: "找不到",
  available: "可用",
  noCommandStatus: "尚未載入命令狀態。",
  draftTitle: "草稿",
  draftDescription: "目前可編輯的規則集",
  policies: "政策",
  filter: "Filter",
  nat: "NAT",
  raw: "Raw",
  parserWarningCount: "{count} 個剖析警告",
  unsupportedLinesPreserved: "不支援的行會保留在 Raw 中。",
  columnOrder: "順序",
  columnChain: "鏈",
  chainFilterLabel: "篩選鏈",
  allChains: "全部鏈",
  columnTarget: "目標",
  columnMatch: "條件",
  columnComment: "註解",
  columnActions: "操作",
  moveRuleUp: "上移規則",
  moveRuleDown: "下移規則",
  dragRuleToReorder: "拖動排序規則",
  editRule: "編輯規則",
  deleteRule: "刪除規則",
  filterRulesTitle: "Filter 規則",
  filterRulesDescription: "可編輯的 IPv4 filter 內建與自訂鏈規則。",
  addRule: "新增規則",
  noFilterRules: "這個快照沒有可編輯的 filter 規則。",
  defaultPoliciesTitle: "預設政策",
  natPoliciesTitle: "NAT 政策",
  policiesDescription: "套用草稿時會包含 chain policy 行。",
  customChainsTitle: "自訂鏈",
  customChainsDescription: "自訂鏈會以 policy '-' 宣告，並可承載結構化規則。",
  fieldNewChain: "新鏈名稱",
  addChain: "新增鏈",
  noCustomChains: "沒有自訂鏈。",
  customChainBadge: "自訂",
  deleteChain: "刪除鏈",
  chainInUse: "鏈仍被其他規則引用",
  toastChainAdded: "鏈 {chain} 已新增",
  toastChainDeleted: "鏈 {chain} 已刪除",
  columnType: "類型",
  columnScope: "範圍",
  moveNatRuleUp: "上移 NAT 規則",
  moveNatRuleDown: "下移 NAT 規則",
  deleteNatRule: "刪除 NAT 規則",
  any: "任何",
  anyInterface: "任何介面",
  sourceLabel: "來源",
  natRulesTitle: "NAT / 連接埠轉發",
  natRulesDescription:
    "結構化 DNAT 與 MASQUERADE 規則，可放在 NAT 內建或自訂鏈。",
  noNatRules: "這個快照沒有可編輯的 NAT 規則。",
  columnTable: "表",
  columnLine: "行",
  columnReason: "原因",
  rawTitle: "Raw / 唯讀",
  rawDescription: "不支援的規則會在套用時保留，並顯示於此供檢視。",
  readOnlyCount: "{count} 個唯讀",
  noUnsupportedRules: "沒有偵測到不支援的規則。",
  rawSnapshotTitle: "iptables-save 快照",
  noRawSnapshot: "沒有可用的 raw 快照。",
  editFilterRule: "編輯 filter 規則",
  addFilterRule: "新增 filter 規則",
  filterRuleDialogDescription: "建立 filter 內建或自訂鏈的結構化 IPv4 規則。",
  fieldChain: "鏈",
  fieldTarget: "目標",
  fieldProtocol: "協定",
  fieldSource: "來源",
  fieldDestination: "目的地",
  fieldInputInterface: "輸入介面",
  fieldOutputInterface: "輸出介面",
  fieldSourcePort: "來源連接埠",
  fieldDestinationPort: "目的連接埠",
  fieldComment: "註解",
  fieldSourceCidr: "來源 CIDR",
  commentPlaceholder: "SSH 管理",
  optionAny: "任何",
  optionalPlaceholder: "選填",
  cancel: "取消",
  saveRule: "儲存規則",
  portForwardTitle: "連接埠轉發",
  portForwardDescription: "DNAT 到內部主機。",
  fieldListenPort: "監聽連接埠",
  fieldDestinationIp: "目的 IP",
  addForward: "新增轉發",
  toastPortForwardAdded: "連接埠轉發已新增",
  masqueradeDescription: "對出口流量進行來源 NAT。",
  addMasquerade: "新增 masquerade",
  toastMasqueradeAdded: "MASQUERADE 規則已新增",
  confirmApplyTitle: "套用防火牆草稿",
  confirmApplyDescription:
    "這會用目前草稿取代線上的 IPv4 iptables 規則。伺服器會在此程序執行期間保留一份記憶體復原快照。",
  confirmApplyLabel: "套用規則",
  confirmRollbackTitle: "復原上次套用",
  confirmRollbackDescription: "這會還原前一次成功套用前擷取的記憶體快照。",
  confirmRollbackLabel: "復原",
  confirmShutdownTitle: "關閉本機伺服器",
  confirmShutdownDescription: "這會停止提供 UI 與防火牆 API 的 Go 程序。",
  confirmShutdownLabel: "關閉",
  confirmRefreshTitle: "捨棄草稿變更",
  confirmRefreshDescription:
    "重新整理會捨棄目前草稿，並從線上的 iptables 載入新快照。",
  confirmRefreshLabel: "捨棄並重新整理",
  confirmActionTitle: "確認操作",
  confirmActionLabel: "確認",
  applyFailed: "套用失敗",
  rollbackFailed: "復原失敗",
  shutdownFailed: "關閉失敗",
  actionFailed: "操作失敗",
  switchToLightMode: "切換到亮色模式",
  switchToDarkMode: "切換到深色模式",
  languageSelectorLabel: "語言",
  fixValidationErrors: "修正驗證錯誤",
  unknownError: "未知錯誤",
  validationPortNumber: "連接埠必須是數字",
  validationPortRange: "連接埠必須介於 1 到 65535",
  validationCidrOrIp: "請使用 IPv4 位址或 CIDR",
  validationInterface: "介面名稱無效",
  validationCommentLength: "註解必須為 80 個字元以下",
  validationPortsRequireProtocol: "連接埠需要 tcp 或 udp",
  validationIpv4Address: "請使用 IPv4 位址",
  validationChainName: "鏈名稱無效",
  validationChainExists: "鏈已存在",
  validationUnknownChain: "未知鏈",
  validationUnknownTarget: "未知目標",
} as const

const en: Record<keyof typeof zhTW, string> = {
  appRenderFailed: "UI render failed",
  loadingHostStatus: "Loading host status",
  modeMock: "Mock mode",
  modeLive: "Live mode",
  rootUser: "root",
  nonRootUser: "non-root",
  commandsMissing: "commands missing",
  commandsReady: "commands ready",
  pendingCount: "{count} pending",
  refresh: "Refresh",
  validate: "Validate",
  apply: "Apply",
  rollback: "Rollback",
  shutdown: "Shutdown",
  useMockModeHint:
    "Use mock mode for local development when iptables is unavailable.",
  snapshotDriftTitle: "Live rules changed",
  snapshotDriftHint:
    "Your draft is still preserved. Refresh to load the latest iptables snapshot, then review and apply again.",
  sessionTokenMissingTitle: "Session token is missing",
  sessionTokenMissingDescription:
    "Open the URL printed by the server with the token query string, or paste the token in Overview before mutating rules.",
  tabOverview: "Overview",
  tabFilter: "Filter",
  tabNat: "NAT",
  tabRaw: "Raw",
  toastRulesRefreshedTitle: "Rules refreshed",
  toastRulesRefreshedDescription: "Loaded the current live iptables snapshot.",
  toastRefreshFailedTitle: "Refresh failed",
  toastDraftInvalidTitle: "Draft is invalid",
  toastDraftValidTitle: "Draft is valid",
  toastDraftValidDescription: "The server accepted the current ruleset.",
  toastValidationFailedTitle: "Validation failed",
  toastRulesAppliedTitle: "Rules applied",
  toastRulesAppliedDescription: "Live iptables rules were updated.",
  toastRollbackRestoredTitle: "Rollback restored",
  toastRollbackRestoredDescription:
    "The previous in-memory snapshot is active again.",
  toastServerShuttingDownTitle: "Server shutting down",
  toastServerShuttingDownDescription:
    "The local Go service accepted the shutdown request.",
  toastRuleUpdated: "Rule updated",
  toastRuleAdded: "Rule added",
  statusListenAddress: "Listen address",
  statusSnapshot: "Snapshot",
  statusFilterRules: "Filter rules",
  statusNatRules: "NAT rules",
  statusRawLines: "Raw lines",
  statusPendingChanges: "Pending changes",
  unavailable: "unavailable",
  sessionTitle: "Session",
  sessionDescription: "Token-protected API actions",
  ready: "ready",
  missing: "missing",
  sessionTokenLabel: "Session token",
  sessionTokenPlaceholder: "Paste token from server log",
  save: "Save",
  toastSessionTokenSaved: "Session token saved",
  toastSessionTokenCleared: "Session token cleared",
  capabilitiesTitle: "Capabilities",
  capabilitiesDescription: "Server-reported firewall features",
  noCapabilities: "No capabilities reported.",
  commandsTitle: "Commands",
  commandsDescription: "Host iptables tool availability",
  notFound: "not found",
  available: "available",
  noCommandStatus: "No command status loaded.",
  draftTitle: "Draft",
  draftDescription: "Current editable ruleset",
  policies: "Policies",
  filter: "Filter",
  nat: "NAT",
  raw: "Raw",
  parserWarningCount: "{count} parser warning(s)",
  unsupportedLinesPreserved: "Unsupported lines are preserved in Raw.",
  columnOrder: "Order",
  columnChain: "Chain",
  chainFilterLabel: "Filter chain",
  allChains: "All chains",
  columnTarget: "Target",
  columnMatch: "Match",
  columnComment: "Comment",
  columnActions: "Actions",
  moveRuleUp: "Move rule up",
  moveRuleDown: "Move rule down",
  dragRuleToReorder: "Drag to reorder rule",
  editRule: "Edit rule",
  deleteRule: "Delete rule",
  filterRulesTitle: "Filter Rules",
  filterRulesDescription:
    "Editable IPv4 filter rules for built-in and custom chains.",
  addRule: "Add rule",
  noFilterRules: "No editable filter rules in this snapshot.",
  defaultPoliciesTitle: "Default Policies",
  natPoliciesTitle: "NAT Policies",
  policiesDescription:
    "Chain policy lines are included when applying the draft.",
  customChainsTitle: "Custom chains",
  customChainsDescription:
    "Custom chains are declared with policy '-' and can hold structured rules.",
  fieldNewChain: "New chain",
  addChain: "Add chain",
  noCustomChains: "No custom chains.",
  customChainBadge: "custom",
  deleteChain: "Delete chain",
  chainInUse: "Chain is still referenced by another rule",
  toastChainAdded: "Chain {chain} added",
  toastChainDeleted: "Chain {chain} deleted",
  columnType: "Type",
  columnScope: "Scope",
  moveNatRuleUp: "Move NAT rule up",
  moveNatRuleDown: "Move NAT rule down",
  deleteNatRule: "Delete NAT rule",
  any: "any",
  anyInterface: "any iface",
  sourceLabel: "source",
  natRulesTitle: "NAT / Port Forward",
  natRulesDescription:
    "Structured DNAT and MASQUERADE rules for built-in or custom NAT chains.",
  noNatRules: "No editable NAT rules in this snapshot.",
  columnTable: "Table",
  columnLine: "Line",
  columnReason: "Reason",
  rawTitle: "Raw / Read-only",
  rawDescription:
    "Unsupported rules are preserved during apply and shown for review.",
  readOnlyCount: "{count} read-only",
  noUnsupportedRules: "No unsupported rules detected.",
  rawSnapshotTitle: "iptables-save snapshot",
  noRawSnapshot: "No raw snapshot available.",
  editFilterRule: "Edit filter rule",
  addFilterRule: "Add filter rule",
  filterRuleDialogDescription:
    "Create a structured IPv4 filter rule for a built-in or custom chain.",
  fieldChain: "Chain",
  fieldTarget: "Target",
  fieldProtocol: "Protocol",
  fieldSource: "Source",
  fieldDestination: "Destination",
  fieldInputInterface: "Input interface",
  fieldOutputInterface: "Output interface",
  fieldSourcePort: "Source port",
  fieldDestinationPort: "Destination port",
  fieldComment: "Comment",
  fieldSourceCidr: "Source CIDR",
  commentPlaceholder: "SSH admin",
  optionAny: "any",
  optionalPlaceholder: "optional",
  cancel: "Cancel",
  saveRule: "Save rule",
  portForwardTitle: "Port forward",
  portForwardDescription: "DNAT into an internal host.",
  fieldListenPort: "Listen port",
  fieldDestinationIp: "Destination IP",
  addForward: "Add forward",
  toastPortForwardAdded: "Port forward added",
  masqueradeDescription: "Source NAT for egress traffic.",
  addMasquerade: "Add masquerade",
  toastMasqueradeAdded: "MASQUERADE rule added",
  confirmApplyTitle: "Apply firewall draft",
  confirmApplyDescription:
    "This replaces live IPv4 iptables rules with the current draft. The server keeps one in-memory rollback snapshot while this process is running.",
  confirmApplyLabel: "Apply rules",
  confirmRollbackTitle: "Rollback last apply",
  confirmRollbackDescription:
    "This restores the in-memory snapshot captured before the last successful apply.",
  confirmRollbackLabel: "Rollback",
  confirmShutdownTitle: "Shutdown local server",
  confirmShutdownDescription:
    "This stops the Go process serving the UI and firewall API.",
  confirmShutdownLabel: "Shutdown",
  confirmRefreshTitle: "Discard draft changes",
  confirmRefreshDescription:
    "Refreshing will discard the current draft and load a fresh snapshot from live iptables.",
  confirmRefreshLabel: "Discard and refresh",
  confirmActionTitle: "Confirm action",
  confirmActionLabel: "Confirm",
  applyFailed: "Apply failed",
  rollbackFailed: "Rollback failed",
  shutdownFailed: "Shutdown failed",
  actionFailed: "Action failed",
  switchToLightMode: "Switch to light mode",
  switchToDarkMode: "Switch to dark mode",
  languageSelectorLabel: "Language",
  fixValidationErrors: "Fix validation errors",
  unknownError: "Unknown error",
  validationPortNumber: "Port must be a number",
  validationPortRange: "Port must be between 1 and 65535",
  validationCidrOrIp: "Use an IPv4 address or CIDR",
  validationInterface: "Invalid interface name",
  validationCommentLength: "Comment must be 80 characters or fewer",
  validationPortsRequireProtocol: "Ports require tcp or udp",
  validationIpv4Address: "Use an IPv4 address",
  validationChainName: "Invalid chain name",
  validationChainExists: "Chain already exists",
  validationUnknownChain: "Unknown chain",
  validationUnknownTarget: "Unknown target",
}

const translations = {
  "zh-TW": zhTW,
  en,
} as const

const validationMessageKeys: Record<string, TranslationKey> = {
  "Port must be a number": "validationPortNumber",
  "Port must be between 1 and 65535": "validationPortRange",
  "Use an IPv4 address or CIDR": "validationCidrOrIp",
  "Invalid interface name": "validationInterface",
  "Comment must be 80 characters or fewer": "validationCommentLength",
  "Ports require tcp or udp": "validationPortsRequireProtocol",
  "Use an IPv4 address": "validationIpv4Address",
  "Invalid chain name": "validationChainName",
  "Unknown chain": "validationUnknownChain",
  "Unknown target": "validationUnknownTarget",
}

export const DEFAULT_LANGUAGE = "zh-TW"

export const SUPPORTED_LANGUAGES = [
  {
    code: "zh-TW",
    label: "繁體中文",
    shortLabel: "繁中",
    htmlLang: "zh-Hant-TW",
  },
  {
    code: "en",
    label: "English",
    shortLabel: "EN",
    htmlLang: "en",
  },
] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]["code"]
export type TranslationKey = keyof typeof zhTW

type TranslationParams = Record<string, number | string>

type I18nProviderProps = {
  children: React.ReactNode
  defaultLanguage?: Language
  storageKey?: string
}

type I18nContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, params?: TranslationParams) => string
  translateValidationMessage: (message: string) => string
}

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined)

function normalizeLanguage(value: string | null): Language | null {
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase()

  if (
    normalized === "zh" ||
    normalized === "zh-tw" ||
    normalized === "zh-hant" ||
    normalized.startsWith("zh-hant-")
  ) {
    return "zh-TW"
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en"
  }

  return null
}

function languageMeta(language: Language) {
  return (
    SUPPORTED_LANGUAGES.find((item) => item.code === language) ??
    SUPPORTED_LANGUAGES[0]
  )
}

function interpolate(message: string, params?: TranslationParams) {
  if (!params) {
    return message
  }

  return message.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

export function I18nProvider({
  children,
  defaultLanguage = DEFAULT_LANGUAGE,
  storageKey = "iptables-config-ui-language",
}: I18nProviderProps) {
  const [language, setLanguageState] = React.useState<Language>(() => {
    const storedLanguage = normalizeLanguage(localStorage.getItem(storageKey))
    return storedLanguage ?? defaultLanguage
  })

  const setLanguage = React.useCallback(
    (nextLanguage: Language) => {
      localStorage.setItem(storageKey, nextLanguage)
      setLanguageState(nextLanguage)
    },
    [storageKey]
  )

  React.useEffect(() => {
    document.documentElement.lang = languageMeta(language).htmlLang
  }, [language])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== storageKey) {
        return
      }

      setLanguageState(normalizeLanguage(event.newValue) ?? defaultLanguage)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultLanguage, storageKey])

  const t = React.useCallback(
    (key: TranslationKey, params?: TranslationParams) => {
      return interpolate(translations[language][key], params)
    },
    [language]
  )

  const translateValidationMessage = React.useCallback(
    (message: string) => {
      const key = validationMessageKeys[message]
      return key ? t(key) : message
    },
    [t]
  )

  const value = React.useMemo(
    () => ({
      language,
      setLanguage,
      t,
      translateValidationMessage,
    }),
    [language, setLanguage, t, translateValidationMessage]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = React.useContext(I18nContext)

  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider")
  }

  return context
}
