// docs/adr/0012-profile-page-and-contact-email-change.md's 2026-11-08
// amendment — sent to the OLD (current) address at REQUEST time, but only
// for a player whose parental consent is not yet approved. Replaces
// contact-change-notify-old-email.template.ts's informational notice for
// that case: while consent is pending, the current address is the only
// parent in the loop, so it gets a real decision rather than a heads-up —
// one link to a page with "approve" (applies the change now) and "stop"
// (discards it and logs out every session).
//
// Approved accounts are unaffected and still get the notify mail plus the
// cancel-at-confirm mail (contact-change-cancel-email.template.ts).
//
// Shows the requested NEW address. The notify mail deliberately does not,
// but that one asks nothing of the reader; this one asks a parent to
// approve a specific address, which they cannot do without seeing it. It
// is user-supplied (validated as email-or-phone at the boundary, still
// treated as untrusted) and escaped like the screen name.
//
// docs/adr/0014-multi-language-support.md Decision 3 — same `COPY`/
// `resolveCopy` sv-fallback pattern as every other template here. The
// markup is shared across locales (only the strings differ), which keeps
// nine copies of the layout from drifting apart.
//
// en/fi/da/nb/de/cs/fr/es copy is AI-generated, like the sibling
// templates' — recommend the same native-speaker review pass.

import { PlayerLocale } from '../../common/locale/player-locale.enum';
import { escapeHtml } from './html-escape.util';

export interface ContactChangeReviewEmailInput {
  screenName: string;
  newContact: string;
  reviewUrl: string;
  graceHours: number;
  locale: PlayerLocale;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface LocaleCopy {
  subject: (screenName: string) => string;
  greeting: string;
  heading: string;
  intro: (screenName: string, newContact: string) => string;
  why: string;
  cta: string;
  ifNothing: (graceHours: number) => string;
  notYou: string;
  fallback: string;
}

const COPY: Partial<Record<PlayerLocale, LocaleCopy>> = {
  sv: {
    subject: (n) =>
      `Godkänn eller stoppa bytet av kontaktadress för ${n}s konto`,
    greeting: 'Hej!',
    heading: 'Någon vill byta kontaktadress',
    intro: (n, c) =>
      `Det har kommit en begäran om att byta kontaktadressen för ${n}s konto på SkillStreak till: ${c}`,
    why: 'Föräldragodkännandet för kontot är inte klart än, så det är du – som har den nuvarande adressen – som bestämmer.',
    cta: 'Godkänn eller stoppa bytet',
    ifNothing: (h) =>
      `Gör du ingenting träder bytet i kraft ${h} timmar efter att den nya adressen har bekräftats.`,
    notYou:
      'Var det inte du (eller ditt barn) som bad om detta? Välj Stoppa – då loggas också alla aktiva sessioner på kontot ut.',
    fallback: 'Fungerar knappen inte, kopiera denna adress till webbläsaren:',
  },
  en: {
    subject: (n) =>
      `Approve or stop the contact-address change for ${n}'s account`,
    greeting: 'Hi there!',
    heading: 'Someone wants to change the contact address',
    intro: (n, c) =>
      `A request has been made to change the contact address for ${n}'s account on SkillStreak to: ${c}`,
    why: "Parental approval for the account isn't complete yet, so the decision is yours, as the holder of the current address.",
    cta: 'Approve or stop the change',
    ifNothing: (h) =>
      `If you do nothing, the change takes effect ${h} hours after the new address has been confirmed.`,
    notYou:
      "Wasn't this you (or your child)? Choose Stop — that also logs out every active session on the account.",
    fallback:
      "If the button doesn't work, copy this address into your browser:",
  },
  fi: {
    subject: (n) => `Hyväksy tai pysäytä tilin ${n} yhteysosoitteen vaihto`,
    greeting: 'Hei!',
    heading: 'Joku haluaa vaihtaa yhteysosoitteen',
    intro: (n, c) =>
      `Tilin ${n} yhteysosoitetta SkillStreakissa on pyydetty vaihtamaan osoitteeseen: ${c}`,
    why: 'Tilin huoltajan hyväksyntä on vielä kesken, joten päätös on sinun nykyisen osoitteen haltijana.',
    cta: 'Hyväksy tai pysäytä vaihto',
    ifNothing: (h) =>
      `Jos et tee mitään, vaihto astuu voimaan ${h} tuntia sen jälkeen, kun uusi osoite on vahvistettu.`,
    notYou:
      'Etkö sinä (tai lapsesi) pyytänyt tätä? Valitse Pysäytä – samalla kaikki tilin aktiiviset istunnot kirjataan ulos.',
    fallback: 'Jos painike ei toimi, kopioi tämä osoite selaimeen:',
  },
  da: {
    subject: (n) =>
      `Godkend eller stop skiftet af kontaktadresse for ${n}s konto`,
    greeting: 'Hej!',
    heading: 'Nogen vil skifte kontaktadressen',
    intro: (n, c) =>
      `Der er anmodet om at skifte kontaktadressen for ${n}s konto på SkillStreak til: ${c}`,
    why: 'Forældregodkendelsen af kontoen er ikke færdig endnu, så det er dig – som har den nuværende adresse – der bestemmer.',
    cta: 'Godkend eller stop skiftet',
    ifNothing: (h) =>
      `Gør du ingenting, træder skiftet i kraft ${h} timer efter, at den nye adresse er bekræftet.`,
    notYou:
      'Var det ikke dig (eller dit barn), der bad om dette? Vælg Stop – så logges alle aktive sessioner på kontoen også ud.',
    fallback: 'Virker knappen ikke, så kopiér denne adresse ind i browseren:',
  },
  nb: {
    subject: (n) =>
      `Godkjenn eller stopp byttet av kontaktadresse for ${n}s konto`,
    greeting: 'Hei!',
    heading: 'Noen vil bytte kontaktadresse',
    intro: (n, c) =>
      `Det er bedt om å bytte kontaktadressen for ${n}s konto på SkillStreak til: ${c}`,
    why: 'Foreldregodkjenningen for kontoen er ikke ferdig ennå, så det er du – som har den nåværende adressen – som bestemmer.',
    cta: 'Godkjenn eller stopp byttet',
    ifNothing: (h) =>
      `Gjør du ingenting, trer byttet i kraft ${h} timer etter at den nye adressen er bekreftet.`,
    notYou:
      'Var det ikke du (eller barnet ditt) som ba om dette? Velg Stopp – da logges også alle aktive økter på kontoen ut.',
    fallback: 'Fungerer ikke knappen, kopier denne adressen inn i nettleseren:',
  },
  de: {
    subject: (n) =>
      `Wechsel der Kontaktadresse für das Konto von ${n} genehmigen oder stoppen`,
    greeting: 'Hallo!',
    heading: 'Jemand möchte die Kontaktadresse ändern',
    intro: (n, c) =>
      `Es wurde beantragt, die Kontaktadresse für das Konto von ${n} bei SkillStreak zu ändern in: ${c}`,
    why: 'Die Zustimmung der Eltern für das Konto ist noch nicht abgeschlossen, daher entscheidest du als Inhaber der aktuellen Adresse.',
    cta: 'Wechsel genehmigen oder stoppen',
    ifNothing: (h) =>
      `Wenn du nichts tust, wird der Wechsel ${h} Stunden nach der Bestätigung der neuen Adresse wirksam.`,
    notYou:
      'Warst das nicht du (oder dein Kind)? Wähle Stoppen – dadurch werden auch alle aktiven Sitzungen des Kontos abgemeldet.',
    fallback:
      'Falls der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:',
  },
  cs: {
    subject: (n) => `Schvalte nebo zastavte změnu kontaktní adresy účtu ${n}`,
    greeting: 'Dobrý den!',
    heading: 'Někdo chce změnit kontaktní adresu',
    intro: (n, c) =>
      `Byla podána žádost o změnu kontaktní adresy účtu ${n} v aplikaci SkillStreak na: ${c}`,
    why: 'Souhlas rodiče s účtem ještě není dokončen, takže rozhodujete vy jako držitel současné adresy.',
    cta: 'Schválit nebo zastavit změnu',
    ifNothing: (h) =>
      `Pokud nic neuděláte, změna začne platit ${h} hodin po potvrzení nové adresy.`,
    notYou:
      'Nežádali jste o to vy (nebo vaše dítě)? Zvolte Zastavit – tím se také odhlásí všechny aktivní relace účtu.',
    fallback: 'Pokud tlačítko nefunguje, zkopírujte tuto adresu do prohlížeče:',
  },
  fr: {
    subject: (n) =>
      `Approuvez ou arrêtez le changement d'adresse de contact du compte de ${n}`,
    greeting: 'Bonjour !',
    heading: "Quelqu'un veut changer l'adresse de contact",
    intro: (n, c) =>
      `Une demande a été faite pour changer l'adresse de contact du compte de ${n} sur SkillStreak en : ${c}`,
    why: "L'autorisation parentale du compte n'est pas encore finalisée : c'est donc à vous, titulaire de l'adresse actuelle, de décider.",
    cta: 'Approuver ou arrêter le changement',
    ifNothing: (h) =>
      `Si vous ne faites rien, le changement prendra effet ${h} heures après la confirmation de la nouvelle adresse.`,
    notYou:
      "Ce n'était pas vous (ni votre enfant) ? Choisissez Arrêter — cela déconnecte aussi toutes les sessions actives du compte.",
    fallback:
      'Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :',
  },
  es: {
    subject: (n) =>
      `Aprueba o detén el cambio de dirección de contacto de la cuenta de ${n}`,
    greeting: '¡Hola!',
    heading: 'Alguien quiere cambiar la dirección de contacto',
    intro: (n, c) =>
      `Se ha solicitado cambiar la dirección de contacto de la cuenta de ${n} en SkillStreak a: ${c}`,
    why: 'La autorización parental de la cuenta aún no está completa, así que decides tú, como titular de la dirección actual.',
    cta: 'Aprobar o detener el cambio',
    ifNothing: (h) =>
      `Si no haces nada, el cambio entrará en vigor ${h} horas después de que se confirme la nueva dirección.`,
    notYou:
      '¿No fuiste tú (ni tu hijo o hija)? Elige Detener: así también se cierran todas las sesiones activas de la cuenta.',
    fallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
  },
};

function resolveCopy(locale: PlayerLocale): LocaleCopy {
  return COPY[locale] ?? COPY.sv!; // never renders blank/broken
}

export function buildContactChangeReviewEmail(
  input: ContactChangeReviewEmailInput,
): RenderedEmail {
  const { screenName, newContact, reviewUrl, graceHours, locale } = input;
  const copy = resolveCopy(locale);
  const lang = COPY[locale] ? locale : PlayerLocale.SV;

  const subject = copy.subject(screenName);
  const text = [
    copy.greeting,
    '',
    copy.intro(screenName, newContact),
    '',
    copy.why,
    '',
    `${copy.cta}: ${reviewUrl}`,
    '',
    copy.ifNothing(graceHours),
    '',
    copy.notYou,
  ].join('\n');

  // Every interpolated value below is either fixed copy or escaped here —
  // screenName and newContact are free text from a child's device.
  const safeName = escapeHtml(screenName);
  const safeContact = escapeHtml(newContact);
  const safeUrl = escapeHtml(reviewUrl);
  const safeSubject = escapeHtml(subject);

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1B1B3A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAF7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;padding:32px;max-width:480px;">
          <tr>
            <td>
              <h1 style="margin:0 0 16px;font-size:20px;color:#1B1B3A;">${escapeHtml(copy.heading)}</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
                ${copy.intro(`<strong>${safeName}</strong>`, `<strong style="word-break:break-all;">${safeContact}</strong>`)}
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
                ${escapeHtml(copy.why)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:12px;background-color:#FF6B35;">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">
                      ${escapeHtml(copy.cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:14px;line-height:1.5;">
                ${escapeHtml(copy.ifNothing(graceHours))}
              </p>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.5;font-weight:700;">
                ${escapeHtml(copy.notYou)}
              </p>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6B6B80;">
                ${escapeHtml(copy.fallback)}<br />
                <span style="word-break:break-all;">${safeUrl}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
