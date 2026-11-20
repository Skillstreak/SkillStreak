// ADR-0040 — informational mail to every team member's parent contact when
// the captain turns Skillstreak Village ON. No link, no action required: it
// says what other teams now see, what they never see, and how to get it
// turned off. Same `COPY` / sv-fallback pattern as every template here
// (docs/adr/0014 Decision 3). Non-Swedish copy is AI-translated and should
// get the same native-speaker pass the other templates are waiting on.

import { PlayerLocale } from '../../common/locale/player-locale.enum';
import { escapeHtml } from './html-escape.util';

export const VILLAGE_SUPPORT_EMAIL = 'hello@skillstreak.xyz';

export interface VillageJoinedEmailInput {
  /** The team's own name, as the parents know it. */
  teamName: string;
  /** What other teams see: the masked village name. */
  shownName: string;
  /** FLOORBALL / FOOTBALL / ICE_HOCKEY. */
  sport: string;
  locale: PlayerLocale;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface LocaleCopy {
  sports: Record<string, string>;
  subject: (team: string) => string;
  paragraphs: (
    team: string,
    shown: string,
    sport: string,
    support: string,
  ) => string[];
}

const COPY: Partial<Record<PlayerLocale, LocaleCopy>> = {
  sv: {
    sports: {
      FLOORBALL: 'innebandy',
      FOOTBALL: 'fotboll',
      ICE_HOCKEY: 'ishockey',
    },
    subject: (team) => `${team} har gått med i Skillstreak Village`,
    paragraphs: (team, shown, sport, support) => [
      'Hej!',
      `Lagets kapten har slagit på Skillstreak Village för ${team}. Village är en sida i appen där lag som valt att vara med kan se varandras arenor.`,
      `Det här kan andra lag i Village se: lagnamnet, som visas som "${shown}", sporten (${sport}) och en grov nivå för hur mycket lagen i sporten tränar just nu, till exempel "Några lag tränar". Nivån gäller alltid minst tio lag tillsammans, aldrig ert lag för sig.`,
      'Det här ser de aldrig: barnens namn eller skärmnamn, bilder, klipp, chatt, träningspass, poäng eller var någon tränar.',
      `Vill du inte att laget ska vara med? Prata med kaptenen eller tränaren – kaptenen kan stänga av det i appen när som helst. Du kan också mejla oss på ${support}.`,
      'Du får det här mejlet för att du är kontakt för ett barn i laget. Vi skickar det bara när laget går med i Village.',
    ],
  },
  en: {
    sports: {
      FLOORBALL: 'floorball',
      FOOTBALL: 'football',
      ICE_HOCKEY: 'ice hockey',
    },
    subject: (team) => `${team} has joined Skillstreak Village`,
    paragraphs: (team, shown, sport, support) => [
      'Hello,',
      `The team captain has turned on Skillstreak Village for ${team}. Village is a page in the app where teams that have chosen to take part can see each other's arenas.`,
      `What other teams in Village can see: the team name, shown as "${shown}", the sport (${sport}), and a rough level of how much the teams in that sport are training right now, such as "A few teams training". The level always covers at least ten teams together, never your team on its own.`,
      "What they never see: the children's names or screen names, photos, clips, chat, training sessions, points, or where anyone trains.",
      `Don't want the team to take part? Talk to the captain or the coach – the captain can turn it off in the app at any time. You can also email us at ${support}.`,
      'You are receiving this because you are the contact for a child on the team. We only send it when the team joins Village.',
    ],
  },
  fi: {
    sports: {
      FLOORBALL: 'salibandy',
      FOOTBALL: 'jalkapallo',
      ICE_HOCKEY: 'jääkiekko',
    },
    subject: (team) => `${team} on liittynyt Skillstreak Villageen`,
    paragraphs: (team, shown, sport, support) => [
      'Hei!',
      `Joukkueen kapteeni on ottanut Skillstreak Villagen käyttöön joukkueelle ${team}. Village on sovelluksen sivu, jolla mukaan liittyneet joukkueet näkevät toistensa areenat.`,
      `Muut joukkueet näkevät: joukkueen nimen muodossa "${shown}", lajin (${sport}) ja karkean tason sille, kuinka paljon lajin joukkueet treenaavat juuri nyt. Taso koskee aina vähintään kymmentä joukkuetta yhdessä, ei koskaan teidän joukkuettanne erikseen.`,
      'He eivät koskaan näe: lasten nimiä tai nimimerkkejä, kuvia, klippejä, chattia, treenejä, pisteitä tai sitä, missä kukaan treenaa.',
      `Etkö halua joukkueen olevan mukana? Puhu kapteenin tai valmentajan kanssa – kapteeni voi poistaa sen käytöstä sovelluksessa milloin tahansa. Voit myös lähettää meille sähköpostia osoitteeseen ${support}.`,
      'Saat tämän viestin, koska olet joukkueen lapsen yhteyshenkilö. Lähetämme sen vain, kun joukkue liittyy Villageen.',
    ],
  },
  da: {
    sports: {
      FLOORBALL: 'floorball',
      FOOTBALL: 'fodbold',
      ICE_HOCKEY: 'ishockey',
    },
    subject: (team) => `${team} er gået med i Skillstreak Village`,
    paragraphs: (team, shown, sport, support) => [
      'Hej!',
      `Holdets kaptajn har slået Skillstreak Village til for ${team}. Village er en side i appen, hvor hold, der har valgt at være med, kan se hinandens arenaer.`,
      `Det kan andre hold i Village se: holdnavnet, vist som "${shown}", sporten (${sport}) og et groft niveau for, hvor meget holdene i sporten træner lige nu. Niveauet gælder altid mindst ti hold samlet, aldrig jeres hold alene.`,
      'Det ser de aldrig: børnenes navne eller brugernavne, billeder, klip, chat, træningspas, point eller hvor nogen træner.',
      `Vil du ikke have, at holdet er med? Tal med kaptajnen eller træneren – kaptajnen kan slå det fra i appen når som helst. Du kan også skrive til os på ${support}.`,
      'Du får denne mail, fordi du er kontakt for et barn på holdet. Vi sender den kun, når holdet går med i Village.',
    ],
  },
  nb: {
    sports: {
      FLOORBALL: 'innebandy',
      FOOTBALL: 'fotball',
      ICE_HOCKEY: 'ishockey',
    },
    subject: (team) => `${team} har blitt med i Skillstreak Village`,
    paragraphs: (team, shown, sport, support) => [
      'Hei!',
      `Lagets kaptein har slått på Skillstreak Village for ${team}. Village er en side i appen der lag som har valgt å være med, kan se hverandres arenaer.`,
      `Dette kan andre lag i Village se: lagnavnet, vist som «${shown}», idretten (${sport}) og et grovt nivå for hvor mye lagene i idretten trener akkurat nå. Nivået gjelder alltid minst ti lag samlet, aldri laget deres alene.`,
      'Dette ser de aldri: barnas navn eller brukernavn, bilder, klipp, chat, treningsøkter, poeng eller hvor noen trener.',
      `Vil du ikke at laget skal være med? Snakk med kapteinen eller treneren – kapteinen kan slå det av i appen når som helst. Du kan også sende oss e-post på ${support}.`,
      'Du får denne e-posten fordi du er kontakt for et barn på laget. Vi sender den bare når laget blir med i Village.',
    ],
  },
  de: {
    sports: {
      FLOORBALL: 'Floorball',
      FOOTBALL: 'Fußball',
      ICE_HOCKEY: 'Eishockey',
    },
    subject: (team) => `${team} ist Skillstreak Village beigetreten`,
    paragraphs: (team, shown, sport, support) => [
      'Hallo,',
      `der Kapitän des Teams hat Skillstreak Village für ${team} eingeschaltet. Village ist eine Seite in der App, auf der Teams, die mitmachen, gegenseitig ihre Arenen sehen.`,
      `Das sehen andere Teams in Village: den Teamnamen, angezeigt als „${shown}“, die Sportart (${sport}) und eine grobe Stufe dafür, wie viel die Teams dieser Sportart gerade trainieren. Die Stufe umfasst immer mindestens zehn Teams zusammen, nie euer Team allein.`,
      'Das sehen sie nie: Namen oder Spielernamen der Kinder, Fotos, Clips, Chat, Trainingseinheiten, Punkte oder wo jemand trainiert.',
      `Soll das Team nicht mitmachen? Sprich mit dem Kapitän oder dem Trainer – der Kapitän kann es jederzeit in der App ausschalten. Du kannst uns auch unter ${support} schreiben.`,
      'Du erhältst diese E-Mail, weil du Kontaktperson eines Kindes im Team bist. Wir senden sie nur, wenn das Team Village beitritt.',
    ],
  },
  cs: {
    sports: {
      FLOORBALL: 'florbal',
      FOOTBALL: 'fotbal',
      ICE_HOCKEY: 'lední hokej',
    },
    subject: (team) => `${team} se připojil ke Skillstreak Village`,
    paragraphs: (team, shown, sport, support) => [
      'Dobrý den,',
      `kapitán týmu zapnul Skillstreak Village pro tým ${team}. Village je stránka v aplikaci, kde se týmy, které se rozhodly zapojit, navzájem vidí ve svých arénách.`,
      `Ostatní týmy ve Village uvidí: název týmu zobrazený jako „${shown}“, sport (${sport}) a hrubou úroveň toho, kolik týmů v tomto sportu právě trénuje. Úroveň vždy zahrnuje nejméně deset týmů dohromady, nikdy jen váš tým.`,
      'Nikdy neuvidí: jména ani přezdívky dětí, fotky, klipy, chat, tréninky, body ani to, kde kdo trénuje.',
      `Nechcete, aby se tým zapojil? Promluvte si s kapitánem nebo trenérem – kapitán to může v aplikaci kdykoli vypnout. Můžete nám také napsat na ${support}.`,
      'Tento e-mail dostáváte, protože jste kontaktní osobou dítěte v týmu. Posíláme ho jen tehdy, když se tým připojí k Village.',
    ],
  },
  fr: {
    sports: {
      FLOORBALL: 'floorball',
      FOOTBALL: 'football',
      ICE_HOCKEY: 'hockey sur glace',
    },
    subject: (team) => `${team} a rejoint Skillstreak Village`,
    paragraphs: (team, shown, sport, support) => [
      'Bonjour,',
      `Le capitaine de l'équipe a activé Skillstreak Village pour ${team}. Village est une page de l'application où les équipes qui ont choisi d'y participer peuvent voir les arènes des autres.`,
      `Ce que les autres équipes de Village voient : le nom de l'équipe, affiché comme « ${shown} », le sport (${sport}) et un niveau approximatif de l'activité des équipes de ce sport en ce moment. Ce niveau couvre toujours au moins dix équipes ensemble, jamais votre équipe seule.`,
      "Ce qu'elles ne voient jamais : les noms ou pseudos des enfants, les photos, les clips, le chat, les séances, les points ni le lieu d'entraînement.",
      `Vous ne souhaitez pas que l'équipe participe ? Parlez-en au capitaine ou à l'entraîneur – le capitaine peut le désactiver à tout moment dans l'application. Vous pouvez aussi nous écrire à ${support}.`,
      "Vous recevez ce message parce que vous êtes le contact d'un enfant de l'équipe. Nous ne l'envoyons que lorsque l'équipe rejoint Village.",
    ],
  },
  es: {
    sports: {
      FLOORBALL: 'floorball',
      FOOTBALL: 'fútbol',
      ICE_HOCKEY: 'hockey sobre hielo',
    },
    subject: (team) => `${team} se ha unido a Skillstreak Village`,
    paragraphs: (team, shown, sport, support) => [
      'Hola:',
      `El capitán del equipo ha activado Skillstreak Village para ${team}. Village es una página de la app donde los equipos que han decidido participar pueden ver las arenas de los demás.`,
      `Lo que ven los demás equipos de Village: el nombre del equipo, mostrado como «${shown}», el deporte (${sport}) y un nivel aproximado de cuánto entrenan ahora los equipos de ese deporte. El nivel siempre agrupa al menos diez equipos, nunca a su equipo por separado.`,
      'Lo que nunca ven: nombres o apodos de los niños, fotos, clips, chat, sesiones de entrenamiento, puntos ni dónde entrena nadie.',
      `¿No quiere que el equipo participe? Hable con el capitán o el entrenador: el capitán puede desactivarlo en la app en cualquier momento. También puede escribirnos a ${support}.`,
      'Recibe este correo porque es el contacto de un niño del equipo. Solo lo enviamos cuando el equipo se une a Village.',
    ],
  },
};

function resolveCopy(locale: PlayerLocale): LocaleCopy {
  return COPY[locale] ?? COPY.sv!;
}

export function buildVillageJoinedEmail(
  input: VillageJoinedEmailInput,
): RenderedEmail {
  const copy = resolveCopy(input.locale);
  const sport = copy.sports[input.sport] ?? input.sport.toLowerCase();
  const subject = copy.subject(input.teamName);
  const paragraphs = copy.paragraphs(
    input.teamName,
    input.shownName,
    sport,
    VILLAGE_SUPPORT_EMAIL,
  );
  const text = paragraphs.join('\n\n');
  // Escaped as a whole: the team name is child-typed text.
  const htmlParagraphs = copy
    .paragraphs(
      escapeHtml(input.teamName),
      escapeHtml(input.shownName),
      escapeHtml(sport),
      VILLAGE_SUPPORT_EMAIL,
    )
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${p}</p>`,
    )
    .join('\n');
  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1B1B3A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAF7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;padding:32px;max-width:480px;">
          <tr>
            <td>
${htmlParagraphs}
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
