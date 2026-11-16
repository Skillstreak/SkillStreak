import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const DEFAULT_ADMIN_TEAMS_PAGE_SIZE = 50;
export const MAX_ADMIN_TEAMS_PAGE_SIZE = 100;

export class ListAdminTeamsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMIN_TEAMS_PAGE_SIZE)
  limit?: number = DEFAULT_ADMIN_TEAMS_PAGE_SIZE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isTest?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
