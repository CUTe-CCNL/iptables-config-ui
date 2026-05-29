import { useMemo, type ComponentProps } from "react"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/lib/i18n"
import { newId } from "@/lib/utils"

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: ComponentProps<typeof Input>["inputMode"]
  type?: ComponentProps<typeof Input>["type"]
}) {
  const id = useMemo(() => newId("field"), [])

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
      />
    </div>
  )
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  formatOption = (option) => option,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: string[]
  formatOption?: (option: string) => string
}) {
  const id = useMemo(() => newId("select"), [])

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {formatOption(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function ErrorList({ errors }: { errors: string[] }) {
  const { t } = useI18n()

  if (!errors.length) return null

  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>{t("fixValidationErrors")}</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {errors.map((error, index) => (
            <li key={`${error}-${index}`}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
