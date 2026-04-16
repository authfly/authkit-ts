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

    try {
      const state = await this.flow.start("login");
      this.renderState(state);
    } catch (error) {
      this.showForm();
      this.showError(this.getErrorMessage(error, "Failed to initialize"));
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
        break;
      case "login_password":
        this.showForm();
        this.showPasswordField();
        break;
      case "onboarding_email":
        this.showForm();
        if (!this.config.features?.allowPublicRegistration) {
          this.showError("Registration is not available. Contact your administrator.");
        }
        break;
      case "success":
        window.location.href = this.config.successRedirect ?? "/sso/complete";
        break;
      case "error":
        this.showForm();
        this.showError(
          state.error_message ??
            (typeof state.payload?.error === "string" ? state.payload.error : "Authentication error"),
        );
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
      } else {
        next = await this.flow.submitCurrent();
      }

      this.renderState(next);
    } catch (error) {
      this.showError(this.getErrorMessage(error, "An error occurred"));
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
      emailInput.name = input.name || "identifier";
      emailInput.type = input.type === "string" ? "text" : input.type;
      emailInput.setAttribute(
        "autocomplete",
        input.name === "username" ? "username webauthn" : "email username webauthn",
      );
      emailInput.focus();
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

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return `${fallback}: ${error.message}`;
    }

    return fallback;
  }
}
