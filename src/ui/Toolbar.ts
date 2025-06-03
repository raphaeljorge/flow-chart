import { EventEmitter } from 'eventemitter3';

// Definir tipos para os botões da barra de ferramentas
interface ToolbarButton {
  id: string; // Ex: 'toggle-grid', 'zoom-in'
  title: string;
  iconClass: string; // Classe CSS para o ícone (ex: 'ph ph-grid-four')
  action: () => void; // Ação a ser executada ao clicar
  isActive?: () => boolean; // Opcional: função para verificar se o botão deve parecer ativo
  isToggle?: boolean; // Se o botão é um toggle
  disabled?: boolean; // Se o botão está desabilitado por padrão
}

export class Toolbar {
  private container: HTMLElement; // Onde a barra de ferramentas será inserida
  private toolbarElement: HTMLElement | null = null;
  private buttons: ToolbarButton[] = [];
  private events: EventEmitter;

  constructor(containerElement: HTMLElement) {
    this.container = containerElement;
    this.events = new EventEmitter();
    this.createToolbarElement();
  }

  private createToolbarElement(): void {
    this.toolbarElement = document.createElement('div');
    this.toolbarElement.className = 'floating-menu'; //
    this.container.appendChild(this.toolbarElement);
  }

  public addButton(button: ToolbarButton): void {
    this.buttons.push(button);
    this.renderButton(button);
  }
  
  public addSeparator(): void {
      if (!this.toolbarElement) return;
      const separator = document.createElement('div');
      separator.className = 'menu-separator'; //
      this.toolbarElement.appendChild(separator);
  }

  private renderButton(buttonDef: ToolbarButton): void {
    if (!this.toolbarElement) return;

    const buttonElement = document.createElement('button');
    buttonElement.className = 'menu-button'; //
    buttonElement.id = buttonDef.id;
    buttonElement.title = buttonDef.title;
    
    const iconElement = document.createElement('i');
    iconElement.className = buttonDef.iconClass; // Ex: "ph ph-grid-four"
    buttonElement.appendChild(iconElement);

    if (buttonDef.isActive && buttonDef.isActive()) {
      buttonElement.classList.add('active'); //
    }

    if (buttonDef.disabled) { // Adicionar estado desabilitado
        buttonElement.disabled = true;
        buttonElement.classList.add('disabled');
    }

    buttonElement.addEventListener('click', () => {
      if (buttonElement.disabled) return; // Não executa se desabilitado
      buttonDef.action();
      if (buttonDef.isToggle) { // Se for um botão de toggle
          if (buttonDef.isActive) { // Se tiver uma função para verificar o estado
             buttonElement.classList.toggle('active', buttonDef.isActive());
          } else { // Toggle simples se não houver função de estado
             buttonElement.classList.toggle('active');
          }
      }
      this.events.emit('buttonClicked', buttonDef.id);
    });

    this.toolbarElement.appendChild(buttonElement);
  }
  
  // Permite atualizar o estado 'active' de um botão externamente
  public updateButtonActiveState(buttonId: string, isActive: boolean): void {
      const buttonElement = this.toolbarElement?.querySelector(`#${buttonId}`) as HTMLButtonElement;
      if (buttonElement) {
          buttonElement.classList.toggle('active', isActive);
      }
  }

  // Novo método para atualizar o estado 'disabled' de um botão
  public updateButtonDisabledState(buttonId: string, isDisabled: boolean): void {
      const buttonElement = this.toolbarElement?.querySelector(`#${buttonId}`) as HTMLButtonElement;
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
    this.toolbarElement?.remove();
    this.events.removeAllListeners();
    this.buttons = [];
  }
}