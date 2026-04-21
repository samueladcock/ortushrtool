import { createClient } from "@/lib/supabase/server";
import { EMAIL_TEMPLATE_DEFAULTS } from "./template-defaults";

/**
 * Renders a template string by replacing {{variable}} placeholders
 * and handling {{#if variable}}...{{/if}} conditional blocks.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  // Handle {{#if var}}...{{/if}} conditionals
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => (vars[key] ? content : "")
  );
  // Replace {{variable}} placeholders
  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => vars[key] ?? ""
  );
  return result;
}

/**
 * Loads a template from the database (falling back to defaults),
 * renders it with the given variables, and returns subject + html.
 */
export async function loadAndRender(
  type: string,
  vars: Record<string, string>
): Promise<{ subject: string; html: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("type", type)
    .maybeSingle();

  let subject: string;
  let body: string;

  if (data) {
    subject = data.subject;
    body = data.body;
  } else {
    const fallback = EMAIL_TEMPLATE_DEFAULTS.find((t) => t.type === type);
    if (!fallback) {
      throw new Error(`Unknown email template type: ${type}`);
    }
    subject = fallback.subject;
    body = fallback.body;
  }

  return {
    subject: renderTemplate(subject, vars),
    html: renderTemplate(body, vars),
  };
}
