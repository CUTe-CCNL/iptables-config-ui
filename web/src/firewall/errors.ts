import { ApiError } from "@/api"

import {
  COMMANDS_UNAVAILABLE_MESSAGE,
  SNAPSHOT_DRIFT_MESSAGE,
} from "./constants"
import type { ConfirmAction, ErrorCopy, ErrorDisplay, TFunction } from "./types"

export function errorCopy(t: TFunction): ErrorCopy {
  return {
    unknownError: t("unknownError"),
    snapshotDriftTitle: t("snapshotDriftTitle"),
    snapshotDriftHint: t("snapshotDriftHint"),
    useMockModeHint: t("useMockModeHint"),
  }
}

export function formatErrorDisplay(
  err: unknown,
  copy: ErrorCopy
): ErrorDisplay {
  if (isSnapshotDriftError(err)) {
    return {
      title: copy.snapshotDriftTitle,
      description: copy.snapshotDriftHint,
    }
  }

  const title = formatError(err, copy.unknownError)
  if (isCommandsUnavailableError(err)) {
    return {
      title,
      description: copy.useMockModeHint,
    }
  }

  return { title }
}

export function errorToastDescription(error: ErrorDisplay) {
  return error.description ? `${error.title} ${error.description}` : error.title
}

function formatError(err: unknown, fallback = "Unknown error") {
  if (err instanceof ApiError) {
    return `${err.status}: ${err.message}`
  }

  if (err instanceof Error) {
    return err.message
  }

  return fallback
}

export function isSnapshotDriftError(err: unknown) {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    err.message.includes(SNAPSHOT_DRIFT_MESSAGE)
  )
}

function isCommandsUnavailableError(err: unknown) {
  return (
    (err instanceof ApiError && err.status === 503) ||
    (err instanceof Error && err.message.includes(COMMANDS_UNAVAILABLE_MESSAGE))
  )
}

export function confirmMeta(action: ConfirmAction, t: TFunction) {
  if (action === "apply") {
    return {
      title: t("confirmApplyTitle"),
      description: t("confirmApplyDescription"),
      confirmLabel: t("confirmApplyLabel"),
    }
  }

  if (action === "rollback") {
    return {
      title: t("confirmRollbackTitle"),
      description: t("confirmRollbackDescription"),
      confirmLabel: t("confirmRollbackLabel"),
    }
  }

  if (action === "shutdown") {
    return {
      title: t("confirmShutdownTitle"),
      description: t("confirmShutdownDescription"),
      confirmLabel: t("confirmShutdownLabel"),
    }
  }

  if (action === "refresh") {
    return {
      title: t("confirmRefreshTitle"),
      description: t("confirmRefreshDescription"),
      confirmLabel: t("confirmRefreshLabel"),
    }
  }

  return {
    title: t("confirmActionTitle"),
    description: "",
    confirmLabel: t("confirmActionLabel"),
  }
}

export function actionTitle(action: ConfirmAction, t: TFunction) {
  if (action === "apply") return t("applyFailed")
  if (action === "rollback") return t("rollbackFailed")
  if (action === "shutdown") return t("shutdownFailed")
  if (action === "refresh") return t("toastRefreshFailedTitle")
  return t("actionFailed")
}
