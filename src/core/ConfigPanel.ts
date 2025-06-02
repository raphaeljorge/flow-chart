import { EventEmitter } from 'eventemitter3';
import { Node, NodeConfig, ConfigParameter } from './types';

export class ConfigPanel {
  private container: HTMLElement;
  private events: EventEmitter;
  private currentNode: Node | null = null;
  private currentTab: string = 'basic';

  constructor(container: HTMLElement) {
    this.container = container;
    this.events = new EventEmitter();
    this.setupPanel();
  }

  private setupPanel() {
    this.container.innerHTML = `
      <div class="node-config-panel">
        <div class="node-config-header">
          <div class="node-config-icon">
            <i class="ph"></i>
          </div>
          <div class="node-config-title">
            <h2></h2>
            <p></p>
          </div>
          <button class="node-config-close">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <div class="node-config-tabs"></div>
        <div class="node-config-content"></div>
        <div class="node-config-actions">
          <button class="btn btn-primary" id="save-config">
            <i class="ph ph-check"></i>
            Apply Changes
          </button>
          <button class="btn btn-secondary" id="test-node">
            <i class="ph ph-play"></i>
            Test Node
          </button>
        </div>
      </div>
    `;

    // Setup event listeners
    const closeButton = this.container.querySelector('.node-config-close');
    closeButton?.addEventListener('click', () => this.hide());

    const saveButton = this.container.querySelector('#save-config');
    saveButton?.addEventListener('click', () => this.saveConfig());

    const testButton = this.container.querySelector('#test-node');
    testButton?.addEventListener('click', () => this.testNode());
  }

  public show(node: Node) {
    this.currentNode = node;
    this.container.querySelector('.node-config-panel')?.classList.add('visible');
    this.updatePanel();
  }

  public hide() {
    this.currentNode = null;
    this.container.querySelector('.node-config-panel')?.classList.remove('visible');
  }

  private updatePanel() {
    if (!this.currentNode) return;

    // Update header
    const icon = this.container.querySelector('.node-config-icon i');
    const title = this.container.querySelector('.node-config-title h2');
    const type = this.container.querySelector('.node-config-title p');

    if (icon) icon.className = `ph ${this.currentNode.icon || 'ph-cube'}`;
    if (title) title.textContent = this.currentNode.title;
    if (type) type.textContent = this.currentNode.type;

    // Update tabs
    this.updateTabs();

    // Update content
    this.updateContent();
  }

  private updateTabs() {
    if (!this.currentNode?.config?.tabs) return;

    const tabsContainer = this.container.querySelector('.node-config-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = this.currentNode.config.tabs.map(tab => `
      <div class="node-config-tab ${tab.id === this.currentTab ? 'active' : ''}" data-tab="${tab.id}">
        ${tab.icon ? `<i class="ph ${tab.icon}"></i>` : ''}
        ${tab.label}
      </div>
    `).join('');

    // Add tab click handlers
    tabsContainer.querySelectorAll('.node-config-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabId = (e.currentTarget as HTMLElement).dataset.tab;
        if (tabId) {
          this.currentTab = tabId;
          this.updatePanel();
        }
      });
    });
  }

  private updateContent() {
    if (!this.currentNode?.config) return;

    const content = this.container.querySelector('.node-config-content');
    if (!content) return;

    const parameters = this.currentNode.config.parameters.filter(param => {
      const tab = this.currentNode?.config?.tabs?.find(t => t.id === this.currentTab);
      return tab ? param.id.startsWith(tab.id) : true;
    });

    content.innerHTML = `
      <div class="node-config-section">
        ${parameters.map(param => this.renderParameter(param)).join('')}
      </div>
    `;

    // Add event listeners for inputs
    this.setupInputHandlers();
  }

  private renderParameter(param: ConfigParameter): string {
    const value = this.currentNode?.data?.[param.id] ?? param.defaultValue;
    
    switch (param.type) {
      case 'text':
      case 'number':
      case 'secret':
        return `
          <div class="form-group">
            <label for="${param.id}">${param.label}</label>
            <input
              type="${param.type === 'secret' ? 'password' : param.type}"
              id="${param.id}"
              value="${value || ''}"
              ${param.required ? 'required' : ''}
              ${param.validation?.min ? `min="${param.validation.min}"` : ''}
              ${param.validation?.max ? `max="${param.validation.max}"` : ''}
              ${param.validation?.pattern ? `pattern="${param.validation.pattern}"` : ''}
            >
            ${param.description ? `<div class="help">${param.description}</div>` : ''}
          </div>
        `;

      case 'boolean':
        return `
          <div class="form-group">
            <div class="checkbox-group">
              <input
                type="checkbox"
                id="${param.id}"
                ${value ? 'checked' : ''}
              >
              <label for="${param.id}">${param.label}</label>
            </div>
            ${param.description ? `<div class="help">${param.description}</div>` : ''}
          </div>
        `;

      case 'select':
        return `
          <div class="form-group">
            <label for="${param.id}">${param.label}</label>
            <select id="${param.id}" ${param.required ? 'required' : ''}>
              ${param.options?.map(option => `
                <option value="${option.value}" ${value === option.value ? 'selected' : ''}>
                  ${option.label}
                </option>
              `).join('')}
            </select>
            ${param.description ? `<div class="help">${param.description}</div>` : ''}
          </div>
        `;

      case 'code':
        return `
          <div class="form-group">
            <label for="${param.id}">${param.label}</label>
            <textarea
              id="${param.id}"
              class="code-editor"
              ${param.required ? 'required' : ''}
            >${value || ''}</textarea>
            ${param.description ? `<div class="help">${param.description}</div>` : ''}
          </div>
        `;

      case 'color':
        return `
          <div class="form-group">
            <label for="${param.id}">${param.label}</label>
            <div class="color-picker">
              <input
                type="color"
                id="${param.id}"
                value="${value || '#000000'}"
                ${param.required ? 'required' : ''}
              >
              <input
                type="text"
                value="${value || '#000000'}"
                pattern="^#[0-9A-Fa-f]{6}$"
              >
            </div>
            ${param.description ? `<div class="help">${param.description}</div>` : ''}
          </div>
        `;

      default:
        return '';
    }
  }

  private setupInputHandlers() {
    if (!this.currentNode?.config) return;

    this.currentNode.config.parameters.forEach(param => {
      const input = this.container.querySelector(`#${param.id}`);
      if (!input) return;

      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        let value: any = target.value;

        // Convert value based on type
        switch (param.type) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = target.checked;
            break;
        }

        // Validate
        const error = this.validateParameter(param, value);
        const errorElement = input.parentElement?.querySelector('.error');
        
        if (error) {
          if (!errorElement) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = error;
            input.parentElement?.appendChild(errorDiv);
          } else {
            errorElement.textContent = error;
          }
        } else {
          errorElement?.remove();
          this.updateNodeData(param.id, value);
        }
      });
    });
  }

  private validateParameter(param: ConfigParameter, value: any): string | null {
    if (param.required && (value === null || value === undefined || value === '')) {
      return 'This field is required';
    }

    if (!param.validation) return null;

    switch (param.type) {
      case 'number':
        if (param.validation.min !== undefined && value < param.validation.min) {
          return `Value must be at least ${param.validation.min}`;
        }
        if (param.validation.max !== undefined && value > param.validation.max) {
          return `Value must be at most ${param.validation.max}`;
        }
        break;

      case 'text':
      case 'secret':
        if (param.validation.pattern) {
          const regex = new RegExp(param.validation.pattern);
          if (!regex.test(value)) {
            return 'Invalid format';
          }
        }
        break;
    }

    if (param.validation.custom) {
      const result = param.validation.custom(value);
      if (typeof result === 'string') {
        return result;
      }
      if (result === false) {
        return 'Invalid value';
      }
    }

    return null;
  }

  private updateNodeData(paramId: string, value: any) {
    if (!this.currentNode) return;

    if (!this.currentNode.data) {
      this.currentNode.data = {};
    }

    this.currentNode.data[paramId] = value;
    this.currentNode.status = 'unsaved';
    this.events.emit('configChanged', this.currentNode);
  }

  private async saveConfig() {
    if (!this.currentNode) return;

    try {
      // Validate all parameters before saving
      const errors = this.validateAllParameters();
      if (errors.length > 0) {
        console.error('Validation errors:', errors);
        return;
      }

      this.currentNode.status = 'success';
      this.events.emit('configSaved', this.currentNode);
      this.hide();
    } catch (error) {
      console.error('Error saving configuration:', error);
      this.currentNode.status = 'error';
    }
  }

  private validateAllParameters(): string[] {
    if (!this.currentNode?.config) return [];

    const errors: string[] = [];
    this.currentNode.config.parameters.forEach(param => {
      const value = this.currentNode?.data?.[param.id];
      const error = this.validateParameter(param, value);
      if (error) {
        errors.push(`${param.label}: ${error}`);
      }
    });

    return errors;
  }

  private async testNode() {
    if (!this.currentNode) return;

    const testButton = this.container.querySelector('#test-node');
    if (!testButton) return;

    try {
      testButton.setAttribute('disabled', 'true');
      this.currentNode.status = 'running';
      
      // Emit test event and wait for result
      const result = await this.events.emit('testNode', this.currentNode);

      // Show test result
      const resultElement = document.createElement('div');
      resultElement.className = `test-result ${result.success ? 'success' : 'error'}`;
      resultElement.textContent = result.message;
      
      const content = this.container.querySelector('.node-config-content');
      content?.appendChild(resultElement);

      // Update node status
      this.currentNode.status = result.success ? 'success' : 'error';
    } catch (error) {
      console.error('Error testing node:', error);
      this.currentNode.status = 'error';
    } finally {
      testButton.removeAttribute('disabled');
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    this.events.on(event, callback);
  }
}