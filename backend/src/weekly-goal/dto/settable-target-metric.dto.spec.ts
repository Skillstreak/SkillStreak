// ADR-0015 amendment 2026-11-17: with no activity type recorded on a log,
// a weekly goal can only be set on totals.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WeeklyGoalTargetMetric } from '../weekly-goal-target-metric.enum';
import { CreateWeeklyGoalDto } from './create-weekly-goal.dto';
import { UpdateWeeklyGoalDto } from './update-weekly-goal.dto';

const base = {
  title: 'Veckans mål',
  description: 'Träna tillsammans',
  targetValue: 60,
  startDate: '2026-11-16',
  endDate: '2026-11-22',
  status: 'draft',
};

async function createErrors(targetMetric: string): Promise<string[]> {
  const errors = await validate(
    plainToInstance(CreateWeeklyGoalDto, { ...base, targetMetric }),
  );
  return errors.map((e) => e.property);
}

describe('settable weekly-goal metrics', () => {
  it.each([
    WeeklyGoalTargetMetric.TOTAL_MINUTER,
    WeeklyGoalTargetMetric.TOTAL_PASS,
  ])('accepts %s', async (metric) => {
    expect(await createErrors(metric)).toEqual([]);
  });

  it.each([
    WeeklyGoalTargetMetric.RUNNING_MINUTER,
    WeeklyGoalTargetMetric.DRILL_PASS,
  ])('rejects the per-activity metric %s on create', async (metric) => {
    expect(await createErrors(metric)).toEqual(['targetMetric']);
  });

  it('rejects a per-activity metric on update too', async () => {
    const errors = await validate(
      plainToInstance(UpdateWeeklyGoalDto, {
        targetMetric: WeeklyGoalTargetMetric.FITNESS_MINUTER,
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(['targetMetric']);
  });
});
