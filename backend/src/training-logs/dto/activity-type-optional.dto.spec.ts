// ADR-0038 amendment 2026-11-17: the app no longer asks what kind of
// training it was. Older builds still send `activityType`, so it stays
// accepted, but it is no longer required.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActivityType } from '../activity-type.enum';
import { CreateTrainingLogDto } from './create-training-log.dto';
import { StartTrainingTimerDto } from './start-training-timer.dto';

async function errorsFor<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('activityType is optional', () => {
  it('starts a timer with an empty body', async () => {
    expect(await errorsFor(StartTrainingTimerDto, {})).toEqual([]);
  });

  it('still accepts a timer from an older build that sends a type', async () => {
    expect(
      await errorsFor(StartTrainingTimerDto, {
        activityType: ActivityType.RUNNING,
        plannedMinutes: 30,
      }),
    ).toEqual([]);
  });

  it('still rejects an unknown type', async () => {
    expect(
      await errorsFor(StartTrainingTimerDto, { activityType: 'swimming' }),
    ).toEqual(['activityType']);
  });

  it('logs a session without a type', async () => {
    expect(
      await errorsFor(CreateTrainingLogDto, { durationMinutes: 20 }),
    ).toEqual([]);
  });
});
