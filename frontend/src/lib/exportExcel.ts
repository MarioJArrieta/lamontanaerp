export interface ExportColumn<T> {
  key: string;
  label: string;
  value: (row: T) => string | number | null;
}

export async function exportToExcel<T>(
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
) {
  // exceljs pesa varios cientos de KB: se carga solo al exportar, no en el bundle inicial.
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map(c => ({
    header: c.label,
    key: c.key,
    width: Math.max(12, c.label.length + 4),
  }));
  for (const row of rows) {
    const record: Record<string, string | number | null> = {};
    for (const c of columns) record[c.key] = c.value(row);
    sheet.addRow(record);
  }
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
