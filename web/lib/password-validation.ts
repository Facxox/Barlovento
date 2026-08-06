// lib/password-validation.ts
//
// Validación de contraseñas en la capa de aplicación.
// Supabase Free no expone HaveIBeenPwned; replicamos una protección equivalente:
//  * mínimo de 8 caracteres.
//  * al menos una minúscula, una mayúscula, un dígito y un símbolo.
//  * bloqueo de contraseñas triviales (top leaked + patrones comunes).
//
// El helper es puro y se usa tanto en el cliente (SignupForm) como en la
// Server Action (signUp) para impedir bypass por llamadas directas.

export type PasswordCheck =
  | { ok: true }
  | { ok: false; reason: string };

const MIN_LENGTH = 8;

// Top contraseñas filtradas — subset chico pero efectivo para bloqueo.
// Se matchea case-insensitive sobre la contraseña completa.
const COMMON_PASSWORDS = new Set<string>([
  '12345678', '123456789', '1234567890', '1234567', '123456',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123',
  'iloveyou', 'admin', 'admin123', 'letmein', 'welcome',
  'welcome1', 'monkey', 'dragon', 'football', 'baseball',
  'sunshine', 'princess', 'ashley', 'michael', 'shadow',
  'master', 'jordan', 'harley', 'ranger', 'buster',
  'hunter', 'soccer', 'hockey', 'batman', 'tigger',
  'trustno1', 'freedom', 'whatever', 'qazwsx', 'abc123',
  '11111111', '00000000', '66666666', 'asdfgh', 'asdfghjk',
  'zxcvbnm', 'passw0rd', 'p@ssw0rd', 'p@ssword1', 'qwertyuiop',
  'contraseña', 'contrasena', 'clave123', 'miclave', 'miclave123',
]);

export function validatePassword(password: string): PasswordCheck {
  if (typeof password !== 'string') {
    return { ok: false, reason: 'Contraseña inválida.' };
  }

  if (password.length < MIN_LENGTH) {
    return {
      ok: false,
      reason: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`,
    };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  // Cualquier carácter no alfanumérico cuenta como símbolo.
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
    return {
      ok: false,
      reason:
        'La contraseña debe incluir mayúsculas, minúsculas, números y un símbolo.',
    };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      ok: false,
      reason: 'Elegí una contraseña menos común.',
    };
  }

  return { ok: true };
}
