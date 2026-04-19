export const SCAN_LIMITS = {
  MAX_SCANS_PER_DAY_FREE: 10,
  MAX_API_KEYS_PER_USER: 3,
  MAX_SUBDOMAINS_TO_SCAN: 10,       // Series phase subdomain limit
  SCAN_TIMEOUT_MS: 8 * 60 * 1000,   // 8 minutes total scan timeout
  PARALLEL_TIMEOUT_MS: 90 * 1000,   // 90s for parallel phase
  SERIES_TIMEOUT_MS: 60 * 1000,     // 60s for series phase
  LLM_TIMEOUT_MS: 30 * 1000,        // 30s for Claude API call
  JOB_MAX_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY_MS: 30 * 1000,  // Base for exponential backoff
  PRIVATE_IP_RANGES: [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^0\.0\.0\.0/,
    /^localhost$/i,
  ],
} as const
