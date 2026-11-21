// Topic/content failures can be abandoned. They are distinct from unsafe files,
// bad credentials, broken rendering, and provider-wide quota/outage conditions.
export class UnworkableTopicError extends Error {
  readonly code='UNWORKABLE_TOPIC';
}
export class StageValidationError extends UnworkableTopicError {}
