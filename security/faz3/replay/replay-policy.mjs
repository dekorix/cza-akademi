export const REPLAY_POLICY = Object.freeze({
  staging: Object.freeze({ acceptedPastSeconds: 60, futureClockSkewSeconds: 5, cleanupSafetyMarginSeconds: 15, nonceRetentionSeconds: 80 }),
  production: Object.freeze({ acceptedPastSeconds: 60, futureClockSkewSeconds: 5, cleanupSafetyMarginSeconds: 15, nonceRetentionSeconds: 80 }),
});

export function validateReplayPolicy(policy) {
  const minimum = policy.acceptedPastSeconds + policy.futureClockSkewSeconds + policy.cleanupSafetyMarginSeconds;
  if (policy.nonceRetentionSeconds < minimum) throw new Error('NONCE_RETENTION_INVARIANT');
  return true;
}

export function checkTimestamp(nowSeconds, signedSeconds, policy) {
  if (!Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(signedSeconds)) return 'SIGNATURE_TIME_INVALID';
  if (signedSeconds > nowSeconds + policy.futureClockSkewSeconds) return 'SIGNATURE_TIME_INVALID';
  if (signedSeconds < nowSeconds - policy.acceptedPastSeconds) return 'SIGNATURE_TIME_INVALID';
  return 'ACCEPTABLE';
}
