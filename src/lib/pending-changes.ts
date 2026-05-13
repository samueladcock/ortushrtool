import type { createAdminClient } from "@/lib/supabase/admin";

export type BulkImportPayload = {
  rows: Array<{
    email: string;
    user_id: string;
    user_patch?: Record<string, unknown>;
    custom_field_writes?: Array<{ field_id: string; value: string }>;
    multi_row_writes?: Array<{
      field_id: string;
      row_index: number;
      data: Record<string, string>;
    }>;
  }>;
};

export type FieldValueUpsertPayload = {
  field_id: string;
  employee_id: string;
  value: string;
};

export type MultiRowInsertPayload = {
  field_id: string;
  employee_id: string;
  data: Record<string, string>;
};

export type FieldValueDeletePayload = {
  field_id: string;
  employee_id: string;
};

export type MultiRowUpdatePayload = {
  row_id: string;
  data: Record<string, string>;
};

export type MultiRowDeletePayload = {
  row_id: string;
};

type Admin = ReturnType<typeof createAdminClient>;

export type ApplyResult = {
  ok: boolean;
  error?: string;
  rowsUpdated?: number;
  cellsWritten?: number;
  errors?: string[];
};

export async function applyBulkImport(
  admin: Admin,
  actorId: string,
  payload: BulkImportPayload
): Promise<ApplyResult> {
  const errors: string[] = [];
  let rowsUpdated = 0;
  let cellsWritten = 0;

  for (const r of payload.rows) {
    let wrote = false;

    if (r.user_patch && Object.keys(r.user_patch).length > 0) {
      const { error } = await admin
        .from("users")
        .update(r.user_patch)
        .eq("id", r.user_id);
      if (error) {
        errors.push(`${r.email} (user update): ${error.message}`);
      } else {
        cellsWritten += Object.keys(r.user_patch).length;
        wrote = true;
      }
    }

    for (const w of r.custom_field_writes ?? []) {
      const { error } = await admin.from("profile_field_values").upsert(
        {
          field_id: w.field_id,
          employee_id: r.user_id,
          value: w.value,
          updated_by: actorId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "field_id,employee_id" }
      );
      if (error) {
        errors.push(`${r.email} (custom field): ${error.message}`);
      } else {
        cellsWritten++;
        wrote = true;
      }
    }

    for (const mr of r.multi_row_writes ?? []) {
      const { data: existing } = await admin
        .from("profile_field_value_rows")
        .select("id, data")
        .eq("field_id", mr.field_id)
        .eq("employee_id", r.user_id)
        .eq("row_index", mr.row_index)
        .maybeSingle();
      if (existing) {
        const merged = {
          ...(existing.data as Record<string, string>),
          ...mr.data,
        };
        const { error } = await admin
          .from("profile_field_value_rows")
          .update({
            data: merged,
            updated_by: actorId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) {
          errors.push(`${r.email} (multi-row update): ${error.message}`);
        } else {
          cellsWritten += Object.keys(mr.data).length;
          wrote = true;
        }
      } else {
        const { error } = await admin.from("profile_field_value_rows").insert({
          field_id: mr.field_id,
          employee_id: r.user_id,
          row_index: mr.row_index,
          data: mr.data,
          updated_by: actorId,
        });
        if (error) {
          errors.push(`${r.email} (multi-row insert): ${error.message}`);
        } else {
          cellsWritten += Object.keys(mr.data).length;
          wrote = true;
        }
      }
    }

    if (wrote) rowsUpdated++;
  }

  return { ok: errors.length === 0, rowsUpdated, cellsWritten, errors };
}

export async function applyFieldValueUpsert(
  admin: Admin,
  actorId: string,
  p: FieldValueUpsertPayload
): Promise<ApplyResult> {
  const { error } = await admin.from("profile_field_values").upsert(
    {
      field_id: p.field_id,
      employee_id: p.employee_id,
      value: p.value,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "field_id,employee_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, cellsWritten: 1 };
}

export async function applyMultiRowInsert(
  admin: Admin,
  actorId: string,
  p: MultiRowInsertPayload
): Promise<ApplyResult> {
  const { data: existing } = await admin
    .from("profile_field_value_rows")
    .select("row_index")
    .eq("field_id", p.field_id)
    .eq("employee_id", p.employee_id)
    .order("row_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextIndex = (existing?.row_index ?? -1) + 1;
  const { error } = await admin.from("profile_field_value_rows").insert({
    field_id: p.field_id,
    employee_id: p.employee_id,
    row_index: nextIndex,
    data: p.data,
    updated_by: actorId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, cellsWritten: 1 };
}

export async function applyFieldValueDelete(
  admin: Admin,
  _actorId: string,
  p: FieldValueDeletePayload
): Promise<ApplyResult> {
  void _actorId;
  const { error } = await admin
    .from("profile_field_values")
    .delete()
    .eq("field_id", p.field_id)
    .eq("employee_id", p.employee_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, cellsWritten: 1 };
}

export async function applyMultiRowUpdate(
  admin: Admin,
  actorId: string,
  p: MultiRowUpdatePayload
): Promise<ApplyResult> {
  const { error } = await admin
    .from("profile_field_value_rows")
    .update({
      data: p.data,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", p.row_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, cellsWritten: 1 };
}

export async function applyMultiRowDelete(
  admin: Admin,
  _actorId: string,
  p: MultiRowDeletePayload
): Promise<ApplyResult> {
  void _actorId;
  const { error } = await admin
    .from("profile_field_value_rows")
    .delete()
    .eq("id", p.row_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, cellsWritten: 1 };
}
