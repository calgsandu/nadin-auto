export type TwoFactorResetClient = {
  twoFactorCredential: {
    deleteMany(args: { where: { appUserId: string } }): Promise<unknown>;
  };
  twoFactorSessionProof: {
    deleteMany(args: { where: { appUserId: string } }): Promise<unknown>;
  };
  trustedDevice: {
    deleteMany(args: { where: { appUserId: string } }): Promise<unknown>;
  };
  appUser: {
    update(args: {
      where: { id: string };
      data: { twoFactorResetAt: Date };
    }): Promise<unknown>;
  };
};

export async function clearTrustedDevices(
  tx: TwoFactorResetClient,
  appUserId: string,
) {
  await tx.trustedDevice.deleteMany({ where: { appUserId } });
}

export async function clearSecondFactorSessions(
  tx: TwoFactorResetClient,
  appUserId: string,
) {
  await tx.twoFactorSessionProof.deleteMany({ where: { appUserId } });
}

export async function resetTwoFactorCredential(
  tx: TwoFactorResetClient,
  appUserId: string,
  resetAt: Date,
) {
  await clearSecondFactorSessions(tx, appUserId);
  await clearTrustedDevices(tx, appUserId);
  await tx.twoFactorCredential.deleteMany({ where: { appUserId } });
  await tx.appUser.update({
    where: { id: appUserId },
    data: { twoFactorResetAt: resetAt },
  });
}
