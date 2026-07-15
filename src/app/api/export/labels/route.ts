import { NextRequest } from "next/server";
import PDFDocument from "pdfkit";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import { FONT_REGULAR, FONT_BOLD, pdfResponse } from "@/lib/export/pdf";
import {
  LABEL_PHONE,
  buildCompatibilityLabel,
  buildPartLabel,
  upperLabelText,
} from "@/lib/labels/format";
import { LABEL_SIZES, type LabelSizeKey } from "@/lib/labels/layout";

export const dynamic = "force-dynamic";

const MM = 2.83465; // mm → pt
const PX = 0.75; // CSS px → pt (96dpi → 72dpi), ca fonturile să fie ca pe pagina de print

const clampCount = (n: number) => Math.min(Math.max(Math.round(n) || 1, 1), 50);

function parseItems(items: string | null, ids: string | null, copies: string | null) {
  const map = new Map<string, number>();
  if (items) {
    for (const part of items.split(",")) {
      const [id, n] = part.split(":");
      if (id?.trim()) map.set(id.trim(), clampCount(Number(n)));
    }
    return map;
  }
  const per = clampCount(Number(copies));
  for (const id of (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    map.set(id, per);
  }
  return map;
}

export async function GET(request: NextRequest) {
  await requireCurrentAppUser();

  const sp = request.nextUrl.searchParams;
  const counts = parseItems(sp.get("items"), sp.get("ids"), sp.get("copies"));
  const sizeKey: LabelSizeKey =
    sp.get("size") === "s" || sp.get("size") === "m" ? (sp.get("size") as LabelSizeKey) : "l";
  const layout = sp.get("layout") === "roll" ? "roll" : "grid";
  const dim = LABEL_SIZES[sizeKey];
  const perSheet = dim.cols * dim.rows;
  const skip =
    layout === "grid" ? Math.min(Math.max(Number(sp.get("skip")) || 0, 0), perSheet - 1) : 0;

  const fetched = counts.size
    ? await prisma.product.findMany({
        where: { id: { in: [...counts.keys()] } },
        include: {
          type: true,
          fitment: { include: { carModel: { include: { brand: true } } } },
        },
      })
    : [];
  const products = [...counts.keys()]
    .map((id) => fetched.find((p) => p.id === id))
    .filter((p): p is (typeof fetched)[number] => Boolean(p));

  type Label = (typeof products)[number];
  const labels: Label[] = products.flatMap((p) =>
    Array.from({ length: counts.get(p.id) ?? 1 }, () => p),
  );

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
  const padX = 2.5 * MM;
  const padTopY = 3.5 * MM;
  const padBottomY = 6 * MM;

  const drawLabel = (product: Label, boxX: number, boxY: number) => {
    const cx = boxX + padX;
    const cw = boxW - padX * 2;
    let y = boxY + padTopY;

    const code = dim.code * PX;
    const modelSize = dim.model * PX;
    const desc = dim.desc * PX;
    const phone = dim.phone * PX;

    const model = product.fitment.carModel;
    const codeText = upperLabelText(product.externalCode ?? "-");
    const compatibility = buildCompatibilityLabel({
      brandName: model.brand.name,
      modelName: model.name,
      yearStart: product.fitment.yearStart,
      yearEnd: product.fitment.yearEnd,
      yearOpenEnded: product.fitment.yearOpenEnded,
    });
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
    doc.text(compatibility, cx, y, { width: cw, lineBreak: false, ellipsis: true });
    y += modelSize * 1.15 + 4;

    doc.font("bold").fontSize(desc).fillColor("#111");
    doc.text(part, cx, y, {
      width: cw,
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
    for (const product of labels) {
      doc.addPage({ size: [boxW, boxH], margin: 0 });
      drawLabel(product, 0, 0);
    }
    if (labels.length === 0) doc.addPage({ size: [boxW, boxH], margin: 0 });
  } else {
    const slots: (Label | null)[] = [...Array.from({ length: skip }, () => null), ...labels];
    if (slots.length === 0) slots.push(null);
    const x0 = dim.mx * MM;
    const y0 = dim.my * MM;
    const rowStep = boxH + dim.gy * MM;
    for (let i = 0; i < slots.length; i += perSheet) {
      doc.addPage({ size: "A4", margin: 0 });
      const sheet = slots.slice(i, i + perSheet);
      sheet.forEach((product, j) => {
        if (!product) return;
        const col = j % dim.cols;
        const row = Math.floor(j / dim.cols);
        drawLabel(product, x0 + col * boxW, y0 + row * rowStep);
      });
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return pdfResponse(doc, `stickere-${stamp}.pdf`);
}
