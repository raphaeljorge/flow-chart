// src/editor/components/ConfigPanel/ConfigPanel.ts
import { EventEmitter } from 'eventemitter3';
import {
    Node, StickyNote, Connection, NodeConfig,
    ConfigParameter, ConfigTab,
    ConfigurableItem, ConfigurableItemType, NodePort,
    NodeDataVariableParseEvent
} from '../../core/types';
import { NodeManager } from '../../state/NodeManager';
import { StickyNoteManager } from '../../state/StickyNoteManager';
import { ConnectionManager } from '../../state/ConnectionManager';
import { SelectionManager } from '../../state/SelectionManager';
import { EditorIconService } from '../../services/EditorIconService';
import {
    EVENT_CONFIG_APPLIED, EVENT_NODE_TEST_REQUESTED, NODE_DEFAULT_ICON,
    EVENT_NODE_DATA_CHANGED_WITH_VARIABLES
} from '../../core/constants';
import './ConfigPanel.css'; // Co-located CSS

export class ConfigPanel {
  private container: HTMLElement; // The wrapper element for the panel
  private panelElement: HTMLElement | null = null; // The main panel div created by this component
  private events: EventEmitter;

  private currentItem: ConfigurableItem | null = null;
  private currentItemType: ConfigurableItemType | null = null;
  private currentTabId: string | null = null;
  // private currentRawNodeData: any = null; // Not needed if updateNodeDataAndParseVariables is robust

  constructor(
    containerElement: HTMLElement,
    private selectionManager: SelectionManager,
    private nodeManager: NodeManager,
    private connectionManager: ConnectionManager, // Added
    private stickyNoteManager: StickyNoteManager,
    private iconService: EditorIconService
  ) {
    this.container = containerElement; // This is the .config-panel-wrapper
    this.events = new EventEmitter();
    // Panel element will be created/destroyed by show/hide, or managed internally
    this.selectionManager.on('selectionChanged', this.handleSelectionChange);
  }

  private createPanelElement(): void {
    if (this.panelElement) this.panelElement.remove(); // Clean up old one if exists

    this.panelElement = document.createElement('div');
    this.panelElement.className = 'config-panel'; // Main class for styling
    this.container.appendChild(this.panelElement);
    this.container.classList.add('visible'); // Make the wrapper visible
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
          item = this.connectionManager.getConnection(selectedId);
          if (item) {
            itemType = 'connection';
          }
        }
      }

      if (item && itemType) {
        // Show panel if item changed or panel was hidden
        if (this.currentItem?.id !== item.id || this.currentItemType !== itemType || !this.panelElement || this.container.style.display === 'none') {
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

    this.createPanelElement(); // Ensures panel is fresh and appended

    const config = this.getItemConfig(item, itemType);
    // Determine initial tab
    if (config?.tabs && config.tabs.length > 0) {
        const firstValidTab = config.tabs.find(t => {
            // A tab is valid if it's the current one, or if it has parameters assigned to it
            return t.id === this.currentTabId || (config.parameters && config.parameters.some(p => p.tabId === t.id));
        });
        this.currentTabId = firstValidTab ? firstValidTab.id : config.tabs[0].id;
    } else if (config?.parameters && config.parameters.length > 0) {
        this.currentTabId = config.parameters[0]?.tabId || 'default';
    } else {
        this.currentTabId = 'default'; // Fallback to a default tab name if no tabs/params
    }

    this.updatePanelUI(config); // Pass config to avoid re-calculating
    // this.panelElement?.classList.add('visible'); // Visibility handled by wrapper
    this.events.emit('panelShown', item);
  }

  public hide(): void {
    if (!this.panelElement) return; // Already hidden or not initialized

    this.container.classList.remove('visible'); // Hide the wrapper
    this.panelElement.remove(); // Remove the panel content
    this.panelElement = null;

    const prevItem = this.currentItem;
    this.currentItem = null;
    this.currentItemType = null;
    this.currentTabId = null;
    this.events.emit('panelHidden', prevItem);
  }

  private getItemConfig(item: ConfigurableItem, itemType: ConfigurableItemType): NodeConfig | undefined {
    if (itemType === 'node') {
        const node = item as Node;
        // Start with a deep clone of the node's type definition config, or a base if none
        const baseConfig = node.config ? JSON.parse(JSON.stringify(node.config)) : { id: `node-cfg-${node.id}`, itemType: 'node', parameters: [], tabs: [] };

        // Ensure 'Ports' tab exists or create it
        if (!baseConfig.tabs) baseConfig.tabs = [];
        let portsTab = baseConfig.tabs.find((t: ConfigTab) => t.id === 'ports');
        if (!portsTab) {
            portsTab = { id: 'ports', label: 'Ports', icon: 'ph-plugs' };
            baseConfig.tabs.push(portsTab);
        }
        
        // Parameters for fixed inputs (mainly for info or minor adjustments if ever needed)
        // node.fixedInputs.forEach(port => { /* ... potentially add display for fixed ports ... */ });

        // Parameters for dynamic inputs
        baseConfig.parameters.push({
            id: `add-input-variable-button-${node.id}`, tabId: 'ports', type: 'button', label: 'Add Input Variable'
        } as ConfigParameter);
        node.dynamicInputs.forEach(port => {
            baseConfig.parameters.push({
                id: `dyn-in-${port.id}-name`, tabId: 'ports', type: 'text', label: `Input: ${port.variableName || port.name}`,
                defaultValue: port.variableName || port.name, description: `Variable: ${port.variableName}`
            } as ConfigParameter);
            baseConfig.parameters.push({
                id: `dyn-in-${port.id}-hidden`, tabId: 'ports', type: 'boolean', label: `Hide '${port.variableName || port.name}'`,
                defaultValue: !!port.isHidden
            } as ConfigParameter);
            baseConfig.parameters.push({
                 id: `dyn-in-${port.id}-delete`, tabId: 'ports', type: 'button', label: `Delete '${port.variableName || port.name}'`,
                 description: `Delete this input variable.`
            } as ConfigParameter);
        });

        // Parameters for dynamic outputs
        baseConfig.parameters.push({
            id: `add-output-port-button-${node.id}`, tabId: 'ports', type: 'button', label: 'Add Output Port'
        } as ConfigParameter);
        node.dynamicOutputs.forEach(port => {
            baseConfig.parameters.push({
                id: `dyn-out-${port.id}-name`, tabId: 'ports', type: 'text', label: `Output: ${port.name}`,
                defaultValue: port.name
            } as ConfigParameter);
            baseConfig.parameters.push({
                id: `dyn-out-${port.id}-value`, tabId: 'ports', type: 'code', label: `Value for '${port.name}'`,
                defaultValue: port.outputValue || '', description: `Define the value for this output.`
            } as ConfigParameter);
            baseConfig.parameters.push({
                 id: `dyn-out-${port.id}-delete`, tabId: 'ports', type: 'button', label: `Delete '${port.name}'`,
                 description: `Delete this output port.`
            } as ConfigParameter);
        });

        return baseConfig;
    }
    if (itemType === 'stickyNote') {
      const note = item as StickyNote;
      return {
          id: `stickyNote-cfg-${note.id}`, itemType: 'stickyNote',
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
        // Connections might not have a predefined config, so create one dynamically
        return {
            id: `conn-cfg-${conn.id}`, itemType: 'connection',
            tabs: [{id: 'general', label: 'General', icon: 'ph-link'}],
            parameters: [
                { id: 'label', tabId: 'general', type: 'text', label: 'Label', defaultValue: conn.data?.label || '' },
                { id: 'color', tabId: 'general', type: 'color', label: 'Line Color', defaultValue: conn.data?.color || '#666666' },
            ]
        };
    }
    return undefined;
  }

  private updatePanelUI(config?: NodeConfig): void {
    if (!this.panelElement || !this.currentItem || !this.currentItemType) {
      if(this.panelElement) this.panelElement.innerHTML = ''; return;
    }
    // Config is now passed, so no need to call getItemConfig again unless it's undefined
    const itemConfig = config || this.getItemConfig(this.currentItem, this.currentItemType);

    let itemTitle = "Item Properties";
    let itemIconName = NODE_DEFAULT_ICON; // Default icon
    let itemTypeLabel = this.currentItemType.charAt(0).toUpperCase() + this.currentItemType.slice(1);

    if(this.currentItemType === 'node') {
        const node = this.currentItem as Node;
        itemTitle = node.title || 'Node';
        itemIconName = node.icon || NODE_DEFAULT_ICON;
        itemTypeLabel = node.type; // This should be the NodeDefinition.id or a user-friendly type name
    } else if (this.currentItemType === 'stickyNote') {
        itemTitle = 'Sticky Note'; itemIconName = 'ph-note';
    } else if (this.currentItemType === 'connection') {
        const conn = this.currentItem as Connection;
        itemTitle = conn.data?.label || 'Connection'; itemIconName = 'ph-link';
        const sourcePort = this.nodeManager.getPort(conn.sourcePortId);
        const targetPort = this.nodeManager.getPort(conn.targetPortId);
        const sourceNode = sourcePort ? this.nodeManager.getNode(sourcePort.nodeId) : null;
        const targetNode = targetPort ? this.nodeManager.getNode(targetPort.nodeId) : null;
        itemTypeLabel = `From: ${sourceNode?.title||'?'}.${sourcePort?.name||'?'} To: ${targetNode?.title||'?'}.${targetPort?.name||'?'}`;
    }

    const itemIconHTML = this.iconService.getIconHTMLString(itemIconName);

    this.panelElement.innerHTML = `
      <div class="config-panel-header">
        <div class="config-panel-icon">${itemIconHTML}</div>
        <div class="config-panel-title">
            <h2>${itemTitle}</h2>
            <p>${itemTypeLabel}</p>
        </div>
        <button class="config-panel-close" title="Close Panel">${this.iconService.getIconHTMLString('ph-x')}</button>
      </div>
      <div class="config-panel-tabs"></div>
      <div class="config-panel-content"></div>
      <div class="config-panel-actions">
        <button class="btn btn-primary" id="config-apply-changes">${this.iconService.getIconHTMLString('ph-check')} Apply</button>
        ${this.currentItemType === 'node' ? `<button class="btn btn-secondary" id="config-test-node">${this.iconService.getIconHTMLString('ph-play')} Test</button>` : ''}
      </div>`;

    this.renderTabs(itemConfig);
    this.renderContent(itemConfig);
    this.setupActionListeners();
  }

  private renderTabs(config?: NodeConfig): void {
    const tabsContainer = this.panelElement?.querySelector('.config-panel-tabs');
    if (!tabsContainer) return;
    if (!config?.tabs || config.tabs.length === 0) { tabsContainer.innerHTML = ''; return; }

    tabsContainer.innerHTML = config.tabs.map(tab => `
      <div class="config-tab ${tab.id === this.currentTabId ? 'active' : ''}" data-tab-id="${tab.id}" title="${tab.label}">
        ${tab.icon ? this.iconService.getIconHTMLString(tab.icon) : ''}
        <span>${tab.label}</span>
      </div>`).join('');

    tabsContainer.querySelectorAll('.config-tab').forEach(tabElement => {
      tabElement.addEventListener('click', (e) => {
        const tabId = (e.currentTarget as HTMLElement).dataset.tabId;
        if (tabId && tabId !== this.currentTabId) {
            this.currentTabId = tabId;
            // Re-render tabs and content with the original config
            const currentItemConfig = this.getItemConfig(this.currentItem!, this.currentItemType!);
            this.renderTabs(currentItemConfig);
            this.renderContent(currentItemConfig);
        }
      });
    });
  }

  private renderContent(config?: NodeConfig): void {
    const contentContainer = this.panelElement?.querySelector('.config-panel-content');
    if (!contentContainer || !this.currentItem) {
        if(contentContainer) contentContainer.innerHTML = ''; return;
    }
    if (!config || !config.parameters || config.parameters.length === 0) {
        contentContainer.innerHTML = '<p class="config-no-params">No configuration parameters available for this item.</p>';
        return;
    }

    const parametersToRender = config.parameters.filter(param =>
        !param.tabId || param.tabId === this.currentTabId || (this.currentTabId === 'default' && !config.tabs?.length)
    );

    if (parametersToRender.length === 0 && config.tabs && config.tabs.find(t => t.id === this.currentTabId)) {
        contentContainer.innerHTML = `<p class="config-no-params">No parameters in the '${this.currentTabId}' tab.</p>`;
        return;
    }
     if (parametersToRender.length === 0 && (!config.tabs || config.tabs.length === 0)) {
        contentContainer.innerHTML = '<p class="config-no-params">No configuration parameters available.</p>';
        return;
    }


    contentContainer.innerHTML = `<div class="config-section">${parametersToRender.map(param => this.renderParameter(param)).join('')}</div>`;
    this.setupParameterChangeListeners(parametersToRender);
    if (this.currentItemType === 'node') {
        this.setupDynamicPortButtons(parametersToRender, this.currentItem as Node);
    }
  }

  private renderParameter(param: ConfigParameter): string {
    if (!this.currentItem) return '';
    let currentValue: any;

    if (this.currentItemType === 'node') {
        const node = this.currentItem as Node;
        // Dynamic port parameters are identified by prefixes like 'dyn-in-' or 'dyn-out-'
        if (param.id.startsWith('dyn-in-') && param.id.includes('-name')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicInputs.find(p => p.id === portId)?.variableName;
        } else if (param.id.startsWith('dyn-in-') && param.id.includes('-hidden')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicInputs.find(p => p.id === portId)?.isHidden;
        } else if (param.id.startsWith('dyn-out-') && param.id.includes('-name')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicOutputs.find(p => p.id === portId)?.name;
        } else if (param.id.startsWith('dyn-out-') && param.id.includes('-value')) {
            const portId = param.id.split('-')[2];
            currentValue = node.dynamicOutputs.find(p => p.id === portId)?.outputValue;
        } else { // Standard node data parameter
            currentValue = node.data?.[param.id];
        }
    } else if (this.currentItemType === 'stickyNote' && 'style' in this.currentItem && param.id in this.currentItem.style) {
        currentValue = (this.currentItem as StickyNote).style[param.id as keyof StickyNote['style']];
    } else if (this.currentItemType === 'connection' && this.currentItem.data) {
        currentValue = (this.currentItem as Connection).data?.[param.id];
    }

    currentValue = currentValue ?? param.defaultValue;
    const inputId = `config-param-${this.currentItem.id}-${param.id}`; // Ensure unique IDs across items

    let fieldHtml = `<div class="form-group" data-param-id="${param.id}">`; // Add data-param-id to group for easier selection
    fieldHtml += `<label for="${inputId}">${param.label}</label>`;

    switch (param.type) {
        case 'text': case 'number': case 'secret':
            fieldHtml += `<input type="${param.type === 'secret' ? 'password' : param.type}" id="${inputId}" value="${currentValue ?? ''}"
                         ${param.required ? 'required' : ''}
                         ${param.validation?.min !== undefined ? `min="${param.validation.min}"` : ''}
                         ${param.validation?.max !== undefined ? `max="${param.validation.max}"` : ''}
                         ${param.validation?.pattern ? `pattern="${param.validation.pattern}"` : ''}
                         class="config-input">`;
            break;
        case 'boolean':
            fieldHtml += `<div class="checkbox-group"><input type="checkbox" id="${inputId}" ${currentValue ? 'checked' : ''} class="config-input"></div>`;
            break;
        case 'select':
            fieldHtml += `<select id="${inputId}" ${param.required ? 'required' : ''} class="config-input">`;
            (param.options || []).forEach(opt => {
                fieldHtml += `<option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''}>${opt.label}</option>`;
            });
            fieldHtml += `</select>`;
            break;
        case 'code':
            fieldHtml += `<textarea id="${inputId}" class="code-editor config-input" ${param.required ? 'required' : ''}>${currentValue || ''}</textarea>`;
            break;
        case 'color':
            const colorVal = currentValue || '#000000';
            fieldHtml += `<div class="color-picker">
                            <input type="color" id="${inputId}" value="${colorVal}" class="config-input-color">
                            <input type="text" value="${colorVal}" data-hex-for="${inputId}" class="config-input-hex"
                                   pattern="^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$" title="Hex color code">
                          </div>`;
            break;
        case 'button':
             fieldHtml += `<button type="button" class="btn btn-secondary config-button" id="${inputId}">${param.label}</button>`;
             break;
        default:
            fieldHtml += `<p>Unsupported parameter type: ${param.type}</p>`;
    }
    if (param.description) fieldHtml += `<div class="help">${param.description}</div>`;
    fieldHtml += `<div class="error" style="display: none;"></div></div>`; // Error display div
    return fieldHtml;
  }

  private setupParameterChangeListeners(parameters: ConfigParameter[]): void {
    if (!this.panelElement || !this.currentItem) return;

    parameters.filter(p => p.type !== 'button').forEach(param => {
      const inputId = `config-param-${this.currentItem!.id}-${param.id}`;
      const inputEl = this.panelElement?.querySelector(`#${inputId}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      if (inputEl) {
        const eventType = (inputEl.tagName === 'SELECT' || inputEl.type === 'checkbox' || inputEl.classList.contains('config-input-color')) ? 'change' : 'input';
        inputEl.addEventListener(eventType, () => this.handleParameterChange(param, inputEl));

        // For text/number inputs, also listen to 'change' for when focus is lost (e.g. after typing and tabbing out)
        if (inputEl.type === 'text' || inputEl.type === 'number' || inputEl.tagName === 'TEXTAREA') {
             inputEl.addEventListener('change', () => this.handleParameterChange(param, inputEl, true)); // Pass 'finalChange' true
        }
        // Stop propagation for input field events to prevent global shortcuts
        inputEl.addEventListener('keydown', (e) => e.stopPropagation());


        if(param.type === 'color') {
            const colorInput = this.panelElement?.querySelector(`#${inputId}.config-input-color`) as HTMLInputElement;
            const hexInput = this.panelElement?.querySelector(`[data-hex-for="${inputId}"].config-input-hex`) as HTMLInputElement;
            if(hexInput && colorInput){
                colorInput.addEventListener('input', () => { hexInput.value = colorInput.value; this.handleParameterChange(param, colorInput); });
                hexInput.addEventListener('change', () => {
                    if (hexInput.checkValidity() && /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/i.test(hexInput.value)) {
                         colorInput.value = hexInput.value; this.handleParameterChange(param, colorInput, true);
                    } else { hexInput.value = colorInput.value; /* Revert if invalid */ }
                });
            }
        }
      }
    });
  }

  private setupDynamicPortButtons(parameters: ConfigParameter[], node: Node): void {
    if (!this.panelElement) return;

    parameters.filter(p => p.type === 'button').forEach(param => {
        const buttonId = `config-param-${node.id}-${param.id}`;
        const buttonEl = this.panelElement!.querySelector(`#${buttonId}`) as HTMLButtonElement;
        if (!buttonEl) return;

        if (param.id === `add-input-variable-button-${node.id}`) {
            buttonEl.addEventListener('click', () => {
                const varName = prompt("Enter new input variable name (e.g., my_input):");
                if (varName && varName.trim() !== '') {
                    this.nodeManager.addDynamicInputPort(node.id, varName.trim());
                    this.refreshPanelForCurrentItem();
                }
            });
        } else if (param.id === `add-output-port-button-${node.id}`) {
            buttonEl.addEventListener('click', () => {
                const portName = prompt("Enter new output port name (e.g., success_output):");
                if (portName && portName.trim() !== '') {
                    this.nodeManager.addDynamicOutputPort(node.id, portName.trim());
                    this.refreshPanelForCurrentItem();
                }
            });
        } else if (param.id.startsWith('dyn-in-') && param.id.endsWith('-delete')) {
            const portId = param.id.split('-')[2];
            buttonEl.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete this input port?`)) {
                    this.nodeManager.removePort(portId);
                    this.refreshPanelForCurrentItem();
                }
            });
        } else if (param.id.startsWith('dyn-out-') && param.id.endsWith('-delete')) {
            const portId = param.id.split('-')[2];
            buttonEl.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete this output port?`)) {
                    this.nodeManager.removePort(portId);
                    this.refreshPanelForCurrentItem();
                }
            });
        }
    });
  }

  private handleParameterChange(param: ConfigParameter, inputElement: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, finalChange: boolean = false): void {
    if (!this.currentItem || !this.currentItemType) return;
    let value: any;
    if (inputElement.type === 'checkbox') value = (inputElement as HTMLInputElement).checked;
    else if (inputElement.type === 'number') value = inputElement.value === '' ? null : parseFloat(inputElement.value); // Allow empty to be null
    else value = inputElement.value;

    // Basic Validation (can be expanded)
    const formGroup = inputElement.closest('.form-group') as HTMLElement;
    const errorDiv = formGroup?.querySelector('.error') as HTMLElement;
    let isValid = true;
    let errorMessage = '';

    if (param.required && (value === null || value === undefined || value === '')) {
        isValid = false;
        errorMessage = `${param.label} is required.`;
    }
    if (isValid && param.validation) {
        if (param.validation.min !== undefined && typeof value === 'number' && value < param.validation.min) {
            isValid = false; errorMessage = `${param.label} must be at least ${param.validation.min}.`;
        }
        if (param.validation.max !== undefined && typeof value === 'number' && value > param.validation.max) {
            isValid = false; errorMessage = `${param.label} must be at most ${param.validation.max}.`;
        }
        if (param.validation.pattern && typeof value === 'string' && !new RegExp(param.validation.pattern).test(value)) {
            isValid = false; errorMessage = `${param.label} is not in the correct format.`;
        }
        if (param.validation.custom) {
            const customValidationResult = param.validation.custom(value, this.currentItem.data);
            if (typeof customValidationResult === 'string') {
                isValid = false; errorMessage = customValidationResult;
            } else if (customValidationResult === false) {
                isValid = false; errorMessage = `Invalid value for ${param.label}.`;
            }
        }
    }

    if (formGroup && errorDiv) {
        errorDiv.textContent = isValid ? '' : errorMessage;
        errorDiv.style.display = isValid ? 'none' : 'block';
        formGroup.classList.toggle('has-error', !isValid);
    }
    // Do not proceed with update if not valid and it's a final change (e.g., blur)
    // Allow intermediate invalid states for 'input' events for better UX
    if (!isValid && finalChange) return;


    // Update logic
    if (this.currentItemType === 'node') {
        const node = this.currentItem as Node;
        const oldNodeData = JSON.parse(JSON.stringify(node.data || {})); // For variable parsing

        if (param.id.startsWith('dyn-in-')) {
            const portId = param.id.split('-')[2];
            if (param.id.endsWith('-name')) this.nodeManager.updatePort(portId, { variableName: value as string, name: value as string });
            else if (param.id.endsWith('-hidden')) this.nodeManager.updatePort(portId, { isHidden: value as boolean });
        } else if (param.id.startsWith('dyn-out-')) {
            const portId = param.id.split('-')[2];
            if (param.id.endsWith('-name')) this.nodeManager.updatePort(portId, { name: value as string });
            else if (param.id.endsWith('-value')) this.nodeManager.updatePort(portId, { outputValue: value as string });
        } else { // Standard node data
            const newData = { ...node.data, [param.id]: value };
            // If it's a final change or param type suggests immediate parsing (e.g. code editor blur)
            // We trigger the full variable parsing and data update
            if(finalChange || param.type === 'code'){
                 this.nodeManager.updateNodeDataAndParseVariables(node.id, newData, oldNodeData);
            } else {
                // For intermediate changes (e.g. typing in a text field), just update the data silently
                // The full parse happens on "Apply" or when `finalChange` is true.
                node.data = newData; // Direct update for live typing, full parse on apply/blur
            }
        }
        this.nodeManager.updateNode(node.id, { status: 'unsaved' }); // Mark as unsaved on any change
    } else if (this.currentItemType === 'stickyNote') {
      const note = this.currentItem as StickyNote;
      const styleKey = param.id as keyof StickyNote['style'];
      if (styleKey in note.style) {
          this.stickyNoteManager.updateNoteStyle(note.id, { [styleKey]: value });
      }
    } else if (this.currentItemType === 'connection') {
        this.connectionManager.updateConnectionData(this.currentItem.id, { [param.id]: value });
    }
    this.events.emit('configChanged', this.currentItem, param.id, value);
  }

  private validateAllParameters(): boolean {
    if (!this.panelElement || !this.currentItem) return true; // No form to validate

    const itemConfig = this.getItemConfig(this.currentItem, this.currentItemType);
    if (!itemConfig || !itemConfig.parameters) return true;

    let allValid = true;
    itemConfig.parameters.forEach(param => {
        if (param.type === 'button') return; // Skip buttons

        const inputId = `config-param-${this.currentItem!.id}-${param.id}`;
        const inputEl = this.panelElement!.querySelector(`#${inputId}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (inputEl) {
            // Trigger a "finalChange" validation for each input
            this.handleParameterChange(param, inputEl, true);
            const formGroup = inputEl.closest('.form-group') as HTMLElement;
            if (formGroup && formGroup.classList.contains('has-error')) {
                allValid = false;
            }
        }
    });
    return allValid;
  }


  private setupActionListeners(): void {
      if (!this.panelElement) return;
      this.panelElement.querySelector('.config-panel-close')?.addEventListener('click', () => this.hide());

      this.panelElement.querySelector('#config-apply-changes')?.addEventListener('click', () => {
        if (!this.currentItem) return;
        if (!this.validateAllParameters()) {
            this.events.emit('validationError', "Please correct the errors in the form.");
            // Find first error and focus it
            const firstErrorGroup = this.panelElement?.querySelector('.form-group.has-error input, .form-group.has-error textarea, .form-group.has-error select') as HTMLElement;
            firstErrorGroup?.focus();
            return;
        }

        // If the item is a node, and data has changed, ensure variables are parsed
        if (this.currentItemType === 'node') {
            const node = this.currentItem as Node;
            // This assumes that individual param changes might not have triggered full parsing
            // if they weren't 'finalChange'. Applying forces this.
            // A snapshot of data *before* this apply button might be complex if not tracked per change.
            // For simplicity, we assume current node.data is the 'newData'
            // and we'd need a way to get the 'oldData' just before this 'apply' if it changed.
            // The most robust way is that `handleParameterChange` *always* updates a temporary
            // data object, and *this* apply function then calls the full parse and update.
            // For now, let's assume node.data is the state *after* live edits.
            // To properly parse variables on "Apply", we need to know the state *before* any live edits in the panel.
            // This is tricky. A simpler approach: `handleParameterChange` (especially for text/code)
            // queues a "dirty data" state, and Apply uses that.
            // Or, the `NodeManager.updateNodeDataAndParseVariables` is called on blur/finalChange of text/code fields.
            // For now, let's assume the live changes to node.data in handleParameterChange are sufficient,
            // and the main purpose of "Apply" is to confirm these and potentially change status.
            this.nodeManager.updateNode(node.id, { status: (node.status === 'unsaved' || node.status === undefined) ? 'success' : node.status }); // Revert to success or keep existing if not unsaved
        }
        this.events.emit(EVENT_CONFIG_APPLIED, this.currentItem);
        // Optionally hide panel on apply: this.hide();
      });

      const testButton = this.panelElement.querySelector('#config-test-node');
      if(testButton) {
        testButton.addEventListener('click', () => {
            if (this.currentItem && this.currentItemType === 'node') {
                this.events.emit(EVENT_NODE_TEST_REQUESTED, this.currentItem as Node);
            }
        });
      }
  }

  private refreshPanelForCurrentItem(): void {
      if (this.currentItem && this.currentItemType) {
          // Re-fetch or re-build the config for the current item and re-render UI
          const config = this.getItemConfig(this.currentItem, this.currentItemType);
          this.updatePanelUI(config); // This will re-render tabs and content
      }
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }
  public off(event: string, listener: (...args: any[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  public destroy(): void {
    this.selectionManager.off('selectionChanged', this.handleSelectionChange);
    this.hide(); // Clean up panel element and wrapper visibility
    this.events.removeAllListeners();
  }
}