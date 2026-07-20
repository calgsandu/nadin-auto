"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import {
  approvePendingOperation,
  rejectPendingOperation,
} from "@/lib/pending-operations/execute";

export type ApprovalActionState = { ok: boolean; message: string };

function toState(error: unknown): ApprovalActionState {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "A apărut o eroare.",
  };
}

export async function approvePendingOperationAction(
  _state: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  try {
    const reviewer = await requireCurrentAppUser();
    const operationId = readOperationId(formData);
    const result = await approvePendingOperation(operationId, reviewer);
    revalidatePath("/crm");
    return { ok: true, message: result.resultMessage };
  } catch (error) {
    revalidatePath("/crm");
    return toState(error);
  }
}

export async function rejectPendingOperationAction(
  _state: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  try {
    const reviewer = await requireCurrentAppUser();
    const operationId = readOperationId(formData);
    const reason = String(formData.get("reason") ?? "");
    await rejectPendingOperation(operationId, reviewer, reason);
    revalidatePath("/crm");
    return { ok: true, message: "Cererea a fost respinsă." };
  } catch (error) {
    revalidatePath("/crm");
    return toState(error);
  }
}

function readOperationId(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "").trim();
  if (!operationId) throw new Error("Cererea de aprobare lipsește.");
  return operationId;
}
