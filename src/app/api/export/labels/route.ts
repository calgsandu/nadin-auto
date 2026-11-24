import { NextRequest } from "next/server";
import PDFDocument from "pdfkit";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { FONT_REGULAR, FONT_BOLD, pdfResponse } from "@/lib/export/pdf";
import { LABEL_PHONE, buildPartLabel, buildProductCodeLabel } from "@/lib/labels/format";
import { buildLabelSlots, loadLabelProducts, parseLabelRequest, type LabelSlot } from "@/lib/labels/request";

export const dynamic = "force-dynamic";

const MM = 2.83465; // mm → pt
const PX = 0.75; // CSS px → pt (96dpi → 72dpi), ca fonturile să fie ca pe pagina de print

export async function GET(request: NextRequest) {
  await requireCurrentAppUser();

  const labelRequest = parseLabelRequest((key) => request.nextUrl.searchParams.get(key));
  const { layout, dim } = labelRequest;
  const products = await loadLabelProducts([...labelRequest.counts.keys()]);
  const { labels, sheets } = buildLabelSlots(labelRequest, products);

  const doc = new PDFDocument({
    size: layout === "roll" ? [dim.w * MM, dim.h * MM] : "A4",
    margin: 0,
    font: FONT_REGULAR,
    autoFirstPage: false,
  });
  doc.registerFont("regular", FONT_REGULAR);
  doc.registerFont("bold", FONT_BOLD);

  const boxW = dim.w * MM;
  const boxH = dim.h * MM;
  const padX = dim.padX * MM;
  const padTopY = 3.5 * MM;
  const padBottomY = 6 * MM;

  const drawLabel = ({ product, compatibility, includeAlternativeCode }: LabelSlot, boxX: number, boxY: number) => {
    const cx = boxX + padX;
    const cw = boxW - padX * 2;
    const detailX = cx + dim.detailOffsetX * MM;
    const detailWidth = cw - dim.detailOffsetX * MM;
    let y = boxY + padTopY;

    const code = dim.code * PX;
    const modelSize =
      dim.model *
      (compatibility.length > 55
        ? 0.72
        : compatibility.length > 35
          ? 0.84
          : 1) *
      PX;
    const desc = dim.desc * PX;
    const phone = dim.phone * PX;

    const codeText = buildProductCodeLabel(
      product.externalCode,
      includeAlternativeCode ? product.alternativeCode : null,
    );
    const part = buildPartLabel(product.type.name, product.description);

    doc.font("bold").fontSize(code).fillColor("#111");
    doc.text(codeText, cx, y, {
      width: cw,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
    y += code * 1.05 + 11;

    doc.font("bold").fontSize(modelSize).fillColor("#111");
    const modelMaxHeight = modelSize * 4.2;
    const modelHeight = Math.min(
      doc.heightOfString(compatibility, { width: detailWidth }),
      modelMaxHeight,
    );
    doc.text(compatibility, detailX, y, {
      width: detailWidth,
      height: modelMaxHeight,
      lineBreak: true,
    });
    y += modelHeight + 4;

    doc.font("bold").fontSize(desc).fillColor("#111");
    doc.text(part, detailX, y, {
      width: detailWidth,
      height: desc * 1.25 * 2 + 1,
      ellipsis: true,
    });

    doc.font("bold").fontSize(phone).fillColor("#111");
    doc.text(LABEL_PHONE, cx, boxY + boxH - padBottomY - phone * 1.15, {
      width: cw,
      align: "center",
      height: phone * 1.2,
      ellipsis: true,
      lineBreak: false,
    });
  };

  if (layout === "roll") {
    for (const slot of labels) {
      doc.addPage({ size: [boxW, boxH], margin: 0 });
      drawLabel(slot, 0, 0);
    }
    if (labels.length === 0) doc.addPage({ size: [boxW, boxH], margin: 0 });
  } else {
    const x0 = dim.mx * MM;
    const y0 = dim.my * MM;
    const rowStep = boxH + dim.gy * MM;
    for (const sheet of sheets.length > 0 ? sheets : [[]]) {
      doc.addPage({ size: "A4", margin: 0 });
      sheet.forEach((slot, j) => {
        if (!slot) return;
        const col = j % dim.cols;
        const row = Math.floor(j / dim.cols);
        drawLabel(slot, x0 + col * boxW, y0 + row * rowStep);
      });
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return pdfResponse(doc, `stickere-${stamp}.pdf`);
}
