import { Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { useI18n } from "@/lib/i18n"

import { IconButton } from "./icon-button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const isDark = theme === "dark"

  return (
    <IconButton
      label={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  )
}
