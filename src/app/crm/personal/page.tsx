import { Suspense } from "react";
import { RoleForm } from "@/app/staff/role-form";
import { RowMenu } from "@/app/components/row-menu";
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
import { StatusBadge, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
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
    <section className="motion-page p-4 lg:px-6 lg:py-5">
      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
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
                  className="motion-table-row border-t border-[#f0f0f2] align-middle hover:bg-[#f4f4f5]"
                >
                  <TableCell className="font-semibold text-[#18181b]">
                    {formatText(user.name)}
                  </TableCell>
                  <TableCell secondary className="text-[#52525b]">
                    <span className="tabular-nums">{formatText(user.username)}</span>
                  </TableCell>
                  <TableCell>{formatRole(user.role)}</TableCell>
                  <TableCell secondary>
                    <StatusBadge tone={user.active ? "green" : "red"}>
                      {user.active ? "Activ" : "Dezactivat"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <TwoFactorBadge status={user.twoFactorStatus} />
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <RoleForm userId={user.id} currentRole={user.role} />
                      <RowMenu label={user.username ?? user.name ?? "utilizator"}>
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
                      </RowMenu>
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#52525b]">
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

function TwoFactorBadge({ status }: { status: StaffRow["twoFactorStatus"] }) {
  if (status === "ACTIVE") return <StatusBadge tone="green">Activ</StatusBadge>;
  if (status === "PENDING") return <StatusBadge tone="amber">În configurare</StatusBadge>;
  if (status === "CODE_ISSUED") return <StatusBadge tone="blue">Cod emis</StatusBadge>;
  return <StatusBadge tone="gray">Neconfigurat</StatusBadge>;
}
