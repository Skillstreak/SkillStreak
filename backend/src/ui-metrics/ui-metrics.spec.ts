import { createRequire } from 'node:module';
import { BadRequestException, ParseArrayPipe } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import request from 'supertest';
import { UiCountItemDto } from './dto/ui-count-item.dto';
import { UiClickCount, UiCounterKey } from './entities/ui-click-count.entity';
import { createUiMetricsBodyLimit } from './ui-metrics-body-limit';
import { UiMetricsRetentionService } from './ui-metrics-retention.service';
import { UiMetricsController } from './ui-metrics.controller';
import { UiMetricsService } from './ui-metrics.service';

// Same options the controller uses, so we test the validator the app runs.
const pipe = new ParseArrayPipe({
  items: UiCountItemDto,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const meta = { type: 'body' as const };
const validate = (body: unknown) => pipe.transform(body, meta);

function makeService() {
  const query = jest.fn().mockResolvedValue([]);
  const service = new UiMetricsService({ query } as never);
  return { service, query };
}

describe('POST /ui-metrics/counts validation', () => {
  it('accepts every allowed key', async () => {
    const all = Object.values(UiCounterKey).map((key) => ({ key, count: 1 }));
    await expect(validate(all)).resolves.toHaveLength(all.length);
  });

  it.each([
    [{ key: 'screen_secret', count: 1 }],
    [{ key: 'screen_home', count: 0 }],
    [{ key: 'screen_home', count: 1001 }],
    [{ key: 'screen_home', count: 1.5 }],
    [{ key: 'screen_home', count: '3' }],
    [{ key: 'screen_home', count: 1, deviceId: 'x' }],
    [{ key: 'screen_home', count: 1, lat: 59.3 }],
  ])('rejects %j', async (item) => {
    await expect(validate([item])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts count boundaries 1 and 1000', async () => {
    await expect(
      validate([
        { key: 'screen_home', count: 1 },
        { key: 'screen_chat', count: 1000 },
      ]),
    ).resolves.toHaveLength(2);
  });

  it('rejects a non-array body', async () => {
    await expect(validate({ key: 'screen_home', count: 1 })).rejects.toThrow();
  });

  it('rejects empty, >20 and duplicate-key batches', async () => {
    const { service, query } = makeService();
    const twentyOne = Object.values(UiCounterKey)
      .concat(Object.values(UiCounterKey))
      .slice(0, 21)
      .map((key) => ({ key, count: 1 }) as UiCountItemDto);
    const dup = [
      { key: UiCounterKey.SCREEN_HOME, count: 1 },
      { key: UiCounterKey.SCREEN_HOME, count: 2 },
    ];
    await expect(service.recordCounts([])).rejects.toThrow(BadRequestException);
    await expect(service.recordCounts(twentyOne)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.recordCounts(dup)).rejects.toThrow(
      BadRequestException,
    );
    expect(query).not.toHaveBeenCalled();

    const controller = new UiMetricsController(service);
    await expect(controller.recordCounts(twentyOne)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('10 kb body limit', () => {
  function app() {
    const express = createRequire(require.resolve('@nestjs/platform-express'))(
      'express',
    ) as typeof import('express');
    const a = express();
    a.post('/c', createUiMetricsBodyLimit(), (req, res) => {
      res.status(204).end();
      void req;
    });
    return a;
  }

  it('accepts a small body and refuses one over 10 kb with 413', async () => {
    await request(app()).post('/c').send([{ key: 'screen_home', count: 1 }]).expect(204);
    const big = [{ key: 'screen_home', count: 1, pad: 'x'.repeat(11 * 1024) }];
    await request(app()).post('/c').send(big).expect(413);
  });
});

describe('UiMetricsService.recordCounts', () => {
  it('sends one upsert that adds count and bumps senders', async () => {
    const { service, query } = makeService();
    await service.recordCounts([
      { key: UiCounterKey.SCREEN_HOME, count: 3 },
      { key: UiCounterKey.BTN_CHAT_SEND, count: 7 },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT ("key", day)');
    expect(sql).toContain('ui_click_count."count" + EXCLUDED."count"');
    expect(sql).toContain('senders = ui_click_count.senders + 1');
    expect(sql).toContain('Europe/Stockholm');
    expect(params).toEqual([['screen_home', 'btn_chat_send'], [3, 7]]);
  });
});

describe('UiMetricsService.collect', () => {
  it('masks count when senders < 10 and shows it from 10', async () => {
    const { service, query } = makeService();
    query.mockResolvedValue([
      { key: 'screen_home', day: '2026-10-20', count: 500, senders: 9 },
      { key: 'screen_chat', day: '2026-10-20', count: 42, senders: 10 },
    ]);
    const rows = await service.collect();
    expect(rows).toEqual([
      { key: 'screen_home', day: '2026-10-20', senders: 9, count: null, suppressed: true },
      { key: 'screen_chat', day: '2026-10-20', senders: 10, count: 42, suppressed: false },
    ]);
    expect(JSON.stringify(rows[0])).not.toContain('500');
  });
});

describe('retention', () => {
  it('deletes rows older than 90 days via the service', async () => {
    const { service, query } = makeService();
    query.mockResolvedValue([[], 4]);
    await expect(service.deleteExpired()).resolves.toBe(4);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/DELETE FROM ui_click_count\s+WHERE day < /);
    expect(params).toEqual([90]);
  });

  function makeRetention(claimed: boolean) {
    const redis = {
      tryClaimScheduledJobRun: jest.fn().mockResolvedValue(claimed),
      recordScheduledJobSuccess: jest.fn().mockResolvedValue(undefined),
      getScheduledJobLastSuccess: jest.fn(),
    };
    const metrics = { deleteExpired: jest.fn().mockResolvedValue(2) };
    const errorLog = { record: jest.fn() };
    const svc = new UiMetricsRetentionService(
      metrics as never,
      redis as never,
      errorLog as never,
    );
    return { svc, redis, metrics, errorLog };
  }

  it('claims the lock with the spec job name and 3600 s TTL, then sweeps', async () => {
    const { svc, redis, metrics } = makeRetention(true);
    await svc.sweepExpired();
    expect(redis.tryClaimScheduledJobRun).toHaveBeenCalledWith(
      'ui_metrics_retention_sweep',
      3600,
    );
    expect(metrics.deleteExpired).toHaveBeenCalled();
    expect(redis.recordScheduledJobSuccess).toHaveBeenCalled();
  });

  it('skips when another replica holds the claim', async () => {
    const { svc, metrics } = makeRetention(false);
    await svc.sweepExpired();
    expect(metrics.deleteExpired).not.toHaveBeenCalled();
  });

  it('logs an alarm when the last success is over 48 h old, not when fresh', async () => {
    const { svc, redis } = makeRetention(true);
    const error = jest
      .spyOn((svc as unknown as { logger: { error: () => void } }).logger, 'error')
      .mockImplementation(() => undefined);
    redis.getScheduledJobLastSuccess.mockResolvedValue(Date.now() - 49 * 3600_000);
    await svc.warnIfSweepStale();
    expect(error).toHaveBeenCalledTimes(1);
    redis.getScheduledJobLastSuccess.mockResolvedValue(Date.now() - 2 * 3600_000);
    await svc.warnIfSweepStale();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe('no personal data stored', () => {
  it('the table has exactly id, key, day, count, senders', () => {
    const cols = getMetadataArgsStorage()
      .columns.filter((c) => c.target === UiClickCount)
      .map((c) => c.propertyName)
      .sort();
    expect(cols).toEqual(['count', 'day', 'id', 'key', 'senders']);
    const relations = getMetadataArgsStorage().relations.filter(
      (r) => r.target === UiClickCount,
    );
    expect(relations).toHaveLength(0);
  });

  it('the controller never passes request data (IP etc.) to the service', async () => {
    const recordCounts = jest.fn().mockResolvedValue(undefined);
    const controller = new UiMetricsController({ recordCounts } as never);
    expect(controller.recordCounts.length).toBe(1); // body only, no @Req/@Ip
    await controller.recordCounts([{ key: UiCounterKey.SCREEN_HOME, count: 1 }]);
    expect(recordCounts).toHaveBeenCalledWith([
      { key: 'screen_home', count: 1 },
    ]);
  });
});
