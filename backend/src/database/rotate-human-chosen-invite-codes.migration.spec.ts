import { QueryRunner } from 'typeorm';
import { RotateHumanChosenInviteCodes1789900000000 } from './migrations/1789900000000-RotateHumanChosenInviteCodes';

const GENERATED_CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

// ADR-0009's 2026-11-08 amendment: every pre-existing code was chosen by a
// person, so every one is replaced — including one that happens to look
// like generator output (FALKEN24 is eight characters from its alphabet).
describe('RotateHumanChosenInviteCodes1789900000000', () => {
  it('replaces every existing code with a distinct generated one', async () => {
    const rows = [
      { id: 't1', invite_code: 'IBK2014' },
      { id: 't2', invite_code: 'FALKEN24' },
      { id: 't3', invite_code: 'abc' },
    ];
    const updates: Array<[string, string]> = [];
    const queryRunner = {
      query: jest.fn((sql: string, params?: string[]) => {
        if (sql.startsWith('SELECT')) return Promise.resolve(rows);
        if (params) updates.push([params[1], params[0]]);
        return Promise.resolve();
      }),
    } as unknown as QueryRunner;

    await new RotateHumanChosenInviteCodes1789900000000().up(queryRunner);

    expect(updates.map(([id]) => id)).toEqual(['t1', 't2', 't3']);
    const codes = updates.map(([, code]) => code);
    for (const code of codes) {
      expect(code).toMatch(GENERATED_CODE);
      expect(rows.map((row) => row.invite_code)).not.toContain(code);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('is a no-op on an empty table', async () => {
    const query = jest.fn(() => Promise.resolve([]));
    const queryRunner = { query } as unknown as QueryRunner;

    await new RotateHumanChosenInviteCodes1789900000000().up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
  });
});
