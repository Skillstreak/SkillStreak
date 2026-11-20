import { IsHexadecimal, IsString, Length } from 'class-validator';

/**
 * Approving a drill. The hash is the version of the file the reviewer's
 * screen showed — the server refuses the decision if the file it holds
 * now is different (ADR-0035's 2026-11-20 amendment).
 */
export class ApproveDrillDto {
  @IsString()
  @IsHexadecimal()
  @Length(64, 64)
  contentSha256!: string;
}

/** Rejecting, or taking back an approval. Same reason bounds as a tip. */
export class RejectDrillDto extends ApproveDrillDto {
  @IsString()
  @Length(3, 300)
  reason!: string;
}
