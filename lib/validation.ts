export const ALLOWED_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || '@meucurso.com.br';
export const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'rodrigo.reis@meucurso.com.br';

export function isValidEmail(email: string): boolean {
  return email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

export function validateEmailDomain(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email é obrigatório' };
  }

  if (!isValidEmail(email)) {
    return { 
      valid: false, 
      error: `Apenas emails ${ALLOWED_EMAIL_DOMAIN} são permitidos` 
    };
  }

  return { valid: true };
}

export function isSuperAdminEmail(email: string): boolean {
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}
