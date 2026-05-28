/* eslint-disable react-hooks/incompatible-library */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table"
import { GripVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type SortableDataTableProps<TData, TValue> = {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  empty: string
  dragLabel: string
  getRowId: (row: TData) => string
  onReorder: (activeId: string, overId: string) => void
  className?: string
}

export function SortableDataTable<TData, TValue>({
  data,
  columns,
  empty,
  dragLabel,
  getRowId,
  onReorder,
  className,
}: SortableDataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  })
  const itemIds = data.map((item) => getRowId(item))
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    onReorder(String(active.id), String(over.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn("overflow-hidden rounded-lg border bg-card", className)}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow
                  key={group.id}
                  className="bg-muted/60 hover:bg-muted/60"
                >
                  <TableHead className="h-9 w-10" />
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="h-9 text-xs font-semibold tracking-normal whitespace-nowrap uppercase"
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
                <SortableContext
                  items={itemIds}
                  strategy={verticalListSortingStrategy}
                >
                  {table.getRowModel().rows.map((row) => (
                    <SortableTableRow
                      key={row.id}
                      row={row}
                      dragLabel={dragLabel}
                      disabled={itemIds.length < 2}
                    />
                  ))}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
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
    </DndContext>
  )
}

function SortableTableRow<TData>({
  row,
  dragLabel,
  disabled,
}: {
  row: Row<TData>
  dragLabel: string
  disabled: boolean
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id as UniqueIdentifier,
    disabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={isDragging ? "selected" : undefined}
      className={cn(isDragging && "relative bg-muted/80 shadow-sm")}
    >
      <TableCell className="w-10 px-2 align-middle">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={setActivatorNodeRef}
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={dragLabel}
              disabled={disabled}
              className="cursor-grab touch-none active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical data-icon="inline-start" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{dragLabel}</TooltipContent>
        </Tooltip>
      </TableCell>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="align-middle">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}
