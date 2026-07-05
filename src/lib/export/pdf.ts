import path from "node:path";
import PDFDocument from "pdfkit";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
export const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
export const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

export const PAGE_MARGIN = 40;

/**
 * Document PDF A4 cu fonturile DejaVu (diacritice românești).
 * Fontul e dat în constructor ca pdfkit să nu încarce Helvetica (AFM),
 * care nu există în bundle-ul Next.
 */
export function createPdf() {
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    font: FONT_REGULAR,
  });
  doc.registerFont("regular", FONT_REGULAR);
  doc.registerFont("bold", FONT_BOLD);
  return doc;
}

/** Colectează stream-ul pdfkit într-un Response descărcabil. */
export function pdfResponse(doc: PDFKit.PDFDocument, filename: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      resolve(
        new Response(new Uint8Array(Buffer.concat(chunks)), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
          },
        }),
      );
    });
    doc.on("error", reject);
    doc.end();
  });
}

export type PdfColumn = {
  header: string;
  /** Lățimea în puncte; suma coloanelor ≤ lățimea utilă a paginii. */
  width: number;
  align?: "left" | "right" | "center";
};

const ROW_PADDING_Y = 4;
const CELL_PADDING_X = 4;
const HEADER_BG = "#f0efec";
const BORDER = "#c9c7c1";
const TEXT = "#1b1a17";
const MUTED = "#6f6b63";

/**
 * Tabel simplu cu antet repetat la schimbarea paginii.
 * Rândurile își calculează înălțimea după celula cea mai înaltă.
 */
export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  rows: string[][],
  options: { boldRows?: Set<number>; fontSize?: number } = {},
) {
  const fontSize = options.fontSize ?? 8.5;
  const startX = doc.page.margins.left;
  const usableBottom = doc.page.height - doc.page.margins.bottom;

  const drawHeader = () => {
    const headerHeight = measureRow(doc, columns, columns.map((c) => c.header), fontSize, "bold");
    doc.rect(startX, doc.y, columns.reduce((s, c) => s + c.width, 0), headerHeight).fill(HEADER_BG);
    drawRowText(doc, columns, columns.map((c) => c.header), doc.y, fontSize, "bold", TEXT);
    doc
      .moveTo(startX, doc.y + headerHeight)
      .lineTo(startX + columns.reduce((s, c) => s + c.width, 0), doc.y + headerHeight)
      .strokeColor(BORDER)
      .lineWidth(0.7)
      .stroke();
    doc.y += headerHeight;
  };

  drawHeader();

  rows.forEach((row, index) => {
    const font = options.boldRows?.has(index) ? "bold" : "regular";
    const rowHeight = measureRow(doc, columns, row, fontSize, font);

    if (doc.y + rowHeight > usableBottom) {
      doc.addPage();
      drawHeader();
    }

    drawRowText(doc, columns, row, doc.y, fontSize, font, TEXT);
    doc
      .moveTo(startX, doc.y + rowHeight)
      .lineTo(startX + columns.reduce((s, c) => s + c.width, 0), doc.y + rowHeight)
      .strokeColor("#e8e7e3")
      .lineWidth(0.5)
      .stroke();
    doc.y += rowHeight;
  });
}

function measureRow(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  row: string[],
  fontSize: number,
  font: string,
) {
  doc.font(font).fontSize(fontSize);
  let max = 0;
  columns.forEach((col, i) => {
    const height = doc.heightOfString(row[i] ?? "", { width: col.width - CELL_PADDING_X * 2 });
    if (height > max) max = height;
  });
  return max + ROW_PADDING_Y * 2;
}

function drawRowText(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  row: string[],
  y: number,
  fontSize: number,
  font: string,
  color: string,
) {
  doc.font(font).fontSize(fontSize).fillColor(color);
  let x = doc.page.margins.left;
  columns.forEach((col, i) => {
    doc.text(row[i] ?? "", x + CELL_PADDING_X, y + ROW_PADDING_Y, {
      width: col.width - CELL_PADDING_X * 2,
      align: col.align ?? "left",
    });
    x += col.width;
  });
}

/** Antetul firmei + titlul documentului. Lasă doc.y sub antet. */
export function drawDocumentHeader(
  doc: PDFKit.PDFDocument,
  company: { legalName: string; idno: string; address: string },
  title: string,
  subtitle?: string,
) {
  doc.font("bold").fontSize(13).fillColor(TEXT).text(company.legalName, { align: "left" });
  doc
    .font("regular")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(`IDNO: ${company.idno} · ${company.address}`);
  doc.moveDown(1.2);
  doc.font("bold").fontSize(12).fillColor(TEXT).text(title, { align: "center" });
  if (subtitle) {
    doc.moveDown(0.2);
    doc.font("regular").fontSize(9).fillColor(MUTED).text(subtitle, { align: "center" });
  }
  doc.moveDown(1);
}

export const pdfMoney = new Intl.NumberFormat("ro-MD", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
