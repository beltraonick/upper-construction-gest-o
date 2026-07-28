export type Locale = 'en' | 'pt' | 'es'

export const LOCALE_COOKIE = 'orbitops_locale'

export const LOCALES: { value: Locale; flag: string; label: string }[] = [
  { value: 'en', flag: '🇺🇸', label: 'English' },
  { value: 'pt', flag: '🇧🇷', label: 'Português' },
  { value: 'es', flag: '🇪🇸', label: 'Español' },
]

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    tagline: 'Workforce Management',
    iAmA: 'I am a…',
    roleEmployee: 'Employee',
    roleEmployeeSub: 'Clock in, view tasks',
    roleAdmin: 'Administrator',
    roleAdminSub: 'Manage team & projects',
    roleClient: 'Client',
    roleClientSub: 'View project progress',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign In',
    signingIn: 'Signing in…',
    errorGeneric: 'Something went wrong. Please try again.',
    joiningTeam: 'Joining a team?',
    createAccount: 'Create account',
    newBusiness: 'New business?',
    setupCompany: 'Set up your company',
  },
  pt: {
    tagline: 'Gestão de Equipe de Obra',
    iAmA: 'Eu sou…',
    roleEmployee: 'Funcionário',
    roleEmployeeSub: 'Bater ponto, ver tarefas',
    roleAdmin: 'Administrador',
    roleAdminSub: 'Gerenciar equipe e projetos',
    roleClient: 'Cliente',
    roleClientSub: 'Ver progresso do projeto',
    emailLabel: 'E-mail',
    passwordLabel: 'Senha',
    forgotPassword: 'Esqueceu a senha?',
    signIn: 'Entrar',
    signingIn: 'Entrando…',
    errorGeneric: 'Algo deu errado. Tente novamente.',
    joiningTeam: 'Entrando em uma equipe?',
    createAccount: 'Criar conta',
    newBusiness: 'Nova empresa?',
    setupCompany: 'Configure sua empresa',
  },
  es: {
    tagline: 'Gestión de Personal de Obra',
    iAmA: 'Soy…',
    roleEmployee: 'Empleado',
    roleEmployeeSub: 'Marcar hora, ver tareas',
    roleAdmin: 'Administrador',
    roleAdminSub: 'Gestionar equipo y proyectos',
    roleClient: 'Cliente',
    roleClientSub: 'Ver progreso del proyecto',
    emailLabel: 'Correo electrónico',
    passwordLabel: 'Contraseña',
    forgotPassword: '¿Olvidó su contraseña?',
    signIn: 'Iniciar sesión',
    signingIn: 'Iniciando sesión…',
    errorGeneric: 'Algo salió mal. Inténtalo de nuevo.',
    joiningTeam: '¿Te unes a un equipo?',
    createAccount: 'Crear cuenta',
    newBusiness: '¿Empresa nueva?',
    setupCompany: 'Configura tu empresa',
  },
}

// Known server-side error strings (from app/actions/auth.ts), translated.
// Anything not in this map is shown as-is (falls back to the original English).
const errorTranslations: Record<string, Record<Locale, string>> = {
  'Email and password are required.': {
    en: 'Email and password are required.',
    pt: 'E-mail e senha são obrigatórios.',
    es: 'Correo electrónico y contraseña son obligatorios.',
  },
  'Invalid email or password.': {
    en: 'Invalid email or password.',
    pt: 'E-mail ou senha inválidos.',
    es: 'Correo electrónico o contraseña inválidos.',
  },
  'Your account has not been activated yet. Use the activation link sent by your administrator.': {
    en: 'Your account has not been activated yet. Use the activation link sent by your administrator.',
    pt: 'Sua conta ainda não foi ativada. Use o link de ativação enviado pelo seu administrador.',
    es: 'Su cuenta aún no ha sido activada. Use el enlace de activación enviado por su administrador.',
  },
  'Your account has been suspended. Contact your administrator.': {
    en: 'Your account has been suspended. Contact your administrator.',
    pt: 'Sua conta foi suspensa. Entre em contato com seu administrador.',
    es: 'Su cuenta ha sido suspendida. Contacte a su administrador.',
  },
}

export function t(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries.en[key] ?? key
}

export function translateError(locale: Locale, message: string): string {
  return errorTranslations[message]?.[locale] ?? message
}

export function getStoredLocale(): Locale {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=(en|pt|es)`))
  return (match?.[1] as Locale) ?? 'en'
}

export function storeLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000`
}
