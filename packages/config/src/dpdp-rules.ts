// Static lookup table mapping finding types to DPDP Act 2023 sections
// Update this file when DPDP enforcement rules change
// Reference: Digital Personal Data Protection Act, 2023 (India)

export interface DpdpRule {
  section: string
  title: string
  fineRange: string
  implication: string
}

export const DPDP_RULES: Record<string, DpdpRule> = {
  ssl_expired: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to Rs. 50 crore',
    implication: 'An expired SSL certificate means customer data transmitted to your website is not encrypted. This is an inadequate security safeguard under DPDP Act Section 8(4).',
  },
  ssl_weak: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to Rs. 50 crore',
    implication: 'Weak SSL/TLS configuration exposes customer data to interception. This fails the reasonable security safeguard requirement under DPDP Act Section 8(4).',
  },
  missing_hsts: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to Rs. 50 crore',
    implication: 'Without HSTS, users can be forced onto unencrypted connections. DPDP Act requires adequate data protection in transit.',
  },
  no_csp: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to Rs. 50 crore',
    implication: 'Missing Content Security Policy increases risk of cross-site scripting attacks that could steal customer data.',
  },
  malware_detected: {
    section: 'Section 8(5)',
    title: 'Failure to protect personal data',
    fineRange: 'Up to Rs. 250 crore',
    implication: 'A malware-infected website can exfiltrate customer personal data. This is a direct violation of DPDP Act Section 8(5) which requires preventing unauthorized access.',
  },
  domain_in_breach: {
    section: 'Section 8(6)',
    title: 'Failure to notify of data breach',
    fineRange: 'Up to Rs. 200 crore',
    implication: 'Your domain appears in known breach databases. Under DPDP Act Section 8(6), you may be required to notify affected individuals and the Data Protection Board.',
  },
  missing_dmarc: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards — email spoofing risk',
    fineRange: 'Up to Rs. 50 crore',
    implication: 'Without DMARC, attackers can send emails pretending to be from your domain, potentially defrauding your customers.',
  },
  open_admin_panel: {
    section: 'Section 8(5)',
    title: 'Failure to prevent unauthorized access',
    fineRange: 'Up to Rs. 250 crore',
    implication: 'An exposed admin panel is a direct pathway for unauthorized access to customer data. DPDP Act Section 8(5) requires preventing such access.',
  },
  outdated_software: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to Rs. 50 crore',
    implication: 'Running outdated software with known vulnerabilities fails the reasonable security standard required by DPDP Act.',
  },
}
