import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/**
 * Accepterar både isTest (rekommenderad, JSON-standard) och is_test
 * (för legacy-kompatibilitet). Använd isTest i ny kod.
 */
export class SetTeamTestFlagDto {
  @IsBoolean()
  @Transform(
    ({ value, obj }: { value: unknown; obj?: Record<string, unknown> }) => {
      if (typeof value === 'boolean') return value;
      if (typeof obj?.is_test === 'boolean') return obj.is_test;
      return value;
    },
  )
  isTest!: boolean;
}
