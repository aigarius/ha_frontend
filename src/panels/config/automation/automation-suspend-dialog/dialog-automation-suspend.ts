import { addDays, addHours, addWeeks, format } from "date-fns";
import type { CSSResultGroup } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { fireEvent } from "../../../../common/dom/fire_event";
import "../../../../components/ha-alert";
import "../../../../components/ha-button";
import "../../../../components/ha-dialog";
import "../../../../components/ha-dialog-footer";
import "../../../../components/ha-dialog-header";
import "../../../../components/ha-selector/ha-selector-datetime";
import type { DateTimeSelector } from "../../../../data/selector";
import type { HassDialog } from "../../../../dialogs/make-dialog-manager";
import { haStyle, haStyleDialog } from "../../../../resources/styles";
import type { HomeAssistant, ValueChangedEvent } from "../../../../types";
import type { AutomationSuspendDialogParams } from "./show-dialog-automation-suspend";

const DATETIME_SELECTOR: DateTimeSelector = { datetime: {} };

@customElement("ha-dialog-automation-suspend")
class DialogAutomationSuspend extends LitElement implements HassDialog {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _open = false;

  @state() private _params?: AutomationSuspendDialogParams;

  @state() private _dateTime = "";

  @state() private _saving = false;

  @state() private _error?: string;

  public showDialog(params: AutomationSuspendDialogParams): void {
    this._params = params;
    this._open = true;
    this._saving = false;
    this._error = undefined;

    let initialDate = new Date();
    if (params.suspendedUntil) {
      const parsed = new Date(params.suspendedUntil);
      if (!isNaN(parsed.getTime())) {
        initialDate = parsed;
      }
    }

    this._setDateTime(initialDate);
  }

  public closeDialog(): boolean {
    this._open = false;
    return true;
  }

  private _dialogClosed(): void {
    this._open = false;
    this._params = undefined;
    this._error = undefined;
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  private _setDateTime(dateObj: Date): void {
    this._dateTime = format(dateObj, "yyyy-MM-dd HH:mm:ss");
  }

  private _applyPreset(amount: "1h" | "1d" | "1w"): void {
    this._error = undefined;
    let current = new Date();
    if (this._dateTime) {
      const parsed = new Date(this._dateTime.replace(" ", "T"));
      if (!isNaN(parsed.getTime())) {
        current = parsed;
      }
    }

    let target: Date;
    switch (amount) {
      case "1h":
        target = addHours(current, 1);
        break;
      case "1d":
        target = addDays(current, 1);
        break;
      case "1w":
        target = addWeeks(current, 1);
        break;
    }
    this._setDateTime(target);
  }

  private _applyPreset1h(): void {
    this._applyPreset("1h");
  }

  private _applyPreset1d(): void {
    this._applyPreset("1d");
  }

  private _applyPreset1w(): void {
    this._applyPreset("1w");
  }

  private _dateTimeChanged(ev: ValueChangedEvent<string>): void {
    this._error = undefined;
    this._dateTime = ev.detail.value;
  }

  private async _save(): Promise<void> {
    if (!this._params || !this._dateTime) {
      return;
    }

    const untilDate = new Date(this._dateTime.replace(" ", "T"));
    if (untilDate <= new Date()) {
      this._error =
        this.hass.localize(
          "ui.panel.config.automation.editor.suspend_dialog.error_past"
        ) || "The suspend end time must be in the future";
      return;
    }

    this._saving = true;
    try {
      await this.hass.callService("automation", "suspend", {
        entity_id: this._params.entityId,
        until: untilDate.toISOString(),
      });
      this.closeDialog();
    } catch (_err: any) {
      this._saving = false;
    }
  }

  private async _removeSuspend(): Promise<void> {
    if (!this._params) {
      return;
    }

    this._saving = true;
    try {
      await this.hass.callService("automation", "suspend", {
        entity_id: this._params.entityId,
      });
      this.closeDialog();
    } catch (_err: any) {
      this._saving = false;
    }
  }

  protected render() {
    if (!this._params) {
      return nothing;
    }

    const isCurrentlySuspended = Boolean(this._params.suspendedUntil);

    return html`
      <ha-dialog
        .open=${this._open}
        @closed=${this._dialogClosed}
        .headerTitle=${this.hass.localize(
          "ui.panel.config.automation.editor.suspend_dialog.title"
        )}
      >
        <div class="content">
          <p class="description">
            ${this.hass.localize(
              "ui.panel.config.automation.editor.suspend_dialog.description",
              { name: this._params.name || this._params.entityId }
            )}
          </p>

          ${
            this._error
              ? html`<ha-alert alert-type="error">${this._error}</ha-alert>`
              : nothing
          }

          <div class="presets">
            <ha-button
              size="s"
              appearance="outlined"
              @click=${this._applyPreset1h}
            >
              ${
                this.hass.localize(
                  "ui.panel.config.automation.editor.suspend_dialog.presets.one_hour"
                ) || "+1 hour"
              }
            </ha-button>
            <ha-button
              size="s"
              appearance="outlined"
              @click=${this._applyPreset1d}
            >
              ${
                this.hass.localize(
                  "ui.panel.config.automation.editor.suspend_dialog.presets.one_day"
                ) || "+1 day"
              }
            </ha-button>
            <ha-button
              size="s"
              appearance="outlined"
              @click=${this._applyPreset1w}
            >
              ${
                this.hass.localize(
                  "ui.panel.config.automation.editor.suspend_dialog.presets.one_week"
                ) || "+1 week"
              }
            </ha-button>
          </div>

          <ha-selector-datetime
            .hass=${this.hass}
            .selector=${DATETIME_SELECTOR}
            .value=${this._dateTime}
            .label=${this.hass.localize(
              "ui.panel.config.automation.editor.suspend_dialog.end_time"
            )}
            @value-changed=${this._dateTimeChanged}
          ></ha-selector-datetime>
        </div>

        <ha-dialog-footer slot="footer">
          ${
            isCurrentlySuspended
              ? html`
                  <ha-button
                    slot="secondaryAction"
                    variant="danger"
                    .disabled=${this._saving}
                    @click=${this._removeSuspend}
                  >
                    ${this.hass.localize(
                      "ui.panel.config.automation.editor.suspend_dialog.remove_suspend"
                    )}
                  </ha-button>
                `
              : html`
                  <ha-button
                    slot="secondaryAction"
                    appearance="plain"
                    @click=${this.closeDialog}
                  >
                    ${this.hass.localize("ui.common.cancel")}
                  </ha-button>
                `
          }
          <ha-button
            slot="primaryAction"
            .loading=${this._saving}
            .disabled=${this._saving || !this._dateTime}
            @click=${this._save}
          >
            ${this.hass.localize("ui.common.save")}
          </ha-button>
        </ha-dialog-footer>
      </ha-dialog>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      haStyleDialog,
      css`
        .content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .description {
          margin: 0;
          color: var(--secondary-text-color);
        }
        .presets {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-dialog-automation-suspend": DialogAutomationSuspend;
  }
}
