import { PlayerLocale } from '../../common/locale/player-locale.enum';
import {
  VILLAGE_SUPPORT_EMAIL,
  buildVillageJoinedEmail,
} from './village-joined-email.template';

describe('buildVillageJoinedEmail', () => {
  it.each(Object.values(PlayerLocale))(
    '%s: names what is shown, what never is, and how to turn it off',
    (locale) => {
      const email = buildVillageJoinedEmail({
        teamName: 'Snabba Falkarna',
        shownName: 'Snabba Falkarna',
        sport: 'FLOORBALL',
        locale,
      });
      expect(email.subject).toContain('Snabba Falkarna');
      expect(email.text).toContain(VILLAGE_SUPPORT_EMAIL);
      expect(email.html).toContain(VILLAGE_SUPPORT_EMAIL);
      expect(email.text.split('\n\n').length).toBeGreaterThanOrEqual(5);
    },
  );

  it('escapes the child-typed team name in HTML', () => {
    const email = buildVillageJoinedEmail({
      teamName: '<img src=x onerror=alert(1)>',
      shownName: 'Klubbhjältarna',
      sport: 'FLOORBALL',
      locale: PlayerLocale.SV,
    });
    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('&lt;img');
  });

  it('shows the masked name and the localised sport', () => {
    const email = buildVillageJoinedEmail({
      teamName: 'IBK Lund P14',
      shownName: 'Klubbhjältarna',
      sport: 'FLOORBALL',
      locale: PlayerLocale.SV,
    });
    expect(email.text).toContain('"Klubbhjältarna"');
    expect(email.text).toContain('(innebandy)');
  });
});
