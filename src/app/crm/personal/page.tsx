import { Suspense } from "react";
import { RoleForm } from "@/app/staff/role-form";
import {
  CreateStaffDialog,
  IssueTwoFactorActivationDialog,
  ResetPasswordDialog,
  ResetTwoFactorDialog,
  StaffActiveButton,
} from "@/app/staff/staff-dialogs";
import { getStaffData, type StaffRow } from "@/lib/staff/queries";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { formatText } from "../_components/format";
import type { AppRole } from "@/generated/prisma/enums";

type StaffData = Awaited<ReturnType<typeof getStaffData>>;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function StaffPage() {
  const appUser = await requireCrmSection("personal");
  const dataPromise = getStaffData();

  return (
    <>
      <CrmHeader section="personal" role={appUser.role}>
        <CreateStaffDialog />
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton rows={6} />}>
        <Loader dataPromise={dataPromise} currentUserId={appUser.id} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  currentUserId,
}: {
  dataPromise: Promise<StaffData>;
  currentUserId: string;
}) {
  const data = await dataPromise;
  return <StaffWorkspace users={data.users} currentUserId={currentUserId} />;
}

function StaffWorkspace({
  users,
  currentUserId,
}: {
  users: StaffRow[];
  currentUserId: string;
}) {
  return (
    <section className="motion-page p-4 lg:p-5">
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Nume</TableHead>
                <TableHead secondary>Utilizator</TableHead>
                <TableHead>Rol curent</TableHead>
                <TableHead secondary>Stare</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead align="right">Acțiuni</TableHead>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="motion-table-row border-t border-[#efeeeb] align-middle hover:bg-[#f6f6f4]"
                >
                  <TableCell className="font-semibold text-[#1b1a17]">
                    {formatText(user.name)}
                  </TableCell>
                  <TableCell secondary className="text-[#6f6b63]">
                    <span className="tabular-nums">{formatText(user.username)}</span>
                  </TableCell>
                  <TableCell>{formatRole(user.role)}</TableCell>
                  <TableCell secondary>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.active
                          ? "bg-[#f0fdf4] text-[#166534]"
                          : "bg-[#fef2f2] text-[#b91c1c]"
                      }`}
                    >
                      {user.active ? "Activ" : "Dezactivat"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.twoFactorStatus === "ACTIVE"
                          ? "bg-[#f0fdf4] text-[#166534]"
                          : user.twoFactorStatus === "PENDING"
                            ? "bg-[#fff7ed] text-[#9a3412]"
                            : user.twoFactorStatus === "CODE_ISSUED"
                              ? "bg-[#eff6ff] text-[#1d4ed8]"
                            : "bg-[#f5f5f4] text-[#57534e]"
                      }`}
                    >
                      {user.twoFactorStatus === "ACTIVE"
                        ? "Activ"
                        : user.twoFactorStatus === "PENDING"
                          ? "În configurare"
                          : user.twoFactorStatus === "CODE_ISSUED"
                            ? "Cod emis"
                          : "Neconfigurat"}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <RoleForm userId={user.id} currentRole={user.role} />
                      <ResetPasswordDialog
                        userId={user.id}
                        username={user.username ?? user.name ?? user.id}
                      />
                      {user.id !== currentUserId &&
                      user.twoFactorStatus === "ACTIVE" &&
                      user.username ? (
                        <ResetTwoFactorDialog userId={user.id} username={user.username} />
                      ) : null}
                      {user.id !== currentUserId &&
                      user.active &&
                      user.twoFactorStatus !== "ACTIVE" &&
                      user.username ? (
                        <IssueTwoFactorActivationDialog
                          userId={user.id}
                          username={user.username}
                        />
                      ) : null}
                      {user.id !== currentUserId ? (
                        <StaffActiveButton
                          userId={user.id}
                          active={user.active}
                          label={user.username ?? user.name ?? user.id}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">
            Niciun utilizator încă.
          </div>
        ) : null}
      </div>
    </section>
  );
}


function formatRole(role: AppRole) {
  if (role === "ADMIN") return "Administrator";
  if (role === "DIRECTOR") return "Director";
  return "Angajat";
}

