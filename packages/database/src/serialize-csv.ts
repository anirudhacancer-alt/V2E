export function serializeCsv(
  rows: Record<string, string>[],
  headers: string[]
): string {
  const escapeCell = (value: string): string => {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, "\"\"")}"`;
    }
    return value;
  };

  const lines = [
    headers.map((header) => escapeCell(header)).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCell(row[header] ?? "")).join(",")
    ),
  ];

  return `${lines.join("\n")}\n`;
}
