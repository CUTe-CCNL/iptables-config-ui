/* eslint-disable react-hooks/incompatible-library */
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type DataTableProps<TData, TValue> = {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  empty: string
  className?: string
  ariaLabel?: string
  density?: "default" | "compact"
  stickyHeader?: boolean
}

export function DataTable<TData, TValue>({
  data,
  columns,
  empty,
  className,
  ariaLabel,
  density = "default",
  stickyHeader = true,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm",
        className
      )}
    >
      <div className="overflow-x-auto">
        <Table aria-label={ariaLabel}>
          <TableHeader className={cn(stickyHeader && "sticky top-0 z-10")}>
            {table.getHeaderGroups().map((group) => (
              <TableRow
                key={group.id}
                className="bg-muted/80 hover:bg-muted/80"
              >
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      "text-xs font-semibold tracking-normal whitespace-nowrap uppercase",
                      density === "compact" ? "h-8 px-2" : "h-9"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "align-middle",
                        density === "compact" && "px-2 py-1.5"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
