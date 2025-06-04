// src/ui/ConfigPanel.ts
import { EventEmitter } from 'eventemitter3';
import { 
    Node, StickyNote, Connection, NodeConfig, 
    ConfigParameter, ConfigTab, 
    ConfigurableItem, ConfigurableItemType, NodePort,
    NodeDataVariableParseEvent
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
  private currentRawNodeData: any = null; // Para rastrear mudanças no data do nó para parsing de variáveis

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
    // Guarda uma cópia profunda do data do nó para comparação de variáveis
    if (itemType === 'node') {
        this.currentRawNodeData = JSON.parse(JSON.stringify((item as Node).data || {}));
    } else {
        this.currentRawNodeData = null;
    }

    const config = this.getItemConfig(item, itemType);
    if (config?.tabs && config.tabs.length > 0) {
        this.currentTabId = config.tabs.find(t => t.id === this.currentTabId) ? this.currentTabId : config.tabs[0].id;
    } else if (config?.parameters.length > 0) {
        // Se não houver abas explícitas, usa 'default' ou a primeira aba definida por um parâmetro
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
    this.currentRawNodeData = null;
    this.events.emit('panelHidden', prevItem);
  }

  private getItemConfig(item: ConfigurableItem, itemType: ConfigurableItemType): NodeConfig | undefined {
    if (itemType === 'node') {
        const node = item as Node;
        // Adiciona uma aba "Ports" para gerenciar portas dinâmicas
        const nodeConfig = JSON.parse(JSON.stringify(node.config || { id: 'node-config', itemType: 'node', parameters: [] })); // Clona para não modificar o original
        
        // Garante que a aba 'Ports' exista, adicionando-a se não estiver presente
        if (!nodeConfig.tabs) nodeConfig.tabs = [];
        if (!nodeConfig.tabs.some(tab => tab.id === 'ports')) {
            nodeConfig.tabs.push({ id: 'ports', label: 'Ports', icon: 'ph-plugs' });
        }

        // Adiciona um separador e um botão para adicionar variáveis de entrada
        nodeConfig.parameters.push({
            id: 'add-input-variable-button',
            tabId: 'ports',
            type: 'button', // Um tipo de parâmetro "virtual" para renderizar botões
            label: 'Add Input Variable',
            description: 'Manually add a new input variable.',
        } as ConfigParameter);

        // Adiciona parâmetros para cada porta de entrada dinâmica
        node.dynamicInputs.forEach(port => {
            nodeConfig.parameters.push({
                id: `dynamic-input-${port.id}-name`,
                tabId: 'ports',
                type: 'text',
                label: `Input: ${port.variableName}`,
                defaultValue: port.variableName,
                description: `Variable name: ${port.variableName}`,
                // Adicione aqui uma validação para o nome da variável se desejar
            } as ConfigParameter);
            nodeConfig.parameters.push({
                id: `dynamic-input-${port.id}-hidden`,
                tabId: 'ports',
                type: 'boolean',
                label: `Hide ${port.variableName} (Input)`,
                defaultValue: port.isHidden,
            } as ConfigParameter);
            nodeConfig.parameters.push({
                id: `dynamic-input-${port.id}-delete`,
                tabId: 'ports',
                type: 'button',
                label: `Delete ${port.variableName}`,
                description: `Delete this input variable.`,
            } as ConfigParameter);
        });

        // Adiciona um separador e um botão para adicionar portas de saída
        nodeConfig.parameters.push({
            id: 'add-output-port-button',
            tabId: 'ports',
            type: 'button',
            label: 'Add Output Port',
            description: 'Manually add a new output port.',
        } as ConfigParameter);

        // Adiciona parâmetros para cada porta de saída dinâmica
        node.dynamicOutputs.forEach(port => {
            nodeConfig.parameters.push({
                id: `dynamic-output-${port.id}-name`,
                tabId: 'ports',
                type: 'text',
                label: `Output Name: ${port.name}`,
                defaultValue: port.name,
            } as ConfigParameter);
             nodeConfig.parameters.push({
                id: `dynamic-output-${port.id}-value`,
                tabId: 'ports',
                type: 'code', // Pode ser 'code' para expressões ou 'text' para valores literais
                label: `Output Value for ${port.name}`,
                defaultValue: port.outputValue || '',
                description: `Define the value returned by this output port.`,
            } as ConfigParameter);
            nodeConfig.parameters.push({
                id: `dynamic-output-${port.id}-delete`,
                tabId: 'ports',
                type: 'button',
                label: `Delete ${port.name}`,
                description: `Delete this output port.`,
            } as ConfigParameter);
        });

        return nodeConfig;
    }
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
    
    // Filtra parâmetros para a aba atual
    const parametersToRender = config.parameters.filter(param => 
        (!config.tabs || config.tabs.length === 0) || // Se não há abas, mostra tudo
        !param.tabId || // Se o parâmetro não tem tabId, mostra (ex: parâmetros globais)
        param.tabId === this.currentTabId || // Se o tabId corresponde à aba atual
        (this.currentTabId === 'default' && !param.tabId) // Para a aba 'default', se não houver tabId específico
    );

    if(parametersToRender.length === 0 && config.tabs && config.tabs.find(t => t.id === this.currentTabId)){ contentContainer.innerHTML = `<p class="config-no-params">No parameters in the '${this.currentTabId}' tab.</p>`; return; }
    
    // Renderiza cada parâmetro
    contentContainer.innerHTML = `<div class="node-config-section">${parametersToRender.map(param => this.renderParameter(param)).join('')}</div>`;
    
    // Adiciona listeners para os campos de input
    this.setupParameterChangeListeners(parametersToRender);

    // Adiciona listeners para os botões dinâmicos (Add/Delete Port)
    this.setupDynamicPortButtons(parametersToRender);
  }

  private renderParameter(param: ConfigParameter): string {
    let currentValue: any;
    if (!this.currentItem) return '';

    // Lógica de obtenção de valor para diferentes tipos de item
    if (this.currentItemType === 'stickyNote' && 'style' in this.currentItem && param.id in this.currentItem.style) {
        currentValue = (this.currentItem as StickyNote).style[param.id as keyof StickyNote['style']];
    } else if (this.currentItemType === 'node') {
        const node = this.currentItem as Node;
        // Lógica para portas dinâmicas
        if (param.id.startsWith('dynamic-input-') && param.id.endsWith('-name')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicInputs.find(p => p.id === portId)?.variableName;
        } else if (param.id.startsWith('dynamic-input-') && param.id.endsWith('-hidden')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicInputs.find(p => p.id === portId)?.isHidden;
        } else if (param.id.startsWith('dynamic-output-') && param.id.endsWith('-name')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicOutputs.find(p => p.id === portId)?.name;
        } else if (param.id.startsWith('dynamic-output-') && param.id.endsWith('-value')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicOutputs.find(p => p.id === portId)?.outputValue;
        } else { // Parâmetros de 'data' do nó
            currentValue = node.data?.[param.id];
        }
    } else if (this.currentItemType === 'connection' && this.currentItem.data) {
        currentValue = this.currentItem.data?.[param.id];
    }
    currentValue = currentValue ?? param.defaultValue; // Usa defaultValue se currentValue for undefined ou null

    let fieldHtml = '';
    const inputId = `config-param-${param.id}`;

    // NOVO: Tipo 'button' para os botões de adicionar/deletar portas
    if (param.type === 'button') {
        fieldHtml = `
            <div class="form-group">
                <button type="button" class="btn btn-secondary" id="${inputId}" data-param-id="${param.id}">
                    ${param.label}
                </button>
                ${param.description ? `<div class="help">${param.description}</div>` : ''}
            </div>
        `;
        return fieldHtml;
    }

    // Código existente para outros tipos de parâmetros
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
        default:
            fieldHtml = `<div class="form-group"><label>${param.label}</label><p>Unsupported parameter type: ${param.type}</p></div>`;
    }
    return fieldHtml;
  }

  private setupParameterChangeListeners(parameters: ConfigParameter[]): void {
    if (!this.panelElement || !this.currentItem || !this.currentItemType) return;

    parameters.filter(p => p.type !== 'button').forEach(param => { // Ignora botões aqui
      const inputId = `config-param-${param.id}`;
      const inputEl = this.panelElement?.querySelector(`#${inputId}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (inputEl) {
        const eventType = (inputEl.tagName === 'SELECT' || inputEl.type === 'checkbox' || inputEl.type === 'color') ? 'change' : 'input';
        inputEl.addEventListener(eventType, () => this.handleParameterChange(param, inputEl));
        if (inputEl.type !== 'color' && inputEl.tagName !== 'SELECT' && inputEl.type !== 'checkbox' && eventType === 'input') {
             inputEl.addEventListener('change', () => this.handleParameterChange(param, inputEl));
        }

        if(param.type === 'color') {
            const hexInput = this.panelElement?.querySelector(`[data-hex-for="${inputId}"]`) as HTMLInputElement;
            const colorInput = inputEl as HTMLInputElement;
            if(hexInput && colorInput){
                colorInput.addEventListener('input', () => hexInput.value = colorInput.value);
                hexInput.addEventListener('change', () => {
                    if (hexInput.checkValidity() && /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/i.test(hexInput.value)) {
                         colorInput.value = hexInput.value;
                         this.handleParameterChange(param, colorInput);
                    } else {
                        hexInput.value = colorInput.value; 
                    }
                });
            }
        }
      }
    });
  }

  // NOVO: Setup de listeners para os botões dinâmicos
  private setupDynamicPortButtons(parameters: ConfigParameter[]): void {
    if (!this.panelElement || !this.currentItem || this.currentItemType !== 'node') return;
    const node = this.currentItem as Node;

    // Botão "Add Input Variable"
    const addInputVarButton = this.panelElement.querySelector('#config-param-add-input-variable-button');
    if (addInputVarButton) {
        addInputVarButton.addEventListener('click', () => {
            if (this.currentItem) {
                // Pede um nome para a variável (usar um modal ou prompt mais elegante em produção)
                const varName = prompt("Enter new input variable name:");
                if (varName && varName.trim() !== '') {
                    this.nodeManager.addDynamicInputPort(node.id, varName.trim());
                    // Re-renderiza o painel para mostrar a nova porta
                    this.show(node, 'node'); 
                }
            }
        });
    }

    // Botão "Add Output Port"
    const addOutputPortButton = this.panelElement.querySelector('#config-param-add-output-port-button');
    if (addOutputPortButton) {
        addOutputPortButton.addEventListener('click', () => {
            if (this.currentItem) {
                const portName = prompt("Enter new output port name:");
                if (portName && portName.trim() !== '') {
                    this.nodeManager.addDynamicOutputPort(node.id, portName.trim());
                    this.show(node, 'node');
                }
            }
        });
    }

    // Botões de deletar portas dinâmicas
    parameters.filter(p => p.type === 'button' && (p.id.startsWith('dynamic-input-') || p.id.startsWith('dynamic-output-')) && p.id.endsWith('-delete')).forEach(param => {
        const deleteButton = this.panelElement?.querySelector(`#config-param-${param.id}`);
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                const portId = param.id.split('-')[2]; // Extract port ID from the parameter ID
                if (confirm(`Are you sure you want to delete this port?`)) {
                    this.nodeManager.removePort(portId);
                    this.show(node, 'node'); // Re-renderiza o painel
                }
            });
        }
    });
  }


  private handleParameterChange(param: ConfigParameter, inputElement: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    if (!this.currentItem || !this.currentItemType) return;
    let value: any;
    if (inputElement.type === 'checkbox') value = (inputElement as HTMLInputElement).checked;
    else if (inputElement.type === 'number') value = inputElement.value === '' ? param.defaultValue : parseFloat(inputElement.value);
    else value = inputElement.value;

    // TODO: Implementar validação completa baseada em param.validation e exibir erros no div.error
    // const errorDiv = inputElement.closest('.form-group')?.querySelector('.error');
    // const isValid = this.validateSingleParameter(param, value);
    // if (errorDiv) { errorDiv.textContent = isValid ? '' : 'Invalid value'; errorDiv.style.display = isValid ? 'none' : 'block'; }
    // if(!isValid) return;

    if (this.currentItemType === 'node') {
        const node = this.currentItem as Node;
        // Lógica de atualização para parâmetros de porta dinâmica
        if (param.id.startsWith('dynamic-input-') && param.id.endsWith('-name')) {
          const portId = param.id.split('-')[2];
          this.nodeManager.updatePort(portId, { variableName: value, name: value });
        } else if (param.id.startsWith('dynamic-input-') && param.id.endsWith('-hidden')) {
          const portId = param.id.split('-')[2];
          this.nodeManager.updatePort(portId, { isHidden: value });
          const nodeToUpdate = this.currentItem as Node;
          const portInNodeArray = nodeToUpdate.dynamicInputs.find(p => p.id === portId);
          if (portInNodeArray) {
              portInNodeArray.isHidden = value;
          }
        } else if (param.id.startsWith('dynamic-output-') && param.id.endsWith('-name')) {
          const portId = param.id.split('-')[2];
          this.nodeManager.updatePort(portId, { name: value });
      } else if (param.id.startsWith('dynamic-output-') && param.id.endsWith('-value')) {
          const portId = param.id.split('-')[2];
          this.nodeManager.updatePort(portId, { outputValue: value });
      } else {
          const oldData = JSON.parse(JSON.stringify(node.data || {}));
          node.data = node.data || {};
          node.data[param.id] = value;
          this.events.emit('nodeDataChangedWithVariables', { nodeId: node.id, oldData: oldData, newData: node.data });
      }
      this.nodeManager.updateNode(this.currentItem.id, { status: 'unsaved' });
    } else if (this.currentItemType === 'stickyNote') {
      const note = this.currentItem as StickyNote;
      const styleKey = param.id as keyof StickyNote['style'];
      if (styleKey in note.style) {
          const styleUpdates = { ...note.style, [styleKey]: value };
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
            this.events.emit('validationError', "Please correct the errors in the form.");
            return; 
        }
        if (this.currentItemType === 'node') {
            this.nodeManager.updateNode(this.currentItem.id, { status: (this.currentItem as Node).status === 'unsaved' ? undefined : 'success' });
        }
        this.events.emit('configApplied', this.currentItem);
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