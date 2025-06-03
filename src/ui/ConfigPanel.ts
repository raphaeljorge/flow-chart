// src/ui/ConfigPanel.ts
import { EventEmitter } from 'eventemitter3';
import { 
    Node, StickyNote, Connection, NodeConfig, 
    ConfigParameter, ConfigTab, 
    ConfigurableItem, ConfigurableItemType 
} from '../core/Types';
import { NodeManager } from '../core/NodeManager';
import { StickyNoteManager } from '../core/StickyNoteManager';
import { SelectionManager } from '../core/SelectionManager';
// import { IconService } from '../editor/IconService'; 

export class ConfigPanel {
  private container: HTMLElement;
  private panelElement: HTMLElement | null = null;
  private events: EventEmitter;
  
  private currentItem: ConfigurableItem | null = null;
  private currentItemType: ConfigurableItemType | null = null;
  private currentTabId: string | null = null;

  constructor(
    containerElement: HTMLElement,
    private selectionManager: SelectionManager,
    private nodeManager: NodeManager,
    private stickyNoteManager: StickyNoteManager
    // private iconService: IconService 
  ) {
    this.container = containerElement;
    this.events = new EventEmitter();
    this.createPanelElement();
    this.selectionManager.on('selectionChanged', this.handleSelectionChange);
  }

  private createPanelElement(): void {
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'node-config-panel';
    this.container.appendChild(this.panelElement);
  }
  
  private handleSelectionChange = (selectedIds: string[]): void => {
    if (selectedIds.length === 1) {
      const selectedId = selectedIds[0];
      let item: ConfigurableItem | undefined;
      let itemType: ConfigurableItemType | null = null;

      item = this.nodeManager.getNode(selectedId);
      if (item) { 
        itemType = 'node';
      } else {
        item = this.stickyNoteManager.getNote(selectedId);
        if (item) { 
          itemType = 'stickyNote'; 
        } else {
            item = this.nodeManager.getConnection(selectedId);
            if (item) { 
              itemType = 'connection'; 
            }
        }
      }

      if (item && itemType) {
        if (this.currentItem?.id !== item.id || this.currentItemType !== itemType) {
            this.show(item, itemType);
        }
      } else {
        this.hide();
      }
    } else {
      this.hide();
    }
  };

  public show(item: ConfigurableItem, itemType: ConfigurableItemType): void {
    this.currentItem = item;
    this.currentItemType = itemType;
    const config = this.getItemConfig(item, itemType);
    if (config?.tabs && config.tabs.length > 0) {
        this.currentTabId = config.tabs.find(t => t.id === this.currentTabId) ? this.currentTabId : config.tabs[0].id;
    } else if (config?.parameters.length > 0) {
        this.currentTabId = config.parameters[0]?.tabId || 'default'; 
    } else {
        this.currentTabId = null;
    }
    this.updatePanelUI();
    this.panelElement?.classList.add('visible');
    this.events.emit('panelShown', item);
  }

  public hide(): void {
    if (!this.panelElement || !this.panelElement.classList.contains('visible')) return;
    this.panelElement?.classList.remove('visible');
    const prevItem = this.currentItem;
    this.currentItem = null; this.currentItemType = null; this.currentTabId = null;
    this.events.emit('panelHidden', prevItem);
  }

  private getItemConfig(item: ConfigurableItem, itemType: ConfigurableItemType): NodeConfig | undefined {
    if (itemType === 'node') return (item as Node).config;
    if (itemType === 'stickyNote') {
      const note = item as StickyNote;
      return {
          id: 'stickyNoteStyleConfig-' + note.id, itemType: 'stickyNote',
          tabs: [{id: 'style', label: 'Style', icon: 'ph-paint-brush'}],
          parameters: [
              { id: 'backgroundColor', tabId: 'style', type: 'color', label: 'Background Color', defaultValue: note.style.backgroundColor },
              { id: 'textColor', tabId: 'style', type: 'color', label: 'Text Color', defaultValue: note.style.textColor },
              { id: 'fontSize', tabId: 'style', type: 'number', label: 'Font Size (px)', defaultValue: note.style.fontSize, validation: {min: 8, max: 72}},
          ]
      };
    }
    if (itemType === 'connection') {
        const conn = item as Connection;
        return {
            id: 'connectionConfig-' + conn.id, itemType: 'connection',
            tabs: [{id: 'general', label: 'General', icon: 'ph-link'}],
            parameters: [
                { id: 'label', tabId: 'general', type: 'text', label: 'Label', defaultValue: conn.data?.label || '' },
                { id: 'color', tabId: 'general', type: 'color', label: 'Line Color', defaultValue: conn.data?.color || '#666666' },
                // Adicionar mais parâmetros para conexões se necessário
            ]
        };
    }
    return undefined;
  }

  private updatePanelUI(): void {
    if (!this.panelElement || !this.currentItem || !this.currentItemType) {
      this.panelElement!.innerHTML = ''; return;
    }
    const itemConfig = this.getItemConfig(this.currentItem, this.currentItemType);
    let itemTitle = "Item Properties"; let itemIcon = "ph-pencil-simple"; let itemTypeLabel = this.currentItemType.charAt(0).toUpperCase() + this.currentItemType.slice(1);

    if(this.currentItemType === 'node') {
        const node = this.currentItem as Node;
        itemTitle = node.title || 'Node'; itemIcon = node.icon || 'ph-cube'; itemTypeLabel = node.type;
    } else if (this.currentItemType === 'stickyNote') {
        itemTitle = 'Sticky Note'; itemIcon = 'ph-note';
    } else if (this.currentItemType === 'connection') {
        const conn = this.currentItem as Connection;
        itemTitle = conn.data?.label || 'Connection'; itemIcon = 'ph-link';
        const sourcePort = this.nodeManager.getPort(conn.sourcePortId); const targetPort = this.nodeManager.getPort(conn.targetPortId);
        const sourceNode = sourcePort ? this.nodeManager.getNode(sourcePort.nodeId) : null;
        const targetNode = targetPort ? this.nodeManager.getNode(targetPort.nodeId) : null;
        itemTypeLabel = `From: ${sourceNode?.title||'?'}.${sourcePort?.name||'?'} To: ${targetNode?.title||'?'}.${targetPort?.name||'?'}`;
    }
    
    this.panelElement.innerHTML = `
      <div class="node-config-header">
        <div class="node-config-icon"><i class="ph ${itemIcon}"></i></div>
        <div class="node-config-title"><h2>${itemTitle}</h2><p style="white-space: pre-wrap;">${itemTypeLabel}</p></div>
        <button class="node-config-close" title="Close"><i class="ph ph-x"></i></button>
      </div>
      <div class="node-config-tabs"></div><div class="node-config-content"></div>
      <div class="node-config-actions">
        <button class="btn btn-primary" id="config-apply-changes"><i class="ph ph-check"></i> Apply Changes</button>
        ${this.currentItemType === 'node' ? `<button class="btn btn-secondary" id="config-test-node"><i class="ph ph-play"></i> Test Node</button>` : ''}
      </div>`;
    this.renderTabs(itemConfig); this.renderContent(itemConfig); this.setupActionListeners();
  }

  private renderTabs(config?: NodeConfig): void {
    const tabsContainer = this.panelElement?.querySelector('.node-config-tabs');
    if (!tabsContainer ) { if(tabsContainer) tabsContainer.innerHTML = ''; return; }
    if (!config?.tabs || config.tabs.length === 0) { tabsContainer.innerHTML = ''; return; }
    tabsContainer.innerHTML = config.tabs.map(tab => `
      <div class="node-config-tab ${tab.id === this.currentTabId ? 'active' : ''}" data-tab-id="${tab.id}">
        ${tab.icon ? `<i class="ph ${tab.icon}"></i>` : ''} ${tab.label}
      </div>`).join('');
    tabsContainer.querySelectorAll('.node-config-tab').forEach(tabElement => {
      tabElement.addEventListener('click', (e) => {
        const tabId = (e.currentTarget as HTMLElement).dataset.tabId;
        if (tabId && tabId !== this.currentTabId) { this.currentTabId = tabId; this.renderTabs(config); this.renderContent(config); }
      });
    });
  }

  private renderContent(config?: NodeConfig): void {
    const contentContainer = this.panelElement?.querySelector('.node-config-content');
    if (!contentContainer || !this.currentItem) { if(contentContainer) contentContainer.innerHTML = ''; return; }
    if (!config || config.parameters.length === 0) { contentContainer.innerHTML = '<p class="config-no-params">No configuration available.</p>'; return; }
    const parametersToRender = config.parameters.filter(param => (!config.tabs || config.tabs.length === 0) || !param.tabId || param.tabId === this.currentTabId || this.currentTabId === 'default');
    if(parametersToRender.length === 0 && config.tabs && config.tabs.find(t => t.id === this.currentTabId)){ contentContainer.innerHTML = `<p class="config-no-params">No parameters in the '${this.currentTabId}' tab.</p>`; return; }
    contentContainer.innerHTML = `<div class="node-config-section">${parametersToRender.map(param => this.renderParameter(param)).join('')}</div>`;
    this.setupParameterChangeListeners(parametersToRender);
  }

  private renderParameter(param: ConfigParameter): string {
    let currentValue: any;
    if (!this.currentItem) return '';

    // Prioriza o campo 'data' para todos os tipos de item configuráveis (Node, Connection)
    // Para StickyNote, acessa 'style' diretamente pelos IDs dos parâmetros definidos em getItemConfig
    if (this.currentItemType === 'stickyNote' && 'style' in this.currentItem && param.id in this.currentItem.style) {
        currentValue = (this.currentItem as StickyNote).style[param.id as keyof StickyNote['style']];
    } else if ('data' in this.currentItem && this.currentItem.data) { // Para Nodes e Connections
        currentValue = this.currentItem.data?.[param.id];
    }
    currentValue = currentValue ?? param.defaultValue; // Usa defaultValue se currentValue for undefined ou null

    let fieldHtml = '';
    const inputId = `config-param-${param.id}`; // Garante IDs únicos no DOM

    switch (param.type) {
        case 'text':
        case 'number':
        case 'secret':
            fieldHtml = `
            <div class="form-group">
              <label for="${inputId}">${param.label}</label>
              <input type="${param.type === 'secret' ? 'password' : param.type}" id="${inputId}" data-param-id="${param.id}" 
                     value="${currentValue ?? ''}"
                     ${param.required ? 'required' : ''}
                     ${param.validation?.min !== undefined ? `min="${param.validation.min}"` : ''}
                     ${param.validation?.max !== undefined ? `max="${param.validation.max}"` : ''}
                     ${param.validation?.pattern ? `pattern="${param.validation.pattern}"` : ''}
              >
              ${param.description ? `<div class="help">${param.description}</div>` : ''}
              <div class="error" style="display: none;"></div>
            </div>`;
            break;
        case 'boolean':
            fieldHtml = `
            <div class="form-group">
              <div class="checkbox-group">
                <input type="checkbox" id="${inputId}" data-param-id="${param.id}" ${currentValue ? 'checked' : ''}>
                <label for="${inputId}">${param.label}</label>
              </div>
              ${param.description ? `<div class="help">${param.description}</div>` : ''}
            </div>`;
            break;
        case 'select':
            fieldHtml = `
            <div class="form-group">
              <label for="${inputId}">${param.label}</label>
              <select id="${inputId}" data-param-id="${param.id}" ${param.required ? 'required' : ''}>
                ${(param.options || []).map(opt => 
                  `<option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''}>${opt.label}</option>`
                ).join('')}
              </select>
              ${param.description ? `<div class="help">${param.description}</div>` : ''}
            </div>`;
            break;
        case 'code':
            fieldHtml = `
            <div class="form-group">
              <label for="${inputId}">${param.label}</label>
              <textarea id="${inputId}" data-param-id="${param.id}" class="code-editor" 
                        ${param.required ? 'required' : ''}>${currentValue || ''}</textarea>
              ${param.description ? `<div class="help">${param.description}</div>` : ''}
            </div>`;
            break;
        case 'color':
            const colorValue = currentValue || '#000000';
            fieldHtml = `
            <div class="form-group">
              <label for="${inputId}">${param.label}</label>
              <div class="color-picker">
                <input type="color" id="${inputId}" data-param-id="${param.id}" value="${colorValue}">
                <input type="text" value="${colorValue}" data-hex-for="${inputId}" 
                       pattern="^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$" 
                       title="Hex color code (e.g., #RRGGBB)">
              </div>
              ${param.description ? `<div class="help">${param.description}</div>` : ''}
            </div>`;
            break;
        // Adicionar outros tipos aqui se necessário (multiselect, file, datetime)
        default:
            fieldHtml = `<div class="form-group"><label>${param.label}</label><p>Unsupported parameter type: ${param.type}</p></div>`;
    }
    return fieldHtml;
  }

  private setupParameterChangeListeners(parameters: ConfigParameter[]): void {
    if (!this.panelElement) return;
    parameters.forEach(param => {
      const inputId = `config-param-${param.id}`;
      const inputEl = this.panelElement?.querySelector(`#${inputId}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (inputEl) {
        const eventType = (inputEl.tagName === 'SELECT' || inputEl.type === 'checkbox' || inputEl.type === 'color') ? 'change' : 'input';
        inputEl.addEventListener(eventType, () => this.handleParameterChange(param, inputEl));
        // Para 'input' de texto, 'input' é melhor para feedback imediato, mas 'change' também é bom.
        if (inputEl.type !== 'color' && inputEl.tagName !== 'SELECT' && inputEl.type !== 'checkbox' && eventType === 'input') {
             inputEl.addEventListener('change', () => this.handleParameterChange(param, inputEl)); // Garante que 'change' também dispare
        }

        if(param.type === 'color') {
            const hexInput = this.panelElement?.querySelector(`[data-hex-for="${inputId}"]`) as HTMLInputElement;
            const colorInput = inputEl as HTMLInputElement; // Já é o input type color
            if(hexInput && colorInput){
                colorInput.addEventListener('input', () => hexInput.value = colorInput.value); // Atualiza hex quando color muda
                hexInput.addEventListener('change', () => { // Atualiza color quando hex muda (e é válido)
                    if (hexInput.checkValidity() && /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/i.test(hexInput.value)) {
                         colorInput.value = hexInput.value;
                         this.handleParameterChange(param, colorInput); // Dispara a atualização com o valor do colorInput
                    } else {
                        // Opcional: mostrar erro se o formato hex for inválido, ou reverter para o valor do colorInput
                        hexInput.value = colorInput.value; 
                    }
                });
            }
        }
      }
    });
  }

  private handleParameterChange(param: ConfigParameter, inputElement: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    if (!this.currentItem || !this.currentItemType) return;
    let value: any;
    if (inputElement.type === 'checkbox') value = (inputElement as HTMLInputElement).checked;
    else if (inputElement.type === 'number') value = inputElement.value === '' ? param.defaultValue : parseFloat(inputElement.value); // Trata campo numérico vazio
    else value = inputElement.value;

    // TODO: Implementar validação completa baseada em param.validation e exibir erros no div.error
    // const errorDiv = inputElement.closest('.form-group')?.querySelector('.error');
    // const isValid = this.validateSingleParameter(param, value);
    // if (errorDiv) { errorDiv.textContent = isValid ? '' : 'Invalid value'; errorDiv.style.display = isValid ? 'none' : 'block'; }
    // if(!isValid) return;


    if (this.currentItemType === 'node') {
        const node = this.currentItem as Node;
        node.data = node.data || {};
        node.data[param.id] = value;
        this.nodeManager.updateNode(this.currentItem.id, { data: node.data, status: 'unsaved' });
    } else if (this.currentItemType === 'stickyNote') {
        const note = this.currentItem as StickyNote;
        const styleKey = param.id as keyof StickyNote['style']; // O ID do parâmetro é a chave de estilo
        if (styleKey in note.style) {
            const styleUpdates = { ...note.style, [styleKey]: value }; // Cria um novo objeto de estilo
            this.stickyNoteManager.updateNote(this.currentItem.id, { style: styleUpdates });
        }
    } else if (this.currentItemType === 'connection') {
        const conn = this.currentItem as Connection;
        conn.data = conn.data || {};
        conn.data[param.id] = value;
        this.nodeManager.updateConnection(this.currentItem.id, { data: conn.data });
    }
    this.events.emit('configChanged', this.currentItem, param.id, value);
  }
  
  private validateAllParameters(): boolean { 
      // TODO: Iterar sobre todos os parâmetros visíveis, chamar validateSingleParameter
      // e garantir que todos são válidos antes de retornar true.
      return true; 
  }

  private setupActionListeners(): void {
      if (!this.panelElement) return;
      this.panelElement.querySelector('.node-config-close')?.addEventListener('click', () => this.hide());
      this.panelElement.querySelector('#config-apply-changes')?.addEventListener('click', () => {
        if (!this.currentItem) return; 
        if (!this.validateAllParameters()) { 
            // Notificar o usuário sobre erros de validação.
            // Poderia focar no primeiro campo inválido.
            this.events.emit('validationError', "Please correct the errors in the form.");
            return; 
        }
        if (this.currentItemType === 'node') {
            // O status 'unsaved' já foi setado durante handleParameterChange.
            // Aqui, podemos confirmar a mudança.
            this.nodeManager.updateNode(this.currentItem.id, { status: (this.currentItem as Node).status === 'unsaved' ? undefined : 'success' }); // Remove 'unsaved' ou define como 'success'
        }
        this.events.emit('configApplied', this.currentItem);
        // Opcional: this.hide();
      });
      const testButton = this.panelElement.querySelector('#config-test-node');
      if(testButton) {
        testButton.addEventListener('click', () => {
            if (this.currentItem && this.currentItemType === 'node') this.events.emit('testNode', this.currentItem as Node);
        });
      }
  }

  public on(event: string, listener: (...args: any[]) => void): this { this.events.on(event, listener); return this; }
  public off(event: string, listener: (...args: any[]) => void): this { this.events.off(event, listener); return this; }
  
  public destroy(): void { 
    this.selectionManager.off('selectionChanged', this.handleSelectionChange); 
    this.panelElement?.remove(); 
    this.events.removeAllListeners(); 
  }
}