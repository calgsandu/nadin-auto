// Foi autoadezive A4. mx/my = marginile foii până la prima etichetă.
export const LABEL_SIZES = {
  s: {
    w: 52,
    h: 30,
    cols: 3,
    rows: 9,
    mx: 27,
    my: 13.5,
    code: 15,
    model: 12,
    desc: 7.5,
    phone: 8,
  },
  m: {
    w: 70,
    h: 42.4,
    cols: 3,
    rows: 7,
    mx: 0,
    my: 0,
    code: 22,
    model: 17,
    desc: 10.5,
    phone: 12,
  },
  l: {
    w: 70,
    h: 52,
    cols: 3,
    rows: 5,
    mx: 0,
    my: 20,
    code: 26,
    model: 20,
    desc: 12,
    phone: 14,
  },
} as const;

export type LabelSizeKey = keyof typeof LABEL_SIZES;
