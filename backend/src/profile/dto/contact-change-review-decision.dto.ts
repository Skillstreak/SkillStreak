import { IsIn } from 'class-validator';
import type { ContactChangeReviewDecision } from '../profile.service';

const DECISIONS: readonly ContactChangeReviewDecision[] = ['approve', 'stop'];

// Query string of POST /players/contact-change-review/:token — the review
// page's two buttons post `?decision=approve` / `?decision=stop`. Anything
// else is a 400 at the boundary, before the token is even looked up.
export class ContactChangeReviewDecisionDto {
  @IsIn(DECISIONS)
  decision!: ContactChangeReviewDecision;
}
