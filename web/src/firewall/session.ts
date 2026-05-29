import { SESSION_TOKEN_KEY } from "./constants"

export function readSessionToken() {
  const params = new URLSearchParams(window.location.search)
  const fromURL = params.get("token")?.trim()
  if (fromURL) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, fromURL)
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.hash
    )
    return fromURL
  }

  return window.localStorage.getItem(SESSION_TOKEN_KEY) ?? ""
}
