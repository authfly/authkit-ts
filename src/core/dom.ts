import { resolveError } from "./errors";
import { AuthFlow } from "./flow";
import type { AuthConfig, AuthState } from "./types";

type ControllerOptions = {
  loadingId?: string;
  formId?: string;
  emailId?: string;
  passwordWrapId?: string;
  passwordId?: string;
  errorId?: string;
  submitId?: string;
};

const defaultOptions: Required<ControllerOptions> = {
  loadingId: "auth-loading",
  formId: "auth-login-form",
  emailId: "auth-email",
  passwordWrapId: "auth-password-wrap",
  passwordId: "auth-password",
  errorId: "auth-error",
  submitId: "auth-submit",
};

export class AuthDOMController {
  private readonly flow: AuthFlow;
  private readonly config: AuthConfig;
  private readonly options: Required<ControllerOptions>;
  private boundSubmit: ((event: SubmitEvent) => void) | null = null;
  private restarting = false;
  /**
   * Cached result of `PublicKeyCredential.isConditionalMediationAvailable()`.
   * `null` until probed. We probe once during mount() and reuse the value so
   * that the `webauthn` autocomplete token (which causes Chrome/Edge to spin
   * up a passkey discovery loop and produces noticeable input lag on devices
   * without passkeys) is added only when ConditionalUI is actually supported.
   */
  private conditionalMediationAvailable: boolean | null = null;
  /** Last `name` we configured the email input for, to avoid touching DOM
   *  attributes (which can re-trigger WebAuthn discovery in Chromium) on
   *  repeat renders of the same identifier state. */
  private identifierConfiguredFor: string | null = null;

  constructor(flow: AuthFlow, options: ControllerOptions = {}) {
    this.flow = flow;
    this.config = flow.getConfig();
    this.options = { ...defaultOptions, ...options };
  }

  async mount(): Promise<void> {
    const form = this.getForm();
    const emailInput = this.getEmailInput();

    if (!form || !emailInput) {
      return;
    }

    this.boundSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      void this.handleSubmit();
    };

    form.addEventListener("submit", this.boundSubmit);
    this.flow.onSessionCreated(() => {
      window.location.href = this.config.successRedirect ?? "/sso/complete";
    });

    // Probe ConditionalUI in parallel with the initial flow handshake — both
    // are network/IPC bound and there is no reason to serialise them.
    void this.probeConditionalMediation();

    try {
      const state = await this.flow.start("login");
      this.renderState(state);
    } catch (error) {
      this.showForm();
      this.showError(this.getErrorMessage(error));
    }
  }

  private async probeConditionalMediation(): Promise<void> {
    if (this.conditionalMediationAvailable !== null) {
      return;
    }
    try {
      const PKC = (typeof globalThis !== "undefined"
        ? (globalThis as unknown as { PublicKeyCredential?: { isConditionalMediationAvailable?: () => Promise<boolean> } }).PublicKeyCredential
        : undefined);
      if (PKC && typeof PKC.isConditionalMediationAvailable === "function") {
        this.conditionalMediationAvailable = await PKC.isConditionalMediationAvailable();
      } else {
        this.conditionalMediationAvailable = false;
      }
    } catch {
      this.conditionalMediationAvailable = false;
    }
  }

  destroy(): void {
    const form = this.getForm();
    if (form && this.boundSubmit) {
      form.removeEventListener("submit", this.boundSubmit);
    }
    this.boundSubmit = null;
  }

  renderState(state: AuthState): void {
    this.clearError();

    switch (state.name) {
      case "login_init":
      case "login_identifier":
        this.renderIdentifierState(state);
        break;
      case "login_method_chooser":
        this.showForm();
        this.hidePasswordField();
        this.renderInlineError(state);
        break;
      case "login_password":
        this.showForm();
        this.showPasswordField();
        this.renderInlineError(state);
        this.handlePasswordRetry(state);
        break;
      case "onboarding_email":
        this.showForm();
        if (!this.config.features?.allowPublicRegistration) {
          this.showError("Registration is not available. Contact your administrator.");
        } else {
          this.renderInlineError(state);
        }
        break;
      case "success":
        window.location.href = this.config.successRedirect ?? "/sso/complete";
        break;
      case "error":
        // The provider gave us a terminal error state. Recover by re-initialising
        // the flow so the user can retry — but keep the resolved message on
        // screen instead of leaving them on a dead form.
        void this.recoverFromErrorState(state);
        break;
      default:
        this.showForm();
        break;
    }
  }

  static readConfig(scriptId = "auth-config"): AuthConfig | null {
    const configEl = document.getElementById(scriptId);
    if (!configEl?.textContent) {
      return null;
    }
    return JSON.parse(configEl.textContent) as AuthConfig;
  }

  private async handleSubmit(): Promise<void> {
    const emailInput = this.getEmailInput();
    const passwordInput = this.getPasswordInput();
    const state = this.flow.getState();

    if (!state || !emailInput) {
      return;
    }

    this.clearError();
    this.setLoading(true);

    try {
      let next: AuthState;
      if (state.actions.password_login?.enabled) {
        next = await this.flow.submitPassword(passwordInput?.value ?? "");
      } else if (state.actions.continue_with_login_identifier?.enabled) {
        next = await this.flow.submitIdentifier(emailInput.value);
        // Auto-chain: Hanko's Flow API requires two round trips for
        // identifier+password (login_init → login_password → success). When
        // the user already typed both fields we don't want to force a second
        // click — submit the password right away if the API moved us into
        // login_password and the field is non-empty.
        const passwordValue = passwordInput?.value ?? "";
        if (
          passwordValue.length > 0 &&
          next.name === "login_password" &&
          next.actions.password_login?.enabled &&
          !next.error &&
          !next.error_message
        ) {
          next = await this.flow.submitPassword(passwordValue);
        }
      } else {
        next = await this.flow.submitCurrent();
      }

      this.renderState(next);
    } catch (error) {
      // Most "errors" surface inside the new state already; this branch only
      // fires for genuine network/SDK exceptions. Try to recover by restarting
      // the flow so the user is not stuck on a dead form.
      this.showError(this.getErrorMessage(error));
      void this.recoverFromException();
    } finally {
      this.setLoading(false);
    }
  }

  private renderIdentifierState(state: AuthState): void {
    const emailInput = this.getEmailInput();
    const action = state.actions.continue_with_login_identifier;
    const input =
      action?.inputs?.email ?? action?.inputs?.username ?? action?.inputs?.identifier ?? null;

    this.showForm();
    this.hidePasswordField();

    if (emailInput && input) {
      this.configureIdentifierInput(emailInput, input.name, input.type);
      // Avoid stealing focus on every re-render: only focus when the input
      // is empty and not currently focused. Repeated focus() calls cause
      // layout/paint passes and (on Chromium) re-trigger WebAuthn discovery.
      if (emailInput.value === "" && document.activeElement !== emailInput) {
        emailInput.focus();
      }
    }

    this.renderInlineError(state);
  }

  private configureIdentifierInput(
    emailInput: HTMLInputElement,
    name: string | undefined,
    type: string | undefined,
  ): void {
    const safeName = name || "identifier";
    if (this.identifierConfiguredFor === safeName) {
      // Same identifier kind as last render. The DOM is already configured;
      // do nothing so we don't restart Chromium's autofill / WebAuthn
      // discovery on every re-render of login_identifier.
      return;
    }
    this.identifierConfiguredFor = safeName;

    emailInput.name = safeName;
    if (type) {
      const desired = type === "string" ? "text" : type;
      if (emailInput.type !== desired) {
        emailInput.type = desired;
      }
    }
    emailInput.setAttribute("autocomplete", this.identifierAutocomplete(safeName));
    emailInput.setAttribute("enterkeyhint", "next");
  }

  /**
   * Build the autocomplete token list for the identifier input.
   *
   * The `webauthn` token is added only when ConditionalUI was probed and
   * confirmed — otherwise Chromium spins up a passkey discovery loop on
   * every focus/input event, which manifests as a noticeable typing delay
   * even on devices that have no platform passkeys at all.
   */
  private identifierAutocomplete(name: string): string {
    const base = name === "username" ? "username" : "email username";
    if (this.conditionalMediationAvailable) {
      return base + " webauthn";
    }
    return base;
  }

  /**
   * After a failed password attempt Hanko returns a fresh login_password
   * state with the error attached. We clear the password field so the user
   * is prompted to type a new one (some browsers re-fill it from a stale
   * autofill cache otherwise) and place focus there.
   */
  private handlePasswordRetry(state: AuthState): void {
    const passwordInput = this.getPasswordInput();
    if (!passwordInput) {
      return;
    }

    const hasError =
      state.error ||
      state.error_message ||
      state.actions.password_login?.inputs?.password?.error;

    if (hasError) {
      passwordInput.value = "";
      passwordInput.focus();
      passwordInput.select?.();
    }
  }

  private async recoverFromErrorState(state: AuthState): Promise<void> {
    if (this.restarting) {
      this.showForm();
      return;
    }
    this.restarting = true;
    this.identifierConfiguredFor = null;
    const message = state.error_message ?? this.getErrorMessage(state.error);
    try {
      const next = await this.flow.restart({ preserveError: false });
      this.renderState(next);
      if (message) {
        this.showError(message);
      }
    } catch (error) {
      this.showForm();
      this.showError(this.getErrorMessage(error));
    } finally {
      this.restarting = false;
    }
  }

  private async recoverFromException(): Promise<void> {
    if (this.restarting) {
      return;
    }
    this.restarting = true;
    this.identifierConfiguredFor = null;
    try {
      const next = await this.flow.restart({ preserveError: true });
      this.renderState(next);
    } catch {
      // The error message shown by the caller is already meaningful; leave it.
    } finally {
      this.restarting = false;
    }
  }

  private getForm(): HTMLFormElement | null {
    return document.getElementById(this.options.formId) as HTMLFormElement | null;
  }

  private getEmailInput(): HTMLInputElement | null {
    return document.getElementById(this.options.emailId) as HTMLInputElement | null;
  }

  private getPasswordWrap(): HTMLElement | null {
    return document.getElementById(this.options.passwordWrapId);
  }

  private getPasswordInput(): HTMLInputElement | null {
    return document.getElementById(this.options.passwordId) as HTMLInputElement | null;
  }

  private getErrorElement(): HTMLElement | null {
    return document.getElementById(this.options.errorId);
  }

  private getLoadingElement(): HTMLElement | null {
    return document.getElementById(this.options.loadingId);
  }

  private getSubmitButton(): HTMLButtonElement | null {
    return document.getElementById(this.options.submitId) as HTMLButtonElement | null;
  }

  private showForm(): void {
    this.getLoadingElement()?.classList.add("hidden");
    this.getForm()?.classList.remove("hidden");
  }

  private showPasswordField(): void {
    this.getPasswordWrap()?.classList.remove("hidden");
    this.getPasswordInput()?.focus();
  }

  private hidePasswordField(): void {
    this.getPasswordWrap()?.classList.add("hidden");
  }

  private showError(message: string): void {
    const errorEl = this.getErrorElement();
    if (!errorEl) {
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  private renderInlineError(state: AuthState): void {
    const resolved = resolveError(state, this.flow.getCatalog());
    if (resolved?.message) {
      this.showError(resolved.message);
    }
  }

  private clearError(): void {
    const errorEl = this.getErrorElement();
    if (!errorEl) {
      return;
    }
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }

  private setLoading(enabled: boolean): void {
    const button = this.getSubmitButton();
    if (!button) {
      return;
    }
    button.disabled = enabled;
    button.classList.toggle("opacity-50", enabled);
  }

  private getErrorMessage(error: unknown): string {
    const catalog = this.flow.getCatalog();
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      const message =
        (code && catalog.byCode?.[code]) ||
        (error as { message?: string }).message ||
        catalog.fallback;
      if (message) {
        return message;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return catalog.fallback ?? "Authentication error.";
  }
}
