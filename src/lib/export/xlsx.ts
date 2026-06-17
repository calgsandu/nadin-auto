import * as XLSX from "xlsx";

/** Wrap a SheetJS workbook in a downloadable .xlsx HTTP response. */
export function xlsxResponse(workbook: XLSX.WorkBook, filename: string): Response {
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export { XLSX };
