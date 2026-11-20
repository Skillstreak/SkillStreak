import { IsBoolean } from 'class-validator';

export class SetVillageOptInDto {
  @IsBoolean()
  optedIn!: boolean;
}
