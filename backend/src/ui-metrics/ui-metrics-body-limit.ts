import { createRequire } from 'node:module';
import type { RequestHandler } from 'express';
import { UI_METRICS_BODY_LIMIT } from './ui-metrics.constants';

/**
 * `express.json({ limit: '10kb' })` for the anonymous counts endpoint only.
 *
 * Mounted in main.ts on that one path, *before* Nest's own (100 kb) parser
 * is registered at init: body-parser skips a request whose body is already
 * parsed, so this limit wins here without shrinking it for any other route.
 * An oversized body is refused with 413 before it is buffered in full.
 *
 * `express` is resolved through `@nestjs/platform-express`, which owns it,
 * rather than added as a second direct dependency.
 */
export function createUiMetricsBodyLimit(): RequestHandler {
  const requireFromNest = createRequire(
    require.resolve('@nestjs/platform-express'),
  );
  const express = requireFromNest('express') as typeof import('express');
  return express.json({ limit: UI_METRICS_BODY_LIMIT });
}
