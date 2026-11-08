// docs/adr/0012's 2026-11-08 amendment — landing pages for the OLD
// address's approve/stop link (only mailed while parental consent is not
// yet approved). Same shape as contact-change-cancel-page.templates.ts:
// inline-styled, no external assets, and the GET page has zero side
// effects — only the POST behind one of its two buttons acts.
//
// Localised by the player's locale, same as the consent pages
// (docs/adr/0014 Decision 3), with the sv fallback. The "invalid link"
// page has no player to take a locale from and reuses the cancel flow's
// Swedish one (renderCancelInvalidPage), whose copy already covers every
// dead-link case here.
//
// en/fi/da/nb/de/cs/fr/es copy is AI-generated — native-speaker review
// recommended, as for the sibling templates.

import { renderTransactionalHtmlPage as page } from '../common/html/transactional-page.util';
import { PlayerLocale } from '../common/locale/player-locale.enum';
import { escapeHtml } from '../mail/templates/html-escape.util';

interface ReviewPageCopy {
  title: string;
  heading: string;
  body: (screenName: string, newContact: string) => string;
  approve: string;
  stop: string;
  stopNote: string;
  approvedHeading: string;
  approvedNow: string;
  approvedHeld: string;
  stoppedHeading: string;
  stoppedBody: string;
}

const COPY: Partial<Record<PlayerLocale, ReviewPageCopy>> = {
  sv: {
    title: 'Byte av kontaktadress',
    heading: 'Godkänn eller stoppa bytet',
    body: (n, c) =>
      `Någon har bett om att byta kontaktadressen för ${n}s konto på SkillStreak till ${c}. Föräldragodkännandet för kontot är inte klart än, så det är du som bestämmer.`,
    approve: 'Godkänn bytet',
    stop: 'Stoppa bytet',
    stopNote: 'Stoppa loggar också ut alla aktiva sessioner på kontot.',
    approvedHeading: 'Godkänt',
    approvedNow: 'Kontaktadressen är bytt. Ingenting mer behöver göras.',
    approvedHeld:
      'Bytet genomförs så snart den nya adressen har bekräftats med koden som skickades dit.',
    stoppedHeading: 'Stoppat',
    stoppedBody:
      'Kontaktadressen är oförändrad, och alla aktiva sessioner på kontot har loggats ut. Ingenting mer behöver göras.',
  },
  en: {
    title: 'Contact-address change',
    heading: 'Approve or stop the change',
    body: (n, c) =>
      `Someone has asked to change the contact address for ${n}'s account on SkillStreak to ${c}. Parental approval for the account isn't complete yet, so the decision is yours.`,
    approve: 'Approve the change',
    stop: 'Stop the change',
    stopNote: 'Stop also logs out every active session on the account.',
    approvedHeading: 'Approved',
    approvedNow: 'The contact address has been changed. Nothing more to do.',
    approvedHeld:
      'The change goes through as soon as the new address has been confirmed with the code sent there.',
    stoppedHeading: 'Stopped',
    stoppedBody:
      'The contact address is unchanged, and every active session on the account has been logged out. Nothing more to do.',
  },
  fi: {
    title: 'Yhteysosoitteen vaihto',
    heading: 'Hyväksy tai pysäytä vaihto',
    body: (n, c) =>
      `Tilin ${n} yhteysosoitetta SkillStreakissa on pyydetty vaihtamaan osoitteeseen ${c}. Huoltajan hyväksyntä on vielä kesken, joten päätös on sinun.`,
    approve: 'Hyväksy vaihto',
    stop: 'Pysäytä vaihto',
    stopNote: 'Pysäytys kirjaa myös ulos kaikki tilin aktiiviset istunnot.',
    approvedHeading: 'Hyväksytty',
    approvedNow: 'Yhteysosoite on vaihdettu. Muuta ei tarvitse tehdä.',
    approvedHeld:
      'Vaihto tehdään heti, kun uusi osoite on vahvistettu sinne lähetetyllä koodilla.',
    stoppedHeading: 'Pysäytetty',
    stoppedBody:
      'Yhteysosoite on ennallaan, ja kaikki tilin aktiiviset istunnot on kirjattu ulos. Muuta ei tarvitse tehdä.',
  },
  da: {
    title: 'Skift af kontaktadresse',
    heading: 'Godkend eller stop skiftet',
    body: (n, c) =>
      `Nogen har bedt om at skifte kontaktadressen for ${n}s konto på SkillStreak til ${c}. Forældregodkendelsen er ikke færdig endnu, så det er dig, der bestemmer.`,
    approve: 'Godkend skiftet',
    stop: 'Stop skiftet',
    stopNote: 'Stop logger også alle aktive sessioner på kontoen ud.',
    approvedHeading: 'Godkendt',
    approvedNow: 'Kontaktadressen er skiftet. Der skal ikke gøres mere.',
    approvedHeld:
      'Skiftet gennemføres, så snart den nye adresse er bekræftet med koden, der blev sendt dertil.',
    stoppedHeading: 'Stoppet',
    stoppedBody:
      'Kontaktadressen er uændret, og alle aktive sessioner på kontoen er logget ud. Der skal ikke gøres mere.',
  },
  nb: {
    title: 'Bytte av kontaktadresse',
    heading: 'Godkjenn eller stopp byttet',
    body: (n, c) =>
      `Noen har bedt om å bytte kontaktadressen for ${n}s konto på SkillStreak til ${c}. Foreldregodkjenningen er ikke ferdig ennå, så det er du som bestemmer.`,
    approve: 'Godkjenn byttet',
    stop: 'Stopp byttet',
    stopNote: 'Stopp logger også ut alle aktive økter på kontoen.',
    approvedHeading: 'Godkjent',
    approvedNow: 'Kontaktadressen er byttet. Du trenger ikke gjøre noe mer.',
    approvedHeld:
      'Byttet gjennomføres så snart den nye adressen er bekreftet med koden som ble sendt dit.',
    stoppedHeading: 'Stoppet',
    stoppedBody:
      'Kontaktadressen er uendret, og alle aktive økter på kontoen er logget ut. Du trenger ikke gjøre noe mer.',
  },
  de: {
    title: 'Wechsel der Kontaktadresse',
    heading: 'Wechsel genehmigen oder stoppen',
    body: (n, c) =>
      `Jemand hat beantragt, die Kontaktadresse für das Konto von ${n} bei SkillStreak in ${c} zu ändern. Die Zustimmung der Eltern ist noch nicht abgeschlossen, daher entscheidest du.`,
    approve: 'Wechsel genehmigen',
    stop: 'Wechsel stoppen',
    stopNote: 'Stoppen meldet auch alle aktiven Sitzungen des Kontos ab.',
    approvedHeading: 'Genehmigt',
    approvedNow: 'Die Kontaktadresse wurde geändert. Mehr ist nicht zu tun.',
    approvedHeld:
      'Der Wechsel erfolgt, sobald die neue Adresse mit dem dorthin gesendeten Code bestätigt wurde.',
    stoppedHeading: 'Gestoppt',
    stoppedBody:
      'Die Kontaktadresse ist unverändert, und alle aktiven Sitzungen des Kontos wurden abgemeldet. Mehr ist nicht zu tun.',
  },
  cs: {
    title: 'Změna kontaktní adresy',
    heading: 'Schvalte nebo zastavte změnu',
    body: (n, c) =>
      `Někdo požádal o změnu kontaktní adresy účtu ${n} v aplikaci SkillStreak na ${c}. Souhlas rodiče ještě není dokončen, takže rozhodujete vy.`,
    approve: 'Schválit změnu',
    stop: 'Zastavit změnu',
    stopNote: 'Zastavení také odhlásí všechny aktivní relace účtu.',
    approvedHeading: 'Schváleno',
    approvedNow: 'Kontaktní adresa byla změněna. Nic dalšího není třeba.',
    approvedHeld:
      'Změna proběhne, jakmile bude nová adresa potvrzena kódem, který na ni byl odeslán.',
    stoppedHeading: 'Zastaveno',
    stoppedBody:
      'Kontaktní adresa zůstává beze změny a všechny aktivní relace účtu byly odhlášeny. Nic dalšího není třeba.',
  },
  fr: {
    title: "Changement d'adresse de contact",
    heading: 'Approuver ou arrêter le changement',
    body: (n, c) =>
      `Quelqu'un a demandé à changer l'adresse de contact du compte de ${n} sur SkillStreak en ${c}. L'autorisation parentale n'est pas encore finalisée : c'est à vous de décider.`,
    approve: 'Approuver le changement',
    stop: 'Arrêter le changement',
    stopNote: 'Arrêter déconnecte aussi toutes les sessions actives du compte.',
    approvedHeading: 'Approuvé',
    approvedNow: "L'adresse de contact a été changée. Rien d'autre à faire.",
    approvedHeld:
      'Le changement sera effectué dès que la nouvelle adresse aura été confirmée avec le code qui y a été envoyé.',
    stoppedHeading: 'Arrêté',
    stoppedBody:
      "L'adresse de contact est inchangée et toutes les sessions actives du compte ont été déconnectées. Rien d'autre à faire.",
  },
  es: {
    title: 'Cambio de dirección de contacto',
    heading: 'Aprueba o detén el cambio',
    body: (n, c) =>
      `Alguien ha pedido cambiar la dirección de contacto de la cuenta de ${n} en SkillStreak a ${c}. La autorización parental aún no está completa, así que decides tú.`,
    approve: 'Aprobar el cambio',
    stop: 'Detener el cambio',
    stopNote: 'Detener también cierra todas las sesiones activas de la cuenta.',
    approvedHeading: 'Aprobado',
    approvedNow:
      'La dirección de contacto se ha cambiado. No hace falta nada más.',
    approvedHeld:
      'El cambio se completará en cuanto la nueva dirección se confirme con el código que se envió allí.',
    stoppedHeading: 'Detenido',
    stoppedBody:
      'La dirección de contacto no ha cambiado y se han cerrado todas las sesiones activas de la cuenta. No hace falta nada más.',
  },
};

function resolve(locale: PlayerLocale): {
  copy: ReviewPageCopy;
  lang: PlayerLocale;
} {
  const copy = COPY[locale];
  return copy
    ? { copy, lang: locale }
    : { copy: COPY.sv!, lang: PlayerLocale.SV };
}

const BUTTON_STYLE =
  'border:none;border-radius:12px;padding:14px 24px;font-size:16px;font-weight:600;cursor:pointer;margin:0 8px 8px 0;';

/** GET, live token: the two buttons each POST back to this same URL with
 * a `decision` query parameter. Relative `action="?decision=…"` keeps the
 * path (token included) whatever host or prefix the page was served
 * under — the same reason the cancel page posts to `action=""`. */
export function renderReviewConfirmPage(
  screenName: string,
  newContact: string,
  locale: PlayerLocale,
): string {
  const { copy, lang } = resolve(locale);
  return page(
    `${escapeHtml(copy.title)} — SkillStreak`,
    `
    <h1 style="margin:0 0 16px;font-size:22px;">${escapeHtml(copy.heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">
      ${copy.body(
        `<strong>${escapeHtml(screenName)}</strong>`,
        `<strong style="word-break:break-all;">${escapeHtml(newContact)}</strong>`,
      )}
    </p>
    <form method="POST" action="?decision=approve" style="display:inline;">
      <button type="submit" style="background-color:#3DAA6B;color:#FFFFFF;${BUTTON_STYLE}">
        ${escapeHtml(copy.approve)}
      </button>
    </form>
    <form method="POST" action="?decision=stop" style="display:inline;">
      <button type="submit" style="background-color:#FF6B35;color:#FFFFFF;${BUTTON_STYLE}">
        ${escapeHtml(copy.stop)}
      </button>
    </form>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6B6B80;">
      ${escapeHtml(copy.stopNote)}
    </p>
    `,
    lang,
  );
}

export function renderReviewApprovedPage(
  appliedNow: boolean,
  locale: PlayerLocale,
): string {
  const { copy, lang } = resolve(locale);
  return page(
    `${escapeHtml(copy.approvedHeading)} — SkillStreak`,
    `
    <h1 style="margin:0 0 16px;font-size:22px;color:#3DAA6B;">${escapeHtml(copy.approvedHeading)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.5;">
      ${escapeHtml(appliedNow ? copy.approvedNow : copy.approvedHeld)}
    </p>
    `,
    lang,
  );
}

export function renderReviewStoppedPage(locale: PlayerLocale): string {
  const { copy, lang } = resolve(locale);
  return page(
    `${escapeHtml(copy.stoppedHeading)} — SkillStreak`,
    `
    <h1 style="margin:0 0 16px;font-size:22px;color:#3DAA6B;">${escapeHtml(copy.stoppedHeading)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.5;">
      ${escapeHtml(copy.stoppedBody)}
    </p>
    `,
    lang,
  );
}
