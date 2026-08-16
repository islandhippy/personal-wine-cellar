function safeCell(value: unknown) {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function makeCsv(headers: string[], rows: unknown[][]) {
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(safeCell).join(","))
    .join("\n")}\n`;
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
