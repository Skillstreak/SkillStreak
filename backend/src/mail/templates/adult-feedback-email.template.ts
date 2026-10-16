import { escapeHtml } from './html-escape.util';
import type { RenderedEmail } from './contact-enquiry-email.template';

/**
 * Adult feedback, addressed to the project owner (so not localised, like
 * the contact enquiry). Deliberately carries **only** the kind and the
 * text: no screen name, no player id, no team, no age, no reply address.
 * The text is user-typed, so it is escaped in the HTML part.
 */
export function renderAdultFeedbackEmail(input: {
  kind: string;
  text: string;
}): RenderedEmail {
  const subject = `SkillStreak feedback (${input.kind})`;
  const text = [
    `Type: ${input.kind}`,
    '',
    input.text,
    '',
    '--',
    'Sent from the app by an 18+ account. The sender is anonymous.',
  ].join('\n');
  const html = [
    `<p><strong>SkillStreak feedback</strong> — ${escapeHtml(input.kind)}</p>`,
    `<p style="white-space:pre-wrap">${escapeHtml(input.text)}</p>`,
    '<hr>',
    '<p style="color:#666;font-size:13px">Sent from the app by an 18+ ',
    'account. The sender is anonymous.</p>',
  ].join('');
  return { subject, html, text };
}
