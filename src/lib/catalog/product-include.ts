/**
 * Include-ul folosit oriunde se afișează eticheta unui produs (linii de
 * document, căutare): tip + fitment principal + TOATE compatibilitățile.
 */
export const productLabelInclude = {
  type: true,
  fitment: { include: { carModel: { include: { brand: true } } } },
  productFitments: {
    include: { fitment: { include: { carModel: { include: { brand: true } } } } },
  },
} as const;
