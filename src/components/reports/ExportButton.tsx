"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportToCSV, type ExportRow } from "@/lib/utils/exportCSV";

interface ExportButtonProps {
  filename: string;
  rows: ExportRow[];
  columns: { key: string; label: string }[];
  label?: string;
  disabled?: boolean;
}

export function ExportButton({
  filename,
  rows,
  columns,
  label = "Export CSV",
  disabled = false,
}: ExportButtonProps) {
  const handleExport = () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    try {
      exportToCSV(filename, rows, columns);
      toast.success("Report exported successfully");
    } catch {
      toast.error("Failed to export report");
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={disabled || rows.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
