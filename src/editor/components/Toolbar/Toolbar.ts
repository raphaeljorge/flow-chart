// src/editor/components/Toolbar/Toolbar.ts
import { EventEmitter } from 'eventemitter3';
import { EditorIconService } from '../../services/EditorIconService';
import './Toolbar.css'; // Co-located CSS

export interface ToolbarButtonDefinition {
  id: string;
  title: string;
  iconName: string; // Icon name like 'ph-grid-four', EditorIconService handles prefix
  action: () => void;
  isActive?: () => boolean; // Optional: function to check if the button should appear active
  isToggle?: boolean; // If the button acts as a toggle
  disabled?: () => boolean; // CORRECTED: If the button should be disabled
  isHidden?: () => boolean; // If the button should be hidden
}

export class Toolbar {
  private wrapper: HTMLElement; // The .toolbar-wrapper div passed from NodeEditorController
  private toolbarElement: HTMLElement; // The actual div.floating-menu
  private buttons: ToolbarButtonDefinition[] = [];
  private events: EventEmitter;

  constructor(
    wrapperElement: HTMLElement, // The div that will contain the toolbar (for positioning)
    private iconService: EditorIconService
    ) {
    this.wrapper = wrapperElement;
    this.events = new EventEmitter();

    this.toolbarElement = document.createElement('div');
    this.toolbarElement.className = 'editor-toolbar floating-menu'; // Use a more specific class
    this.wrapper.appendChild(this.toolbarElement);
  }

  public addButton(buttonDef: ToolbarButtonDefinition): void {
    this.buttons.push(buttonDef);
    this.renderButton(buttonDef);
  }

  public addSeparator(): void {
    const separator = document.createElement('div');
    separator.className = 'toolbar-separator';
    this.toolbarElement.appendChild(separator);
  }

  private renderButton(buttonDef: ToolbarButtonDefinition): void {
    const buttonElement = document.createElement('button');
    buttonElement.className = 'toolbar-button';
    buttonElement.id = `toolbar-btn-${buttonDef.id}`; // Ensure unique ID
    buttonElement.title = buttonDef.title;

    buttonElement.innerHTML = this.iconService.getIconHTMLString(buttonDef.iconName);

    const updateVisualState = () => {
        if (buttonDef.isHidden && buttonDef.isHidden()) {
            buttonElement.style.display = 'none';
            return;
        }
        buttonElement.style.display = ''; // Ensure visible if not hidden

        const active = buttonDef.isActive ? buttonDef.isActive() : false;
        buttonElement.classList.toggle('active', active);

        const disabled = buttonDef.disabled ? buttonDef.disabled() : false;
        buttonElement.disabled = disabled;
        buttonElement.classList.toggle('disabled', disabled);
    };

    updateVisualState(); // Initial state

    buttonElement.addEventListener('click', () => {
      if (buttonElement.disabled) return;
      buttonDef.action();
      // For toggle buttons, isActive should now reflect the new state
      if (buttonDef.isToggle) {
        const active = buttonDef.isActive ? buttonDef.isActive() : false;
        buttonElement.classList.toggle('active', active);
      }
      this.events.emit('buttonClicked', buttonDef.id);
    });

    this.toolbarElement.appendChild(buttonElement);
  }

  // Call this to re-evaluate visual states of all buttons
  public refreshButtonStates(): void {
    this.buttons.forEach(buttonDef => {
      const buttonElement = this.toolbarElement.querySelector(`#toolbar-btn-${buttonDef.id}`) as HTMLButtonElement;
      if (buttonElement) {
        if (buttonDef.isHidden && buttonDef.isHidden()) {
            buttonElement.style.display = 'none';
        } else {
            buttonElement.style.display = '';
            const isActive = buttonDef.isActive ? buttonDef.isActive() : false;
            buttonElement.classList.toggle('active', isActive);

            const isDisabled = buttonDef.disabled ? buttonDef.disabled() : false; // Call the function
            buttonElement.disabled = isDisabled;
            buttonElement.classList.toggle('disabled', isDisabled);
        }
      }
    });
  }

  // Specific update methods if needed, though refreshButtonStates is more general
  public updateButtonActiveState(buttonId: string, isActive: boolean): void {
    const buttonElement = this.toolbarElement.querySelector(`#toolbar-btn-${buttonId}`) as HTMLButtonElement;
    if (buttonElement) {
      buttonElement.classList.toggle('active', isActive);
    }
  }

  public updateButtonDisabledState(buttonId: string, isDisabled: boolean): void {
    const buttonElement = this.toolbarElement.querySelector(`#toolbar-btn-${buttonId}`) as HTMLButtonElement;
    if (buttonElement) {
      buttonElement.disabled = isDisabled;
      buttonElement.classList.toggle('disabled', isDisabled);
    }
  }

  public on(event: 'buttonClicked', listener: (buttonId: string) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public off(event: 'buttonClicked', listener: (buttonId: string) => void): this {
    this.events.off(event, listener);
    return this;
  }

  public destroy(): void {
    this.wrapper.innerHTML = ''; // Clear the wrapper this component was mounted in
    this.events.removeAllListeners();
    this.buttons = [];
  }
}