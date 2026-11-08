// Shared by every mail template and mailed-link landing page that
// interpolates user/child-authored values into HTML (screen names, team
// names, chat message content, etc.) — extracted out of
// consent-request-email.template.ts (which used to keep its own private
// copy) so a second template doesn't reintroduce a second,
// possibly-drifting copy of the same escaping logic. The
// `*-page.templates.ts` files under `account-erasure/`, `consent/`, and
// `profile/` re-import this same function rather than keeping their own
// copies, for the same reason.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A plain-text mail body as an equivalent, escaped HTML part — for mail
 * that is written as text and has no HTML template of its own. Escapes
 * first, then turns line breaks into `<br>`, so nothing in the text (a
 * child-chosen screen name, say) can become markup. Deliberately does not
 * linkify: a URL inside user-authored text must not become a clickable
 * link in a parent's inbox.
 */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>\n');
}
