import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { UiCounterKey } from '../entities/ui-click-count.entity';

/** One element of the `POST /ui-metrics/counts` array body. */
export class UiCountItemDto {
  @IsEnum(UiCounterKey)
  key!: UiCounterKey;

  @IsInt()
  @Min(1)
  @Max(1000)
  count!: number;
}
