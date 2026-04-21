import { requireRole } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { EmailTemplateEditor } from "@/components/admin/email-template-editor";
import type { EmailTemplate } from "@/types/database";

export default async function EmailSettingsPage() {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .order("type");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="text-gray-600">
          Customize the emails sent by the system
        </p>
      </div>
      <EmailTemplateEditor templates={(data ?? []) as EmailTemplate[]} />
    </div>
  );
}
