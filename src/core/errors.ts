import type { AuthError, AuthErrorCatalog, AuthErrorContext, AuthState } from "./types";

const GENERIC_ERROR_CODES = new Set([
  "invalid_form_data",
  "form_data_invalid_error",
  "value_invalid_error",
  "value_invalid",
  "validation_error",
]);

const DEFAULT_FALLBACK = "Authentication error. Please try again.";

const EN_CATALOG: AuthErrorCatalog = {
  fallback: DEFAULT_FALLBACK,
  byCode: {
    invalid_form_data: "Please check the form fields and try again.",
    form_data_invalid_error: "Please check the form fields and try again.",
    value_invalid_error: "The value you entered is not valid.",
    value_invalid: "The value you entered is not valid.",
    value_too_short_error: "The value you entered is too short.",
    value_too_long_error: "The value you entered is too long.",
    invalid_credentials: "Invalid email or password.",
    invalid_credentials_error: "Invalid email or password.",
    password_invalid_error: "Invalid password.",
    password_too_short_error: "Password is too short.",
    password_too_long_error: "Password is too long.",
    passcode_invalid: "The verification code is incorrect.",
    passcode_invalid_error: "The verification code is incorrect.",
    passcode_expired: "The verification code has expired.",
    passcode_expired_error: "The verification code has expired.",
    passcode_attempts_reached_error: "Too many failed attempts. Request a new code.",
    rate_limit_exceeded_error: "Too many requests. Please wait and try again.",
    too_many_requests: "Too many requests. Please wait and try again.",
    flow_expired_error: "Your session has expired. Please start over.",
    unauthorized_error: "You are not authorized to perform this action.",
    unauthorized: "You are not authorized to perform this action.",
    forbidden: "Access is forbidden.",
    not_found: "The requested resource was not found.",
    user_not_found: "Account not found.",
    unknown_username_error: "Account not found.",
    email_address_already_exists_error: "Email already in use.",
    network_error: "Network error. Please check your connection.",
    internal_server_error: "Server error. Please try again later.",
    unknown_error: "Unexpected error. Please try again.",
  },
  byStateCode: {
    login_password: {
      invalid_form_data: "Invalid email or password.",
      form_data_invalid_error: "Invalid email or password.",
      value_invalid_error: "Invalid email or password.",
    },
    login_identifier: {
      invalid_form_data: "Please enter a valid email or username.",
      form_data_invalid_error: "Please enter a valid email or username.",
    },
    login_init: {
      invalid_form_data: "Please enter a valid email or username.",
    },
    onboarding_email: {
      invalid_form_data: "Please enter a valid email address.",
      email_address_already_exists_error: "Email already in use.",
    },
  },
};

const RU_CATALOG: AuthErrorCatalog = {
  fallback: "Ошибка аутентификации. Попробуйте ещё раз.",
  byCode: {
    invalid_form_data: "Проверьте поля формы и попробуйте снова.",
    form_data_invalid_error: "Проверьте поля формы и попробуйте снова.",
    value_invalid_error: "Введённое значение некорректно.",
    value_invalid: "Введённое значение некорректно.",
    value_too_short_error: "Слишком короткое значение.",
    value_too_long_error: "Слишком длинное значение.",
    invalid_credentials: "Неверный e-mail или пароль.",
    invalid_credentials_error: "Неверный e-mail или пароль.",
    password_invalid_error: "Неверный пароль.",
    password_too_short_error: "Пароль слишком короткий.",
    password_too_long_error: "Пароль слишком длинный.",
    passcode_invalid: "Код подтверждения неверен.",
    passcode_invalid_error: "Код подтверждения неверен.",
    passcode_expired: "Срок действия кода истёк.",
    passcode_expired_error: "Срок действия кода истёк.",
    passcode_attempts_reached_error: "Слишком много неудачных попыток. Запросите новый код.",
    rate_limit_exceeded_error: "Слишком много запросов. Подождите и повторите.",
    too_many_requests: "Слишком много запросов. Подождите и повторите.",
    flow_expired_error: "Сессия истекла. Начните заново.",
    unauthorized_error: "У вас нет прав для этого действия.",
    unauthorized: "У вас нет прав для этого действия.",
    forbidden: "Доступ запрещён.",
    not_found: "Ресурс не найден.",
    user_not_found: "Аккаунт не найден.",
    unknown_username_error: "Аккаунт не найден.",
    email_address_already_exists_error: "Этот e-mail уже используется.",
    network_error: "Сетевая ошибка. Проверьте подключение.",
    internal_server_error: "Ошибка сервера. Попробуйте позже.",
    unknown_error: "Непредвиденная ошибка. Попробуйте снова.",
  },
  byStateCode: {
    login_password: {
      invalid_form_data: "Неверный e-mail или пароль.",
      form_data_invalid_error: "Неверный e-mail или пароль.",
      value_invalid_error: "Неверный e-mail или пароль.",
    },
    login_identifier: {
      invalid_form_data: "Введите корректный e-mail или имя пользователя.",
      form_data_invalid_error: "Введите корректный e-mail или имя пользователя.",
    },
    login_init: {
      invalid_form_data: "Введите корректный e-mail или имя пользователя.",
    },
    onboarding_email: {
      invalid_form_data: "Введите корректный e-mail.",
      email_address_already_exists_error: "Этот e-mail уже используется.",
    },
  },
};

const BUILTIN_CATALOGS: Record<string, AuthErrorCatalog> = {
  en: EN_CATALOG,
  "en-us": EN_CATALOG,
  ru: RU_CATALOG,
  "ru-ru": RU_CATALOG,
};

function pickBuiltinCatalog(locale?: string): AuthErrorCatalog {
  if (!locale) {
    return EN_CATALOG;
  }
  const key = locale.toLowerCase();
  return BUILTIN_CATALOGS[key] ?? BUILTIN_CATALOGS[key.split("-")[0]!] ?? EN_CATALOG;
}

function mergeCatalogs(base: AuthErrorCatalog, override?: AuthErrorCatalog): AuthErrorCatalog {
  if (!override) {
    return base;
  }
  return {
    fallback: override.fallback ?? base.fallback,
    byCode: { ...base.byCode, ...override.byCode },
    byStateCode: {
      ...base.byStateCode,
      ...override.byStateCode,
    },
  };
}

export function resolveCatalog(locale?: string, override?: AuthErrorCatalog): AuthErrorCatalog {
  return mergeCatalogs(pickBuiltinCatalog(locale), override);
}

export function isGenericErrorCode(code?: string): boolean {
  if (!code) {
    return false;
  }
  return GENERIC_ERROR_CODES.has(code);
}

export interface ResolvedError {
  code?: string;
  message: string;
  source: "input" | "state" | "payload" | "catalog" | "fallback" | "explicit";
}

/**
 * Resolves the most specific error message for a given Hanko Flow API state.
 *
 * Priority:
 *   1. specific input error (with non-generic code)
 *   2. state.error (with non-generic code)
 *   3. specific input error message (even if code is generic, if it carries a real text)
 *   4. catalog lookup by stateName + code
 *   5. catalog lookup by code
 *   6. state.error.message / payload.error
 *   7. catalog fallback
 */
export function resolveError(
  state: AuthState | null,
  catalog: AuthErrorCatalog,
  ctx: AuthErrorContext = {},
): ResolvedError | null {
  if (!state) {
    return null;
  }

  const stateName = state.name;
  const inputError = findInputError(state);
  const stateError = state.error;

  if (inputError && !isGenericErrorCode(inputError.code)) {
    return {
      code: inputError.code,
      message: lookupCatalog(catalog, stateName, inputError.code) ?? inputError.message,
      source: "input",
    };
  }

  if (stateError && !isGenericErrorCode(stateError.code)) {
    return {
      code: stateError.code,
      message: lookupCatalog(catalog, stateName, stateError.code) ?? stateError.message,
      source: "state",
    };
  }

  if (inputError?.message && !isGenericMessage(inputError.message)) {
    return {
      code: inputError.code,
      message: inputError.message,
      source: "input",
    };
  }

  const code = stateError?.code ?? inputError?.code;
  if (code) {
    const fromCatalog = lookupCatalog(catalog, stateName, code);
    if (fromCatalog) {
      return { code, message: fromCatalog, source: "catalog" };
    }
  }

  if (stateError?.message && !isGenericMessage(stateError.message)) {
    return {
      code: stateError.code,
      message: stateError.message,
      source: "state",
    };
  }

  if (typeof state.payload?.error === "string" && state.payload.error.trim().length > 0) {
    return {
      code: undefined,
      message: state.payload.error,
      source: "payload",
    };
  }

  if (ctx.fallback) {
    return { message: ctx.fallback, source: "explicit" };
  }

  if (code || stateError || inputError) {
    return { code, message: catalog.fallback ?? DEFAULT_FALLBACK, source: "fallback" };
  }

  return null;
}

function lookupCatalog(catalog: AuthErrorCatalog, stateName?: string, code?: string): string | undefined {
  if (!code) {
    return undefined;
  }
  if (stateName) {
    const byState = catalog.byStateCode?.[stateName];
    if (byState && byState[code]) {
      return byState[code];
    }
  }
  return catalog.byCode?.[code];
}

function findInputError(state: AuthState): AuthError | undefined {
  for (const action of Object.values(state.actions)) {
    if (!action?.inputs) {
      continue;
    }
    for (const input of Object.values(action.inputs)) {
      if (input?.error) {
        return input.error;
      }
    }
  }
  return undefined;
}

const GENERIC_MESSAGES = new Set([
  "form data invalid",
  "form data invalid.",
  "invalid form data",
  "invalid form data.",
  "validation error",
  "validation failed",
]);

function isGenericMessage(message: string): boolean {
  return GENERIC_MESSAGES.has(message.trim().toLowerCase());
}
