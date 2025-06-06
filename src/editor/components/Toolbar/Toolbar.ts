import { EventEmitter } from 'eventemitter3';
import { EditorIconService } from '../../services/EditorIconService';
import './Toolbar.css'; // Co-located CSS

export interface ToolbarButtonDefinition {
  id: string;
  title: string;
  iconName: string;
  action: () => void;
  isActive?: () => boolean;
  isToggle?: boolean;
  disabled?: () => boolean;
  isHidden?: () => boolean;
}

// NOVO: Definição para um elemento de exibição de texto
export interface ToolbarDisplayDefinition {
  id: string;
  text: () => string; // Função que retorna o texto a ser exibido
  title?: string; // Tooltip para o display
}

type ToolbarItem = ToolbarButtonDefinition | ToolbarDisplayDefinition | { type: 'separator' };

function isButtonDefinition(item: ToolbarItem): item is ToolbarButtonDefinition {
    return (item as ToolbarButtonDefinition).action !== undefined;
}

function isDisplayDefinition(item: ToolbarItem): item is ToolbarDisplayDefinition {
    return (item as ToolbarDisplayDefinition).text !== undefined;
}

export class Toolbar {
  private wrapper: HTMLElement;
  private toolbarElement: HTMLElement;
  private items: ToolbarItem[] = []; // Armazena todas as definições
  private events: EventEmitter;

  constructor(
    wrapperElement: HTMLElement,
    private iconService: EditorIconService
    ) {
    this.wrapper = wrapperElement;
    this.events = new EventEmitter();

    this.toolbarElement = document.createElement('div');
    this.toolbarElement.className = 'editor-toolbar floating-menu';
    this.wrapper.appendChild(this.toolbarElement);
  }

  public addButton(buttonDef: ToolbarButtonDefinition): void {
    this.items.push(buttonDef);
    this.render();
  }

  // NOVO: Método para adicionar um display de texto
  public addDisplay(displayDef: ToolbarDisplayDefinition): void {
    this.items.push(displayDef);
    this.render();
  }

  public addSeparator(): void {
    this.items.push({ type: 'separator' });
    this.render();
  }

  private render(): void {
    this.toolbarElement.innerHTML = ''; // Limpa a barra de ferramentas antes de renderizar
    this.items.forEach(item => {
        if (isButtonDefinition(item)) {
            this.renderButton(item);
        } else if (isDisplayDefinition(item)) {
            this.renderDisplay(item);
        } else if (item.type === 'separator') {
            const separator = document.createElement('div');
            separator.className = 'toolbar-separator';
            this.toolbarElement.appendChild(separator);
        }
    });
    this.refresh(); // Atualiza os estados visuais após a renderização
  }

  private renderButton(buttonDef: ToolbarButtonDefinition): void {
    const buttonElement = document.createElement('button');
    buttonElement.className = 'toolbar-button';
    buttonElement.id = `toolbar-btn-${buttonDef.id}`;
    buttonElement.title = buttonDef.title;

    buttonElement.innerHTML = this.iconService.getIconHTMLString(buttonDef.iconName);

    buttonElement.addEventListener('click', () => {
      if (buttonElement.disabled) return;
      buttonDef.action();
      this.refresh(); // Atualiza o estado visual após a ação
      this.events.emit('buttonClicked', buttonDef.id);
    });

    this.toolbarElement.appendChild(buttonElement);
  }

  private renderDisplay(displayDef: ToolbarDisplayDefinition): void {
    const displayElement = document.createElement('div');
    displayElement.className = 'toolbar-display'; // Adicionamos uma classe para estilização
    displayElement.id = `toolbar-display-${displayDef.id}`;
    if (displayDef.title) {
        displayElement.title = displayDef.title;
    }
    this.toolbarElement.appendChild(displayElement);
  }

  public refresh(): void {
    this.items.forEach(item => {
        if (isButtonDefinition(item)) {
            const buttonElement = this.toolbarElement.querySelector(`#toolbar-btn-${item.id}`) as HTMLButtonElement;
            if (buttonElement) {
                const isHidden = item.isHidden ? item.isHidden() : false;
                buttonElement.style.display = isHidden ? 'none' : '';

                const isActive = item.isActive ? item.isActive() : false;
                buttonElement.classList.toggle('active', isActive);

                const isDisabled = item.disabled ? item.disabled() : false;
                buttonElement.disabled = isDisabled;
                buttonElement.classList.toggle('disabled', isDisabled);
            }
        } else if (isDisplayDefinition(item)) {
            const displayElement = this.toolbarElement.querySelector(`#toolbar-display-${item.id}`) as HTMLDivElement;
            if (displayElement) {
                displayElement.textContent = item.text();
            }
        }
    });
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
    this.wrapper.innerHTML = '';
    this.events.removeAllListeners();
    this.items = [];
  }
}