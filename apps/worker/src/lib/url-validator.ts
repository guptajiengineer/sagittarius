import { SCAN_LIMITS } from '@sagittarius/config'

interface UrlValidationResult {
  valid: boolean
  normalizedUrl?: string
  domain?: string
  error?: 'invalid_format' | 'private_target' | 'unsupported_scheme'
}

/**
 * Validates and normalizes a URL for scanning.
 * Rejects private IPs, localhost, and non-HTTP schemes.
 */
export function validateAndNormalizeUrl(rawUrl: string): UrlValidationResult {
  let urlStr = rawUrl.trim()

  // Add https:// if no scheme
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = 'https://' + urlStr
  }

  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { valid: false, error: 'invalid_format' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'unsupported_scheme' }
  }

  const hostname = parsed.hostname.toLowerCase()

  // Check private IP ranges
  for (const pattern of SCAN_LIMITS.PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'private_target' }
    }
  }

  const normalizedUrl = `${parsed.protocol}//${hostname}${parsed.pathname}`.replace(/\/$/, '') || `${parsed.protocol}//${hostname}`
  return {
    valid: true,
    normalizedUrl,
    domain: hostname,
  }
}
