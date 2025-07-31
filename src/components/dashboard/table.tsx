"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Play, Pause, Copy, FileText, Eye, Calendar, Clock, Zap } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type TranscriptionEntry = {
  id: string
  timestamp: string // ISO string from Rust
  text: string
  round_trip_ms: number | null
  hold_time_ms: number | null
  status: string
  wav_path: string | null
}

// Shared modal component for entry details
function EntryDetailsModal({ 
  entry, 
  isOpen, 
  onOpenChange 
}: { 
  entry: TranscriptionEntry
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [audio, setAudio] = React.useState<HTMLAudioElement | null>(null)

  const handlePlayAudio = async () => {
    if (!entry.wav_path) return

    try {
      if (audio) {
        if (isPlaying) {
          audio.pause()
          setIsPlaying(false)
        } else {
          audio.play()
          setIsPlaying(true)
        }
      } else {
        // Get base64 audio data from Tauri backend
        const base64Audio = await invoke<string>("get_audio_base64", { path: entry.wav_path })
        const newAudio = new Audio(base64Audio)
        newAudio.addEventListener('ended', () => setIsPlaying(false))
        setAudio(newAudio)
        newAudio.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error("Failed to play audio:", error)
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(entry.id)
  }

  const handleCopyText = () => {
    navigator.clipboard.writeText(entry.text)
  }

  const handleViewDetails = () => {
    // TODO: Implement view details functionality
    console.log("View details for entry:", entry.id)
  }

  const timestamp = new Date(entry.timestamp)

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transcription Details</SheetTitle>
          <SheetDescription>
            Complete information for this transcription entry.
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 mt-6 px-4">
          {/* Status */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Status:</span>
            <div className={`capitalize px-2 py-1 rounded-full text-xs font-medium ${
              entry.status === "success" ? "bg-green-100 text-green-800" :
              entry.status === "processing" ? "bg-yellow-100 text-yellow-800" :
              entry.status === "failed" ? "bg-red-100 text-red-800" :
              "bg-gray-100 text-gray-800"
            }`}>
              {entry.status}
            </div>
          </div>

          {/* ID */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Entry ID:</span>
            </div>
            <div className="font-mono text-sm bg-muted p-2 rounded">
              {entry.id}
            </div>
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date & Time:</span>
            </div>
            <div className="text-sm">
              {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}
            </div>
          </div>

          {/* Full Text */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Transcription Text:</span>
            </div>
            <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">
              {entry.text}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Performance:</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Full Latency</div>
                <div className="text-sm font-medium">
                  {entry.round_trip_ms ? `${entry.round_trip_ms}ms` : "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Hold Time</div>
                <div className="text-sm font-medium">
                  {entry.hold_time_ms ? `${(entry.hold_time_ms / 1000).toFixed(2)}s` : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Audio */}
          {entry.wav_path && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Audio:</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayAudio}
                className="w-full justify-start"
              >
                {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {isPlaying ? "Pause Audio" : "Play Audio"}
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-4 border-t">
            <div className="text-sm font-medium">Actions:</div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleCopyId}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Entry ID
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleCopyText}
              >
                <FileText className="mr-2 h-4 w-4" />
                Copy Transcription Text
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleViewDetails}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export const columns: ColumnDef<TranscriptionEntry>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "text",
    header: "Text",
    cell: ({ row }) => {
      const entry = row.original
      const [isModalOpen, setIsModalOpen] = React.useState(false)

      return (
        <>
          <div 
            className="min-w-0 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg truncate cursor-pointer hover:text-blue-600 hover:underline" 
            title={row.getValue("text")}
            onClick={() => setIsModalOpen(true)}
          >
            {row.getValue("text")}
          </div>
          <EntryDetailsModal 
            entry={entry} 
            isOpen={isModalOpen} 
            onOpenChange={setIsModalOpen}
          />
        </>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <div className="flex justify-center">
          <div className={`capitalize px-2 py-1 rounded-full text-xs font-medium ${
            status === "success" ? "bg-green-100 text-green-800" :
            status === "processing" ? "bg-yellow-100 text-yellow-800" :
            status === "failed" ? "bg-red-100 text-red-800" :
            "bg-gray-100 text-gray-800"
          }`}>
            {status}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const timestampStr = row.getValue("timestamp") as string
      const timestamp = new Date(timestampStr)
      return (
        <div className="text-sm">
          {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}
        </div>
      )
    },
  },
  {
    accessorKey: "round_trip_ms",
    header: () => <div className="text-right">Full Latency (ms)</div>,
    cell: ({ row }) => {
      const latency = row.getValue("round_trip_ms") as number | null
      return (
        <div className="text-right font-medium">
          {latency ? `${latency}ms` : "N/A"}
        </div>
      )
    },
  },
  {
    accessorKey: "hold_time_ms",
    header: () => <div className="text-right">Hold Time (s)</div>,
    cell: ({ row }) => {
      const holdTime = row.getValue("hold_time_ms") as number | null
      return (
        <div className="text-right font-medium">
          {holdTime ? `${(holdTime / 1000).toFixed(2)}s` : "N/A"}
        </div>
      )
    },
  },
  {
    accessorKey: "wav_path",
    header: "Audio",
    cell: ({ row }) => {
      const wavPath = row.getValue("wav_path") as string | null
      const [isPlaying, setIsPlaying] = React.useState(false)
      const [audio, setAudio] = React.useState<HTMLAudioElement | null>(null)

      const handlePlayAudio = async () => {
        if (!wavPath) return

        try {
          if (audio) {
            if (isPlaying) {
              audio.pause()
              setIsPlaying(false)
            } else {
              audio.play()
              setIsPlaying(true)
            }
          } else {
            // Get base64 audio data from Tauri backend
            const base64Audio = await invoke<string>("get_audio_base64", { path: wavPath })
            const newAudio = new Audio(base64Audio)
            newAudio.addEventListener('ended', () => setIsPlaying(false))
            setAudio(newAudio)
            newAudio.play()
            setIsPlaying(true)
          }
        } catch (error) {
          console.error("Failed to play audio:", error)
        }
      }

      if (!wavPath) {
        return <div className="text-muted-foreground text-sm">N/A</div>
      }

      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayAudio}
          disabled={!wavPath}
          className="h-8 w-8 p-0"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const entry = row.original
      const [isModalOpen, setIsModalOpen] = React.useState(false)

      return (
        <>
          <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </Button>
            </SheetTrigger>
          </Sheet>
          <EntryDetailsModal 
            entry={entry} 
            isOpen={isModalOpen} 
            onOpenChange={setIsModalOpen}
          />
        </>
      )
    },
  },
]

export function DataTable({ data: propData }: { data?: TranscriptionEntry[] }) {
  const [data, setData] = React.useState<TranscriptionEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  // Use prop data if provided, otherwise fetch from Tauri backend
  React.useEffect(() => {
    if (propData) {
      setData(propData)
      setLoading(false)
    } else {
      const fetchHistory = async () => {
        try {
          setLoading(true)
          const historyData = await invoke<TranscriptionEntry[]>("get_transcription_history")
          setData(historyData)
        } catch (error) {
          console.error("Failed to fetch transcription history:", error)
        } finally {
          setLoading(false)
        }
      }

      fetchHistory()
    }
  }, [propData])

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading transcription history...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter by text..."
          value={(table.getColumn("text")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("text")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className={header.id === "text" ? "max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg" : ""}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  className="h-24 text-center"
                >
                  No transcription history found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
