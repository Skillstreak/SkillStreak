import { isNameBuilderName, villageTeamName } from './village-team-name.util';

describe('isNameBuilderName', () => {
  it.each([
    'Snabba Falkarna',
    'modiga drakarna',
    'Blixtarna',
    '  Gröna  Örnarna ',
  ])('accepts %p', (name) => {
    expect(isNameBuilderName(name)).toBe(true);
  });

  it('accepts a decomposed (NFD) spelling of an approved word', () => {
    expect(isNameBuilderName('Gröna Örnarna'.normalize('NFD'))).toBe(true);
  });

  it.each([
    'Ackers P15',
    'Täby F13',
    'Snabba Falkarna Lund',
    'Snabba Svensson',
    'Falkarna Snabba',
    '',
  ])('rejects %p', (name) => {
    expect(isNameBuilderName(name)).toBe(false);
  });
});

describe('villageTeamName', () => {
  it('rebuilds a name-builder name from the vocabulary (casing, whitespace)', () => {
    expect(
      villageTeamName({ name: 'SNABBA \u00a0  falkarna', sport: 'FLOORBALL' }),
    ).toBe('Snabba Falkarna');
  });

  it('shows a name-builder name as typed (trimmed)', () => {
    expect(
      villageTeamName({ name: ' Snabba Falkarna ', sport: 'FLOORBALL' }),
    ).toBe('Snabba Falkarna');
  });

  it.each([
    ['FLOORBALL', 'Klubbhjältarna'],
    ['FOOTBALL', 'Bollkonstnärerna'],
    ['ICE_HOCKEY', 'Puckhjältarna'],
    ['CURLING', 'Arenakompisarna'],
  ])('masks free text in %s as %s', (sport, masked) => {
    expect(villageTeamName({ name: 'IBK Lund P2014', sport })).toBe(masked);
  });
});
