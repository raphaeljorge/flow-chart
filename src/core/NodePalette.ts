import { EventEmitter } from 'eventemitter3';
import { Canvas } from './Canvas';
import { NodeManager } from './NodeManager';
import { NodeDefinition, NodeConfig } from './types';

export class NodePalette {
  private container: HTMLElement;
  private nodeManager: NodeManager;
  private canvas: Canvas;
  private nodes: NodeDefinition[] = [];
  private favorites: Set<string> = new Set();
  private currentCategory: string = 'All';
  private searchTerm: string = '';

  constructor(container: HTMLElement, nodeManager: NodeManager, canvas: Canvas) {
    this.container = container;
    this.nodeManager = nodeManager;
    this.canvas = canvas;
    
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('nodeFavorites');
    if (savedFavorites) {
      this.favorites = new Set(JSON.parse(savedFavorites));
    }
  }

  public initialize() {
    // Initialize default node types with their configurations
    this.nodes = [
      {
        id: 'sticky-note',
        title: 'Sticky Note',
        description: 'Add notes and documentation',
        category: 'Annotations',
        icon: 'ph-note',
        config: {
          id: 'sticky-note-config',
          nodeType: 'sticky-note',
          tabs: [
            { id: 'style', label: 'Style', icon: 'ph-paint-brush' }
          ],
          parameters: [
            {
              id: 'style-backgroundColor',
              type: 'color',
              label: 'Background Color',
              defaultValue: '#2a2a2a'
            },
            {
              id: 'style-textColor',
              type: 'color',
              label: 'Text Color',
              defaultValue: '#ffffff'
            },
            {
              id: 'style-fontSize',
              type: 'number',
              label: 'Font Size',
              defaultValue: 14,
              validation: { min: 10, max: 24 }
            }
          ]
        }
      },
      {
        id: 'trigger-webhook',
        title: 'Webhook Trigger',
        description: 'Triggers when a webhook is received',
        category: 'Triggers',
        icon: 'ph-globe',
        config: {
          id: 'webhook-config',
          nodeType: 'trigger-webhook',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' },
            { id: 'advanced', label: 'Advanced', icon: 'ph-sliders' },
            { id: 'security', label: 'Security', icon: 'ph-lock' }
          ],
          parameters: [
            {
              id: 'basic-path',
              type: 'text',
              label: 'Webhook Path',
              description: 'The URL path to receive webhooks (e.g., /my-webhook)',
              required: true,
              validation: { pattern: '^/[a-zA-Z0-9-_/]*$' }
            },
            {
              id: 'basic-method',
              type: 'select',
              label: 'HTTP Method',
              options: [
                { label: 'POST', value: 'post' },
                { label: 'GET', value: 'get' },
                { label: 'PUT', value: 'put' },
                { label: 'DELETE', value: 'delete' }
              ],
              defaultValue: 'post'
            },
            {
              id: 'security-secret',
              type: 'secret',
              label: 'Webhook Secret',
              description: 'Secret token to validate webhook requests'
            },
            {
              id: 'advanced-timeout',
              type: 'number',
              label: 'Timeout (seconds)',
              defaultValue: 30,
              validation: { min: 1, max: 300 }
            }
          ]
        }
      },
      {
        id: 'trigger-schedule',
        title: 'Schedule',
        description: 'Triggers at specified intervals',
        category: 'Triggers',
        icon: 'ph-clock',
        config: {
          id: 'schedule-config',
          nodeType: 'trigger-schedule',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' },
            { id: 'advanced', label: 'Advanced', icon: 'ph-sliders' }
          ],
          parameters: [
            {
              id: 'basic-cron',
              type: 'text',
              label: 'Cron Expression',
              description: 'Schedule using cron syntax (e.g., */5 * * * *)',
              required: true
            },
            {
              id: 'basic-timezone',
              type: 'select',
              label: 'Timezone',
              options: [
                { label: 'UTC', value: 'UTC' },
                { label: 'Local', value: 'local' }
              ],
              defaultValue: 'UTC'
            },
            {
              id: 'advanced-retry',
              type: 'boolean',
              label: 'Enable automatic retry',
              defaultValue: true
            }
          ]
        }
      },
      {
        id: 'action-http',
        title: 'HTTP Request',
        description: 'Make HTTP requests to external services',
        category: 'Actions',
        icon: 'ph-arrows-in-line-horizontal',
        config: {
          id: 'http-config',
          nodeType: 'action-http',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' },
            { id: 'headers', label: 'Headers', icon: 'ph-list' },
            { id: 'auth', label: 'Authentication', icon: 'ph-key' }
          ],
          parameters: [
            {
              id: 'basic-url',
              type: 'text',
              label: 'URL',
              description: 'The URL to send the request to',
              required: true,
              validation: { pattern: '^https?://.+' }
            },
            {
              id: 'basic-method',
              type: 'select',
              label: 'Method',
              options: [
                { label: 'GET', value: 'get' },
                { label: 'POST', value: 'post' },
                { label: 'PUT', value: 'put' },
                { label: 'DELETE', value: 'delete' }
              ],
              defaultValue: 'get'
            },
            {
              id: 'headers-custom',
              type: 'code',
              label: 'Custom Headers',
              description: 'Add custom headers in JSON format'
            },
            {
              id: 'auth-type',
              type: 'select',
              label: 'Authentication Type',
              options: [
                { label: 'None', value: 'none' },
                { label: 'Basic Auth', value: 'basic' },
                { label: 'Bearer Token', value: 'bearer' }
              ]
            }
          ]
        }
      },
      {
        id: 'action-email',
        title: 'Send Email',
        description: 'Send emails using SMTP',
        category: 'Actions',
        icon: 'ph-envelope',
        config: {
          id: 'email-config',
          nodeType: 'action-email',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' },
            { id: 'smtp', label: 'SMTP', icon: 'ph-server' },
            { id: 'template', label: 'Template', icon: 'ph-file-text' }
          ],
          parameters: [
            {
              id: 'basic-to',
              type: 'text',
              label: 'To',
              description: 'Recipient email address',
              required: true,
              validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' }
            },
            {
              id: 'basic-subject',
              type: 'text',
              label: 'Subject',
              required: true
            },
            {
              id: 'template-body',
              type: 'code',
              label: 'Email Body',
              description: 'Supports HTML and template variables'
            },
            {
              id: 'smtp-host',
              type: 'text',
              label: 'SMTP Host'
            },
            {
              id: 'smtp-port',
              type: 'number',
              label: 'SMTP Port',
              defaultValue: 587
            }
          ]
        }
      },
      {
        id: 'logic-branch',
        title: 'Branch',
        description: 'Conditional branching logic',
        category: 'Logic',
        icon: 'ph-git-fork',
        config: {
          id: 'branch-config',
          nodeType: 'logic-branch',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' }
          ],
          parameters: [
            {
              id: 'basic-condition',
              type: 'code',
              label: 'Condition',
              description: 'JavaScript expression that evaluates to true/false',
              required: true
            },
            {
              id: 'basic-fallback',
              type: 'boolean',
              label: 'Enable fallback path',
              description: 'Create an additional output for when condition is false',
              defaultValue: true
            }
          ]
        }
      },
      {
        id: 'logic-loop',
        title: 'Loop',
        description: 'Iterate over a collection',
        category: 'Logic',
        icon: 'ph-repeat',
        config: {
          id: 'loop-config',
          nodeType: 'logic-loop',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' },
            { id: 'advanced', label: 'Advanced', icon: 'ph-sliders' }
          ],
          parameters: [
            {
              id: 'basic-collection',
              type: 'code',
              label: 'Collection',
              description: 'Array or object to iterate over',
              required: true
            },
            {
              id: 'advanced-parallel',
              type: 'boolean',
              label: 'Parallel execution',
              description: 'Process items concurrently',
              defaultValue: false
            },
            {
              id: 'advanced-limit',
              type: 'number',
              label: 'Concurrency limit',
              description: 'Maximum number of parallel executions',
              defaultValue: 5,
              validation: { min: 1, max: 100 }
            }
          ]
        }
      },
      {
        id: 'connector-database',
        title: 'Database',
        description: 'Connect to SQL/NoSQL databases',
        category: 'Connectors',
        icon: 'ph-database',
        config: {
          id: 'database-config',
          nodeType: 'connector-database',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' },
            { id: 'query', label: 'Query', icon: 'ph-code' }
          ],
          parameters: [
            {
              id: 'basic-type',
              type: 'select',
              label: 'Database Type',
              options: [
                { label: 'PostgreSQL', value: 'postgres' },
                { label: 'MySQL', value: 'mysql' },
                { label: 'MongoDB', value: 'mongodb' }
              ],
              required: true
            },
            {
              id: 'basic-connection',
              type: 'secret',
              label: 'Connection String',
              required: true
            },
            {
              id: 'query-sql',
              type: 'code',
              label: 'SQL Query',
              description: 'Enter your SQL query here'
            }
          ]
        }
      },
      {
        id: 'connector-api',
        title: 'API',
        description: 'Connect to REST/GraphQL APIs',
        category: 'Connectors',
        icon: 'ph-plugs',
        config: {
          id: 'api-config',
          nodeType: 'connector-api',
          tabs: [
            { id: 'basic', label: 'Basic', icon: 'ph-gear' },
            { id: 'auth', label: 'Authentication', icon: 'ph-key' }
          ],
          parameters: [
            {
              id: 'basic-type',
              type: 'select',
              label: 'API Type',
              options: [
                { label: 'REST', value: 'rest' },
                { label: 'GraphQL', value: 'graphql' }
              ],
              required: true
            },
            {
              id: 'basic-endpoint',
              type: 'text',
              label: 'API Endpoint',
              required: true
            },
            {
              id: 'auth-key',
              type: 'secret',
              label: 'API Key',
              description: 'Authentication key for the API'
            }
          ]
        }
      },
      {
        id: 'code-javascript',
        title: 'JavaScript',
        description: 'Run custom JavaScript code',
        category: 'Custom Code',
        icon: 'ph-file-js',
        config: {
          id: 'javascript-config',
          nodeType: 'code-javascript',
          tabs: [
            { id: 'code', label: 'Code', icon: 'ph-code' },
            { id: 'env', label: 'Environment', icon: 'ph-gear' }
          ],
          parameters: [
            {
              id: 'code-script',
              type: 'code',
              label: 'JavaScript Code',
              required: true
            },
            {
              id: 'env-timeout',
              type: 'number',
              label: 'Execution Timeout (ms)',
              defaultValue: 5000,
              validation: { min: 100, max: 30000 }
            },
            {
              id: 'env-memory',
              type: 'number',
              label: 'Memory Limit (MB)',
              defaultValue: 128,
              validation: { min: 32, max: 512 }
            }
          ]
        }
      },
      {
        id: 'code-python',
        title: 'Python',
        description: 'Run custom Python code',
        category: 'Custom Code',
        icon: 'ph-file-py',
        config: {
          id: 'python-config',
          nodeType: 'code-python',
          tabs: [
            { id: 'code', label: 'Code', icon: 'ph-code' },
            { id: 'env', label: 'Environment', icon: 'ph-gear' }
          ],
          parameters: [
            {
              id: 'code-script',
              type: 'code',
              label: 'Python Code',
              required: true
            },
            {
              id: 'env-requirements',
              type: 'code',
              label: 'Requirements',
              description: 'One package per line (pip format)'
            },
            {
              id: 'env-python-version',
              type: 'select',
              label: 'Python Version',
              options: [
                { label: 'Python 3.8', value: '3.8' },
                { label: 'Python 3.9', value: '3.9' },
                { label: 'Python 3.10', value: '3.10' }
              ],
              defaultValue: '3.9'
            }
          ]
        }
      }
    ];

    this.renderPalette();
  }

  private renderPalette() {
    // Get unique categories
    const categories = ['All', 'Favorites', ...new Set(this.nodes.map(node => node.category))];
    
    this.container.innerHTML = `
      <div class="palette-header">
        <input type="text" class="palette-search" placeholder="Search nodes..." value="${this.searchTerm}">
      </div>
      <div class="palette-categories">
        ${categories.map(category => `
          <div class="category-item ${category === this.currentCategory ? 'active' : ''}" data-category="${category}">
            <i class="ph ${this.getCategoryIcon(category)}"></i>
            ${category}
          </div>
        `).join('')}
      </div>
      <div class="palette-nodes"></div>
    `;

    // Add event listeners
    const searchInput = this.container.querySelector('.palette-search') as HTMLInputElement;
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
      this.filterNodes();
    });

    const categoryItems = this.container.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
      item.addEventListener('click', () => {
        this.currentCategory = (item as HTMLElement).dataset.category || 'All';
        categoryItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.filterNodes();
      });
    });

    this.renderNodes();
  }

  private renderNodes() {
    const nodesContainer = this.container.querySelector('.palette-nodes')!;
    nodesContainer.innerHTML = '';
    
    const filteredNodes = this.getFilteredNodes();
    
    filteredNodes.forEach(node => {
      const nodeElement = document.createElement('div');
      nodeElement.className = 'node-item';
      nodeElement.draggable = true;
      nodeElement.dataset.nodeType = node.id;
      
      nodeElement.innerHTML = `
        <div class="node-icon">
          <i class="ph ${node.icon}"></i>
        </div>
        <div class="node-info">
          <div class="node-title">${node.title}</div>
          <div class="node-description">${node.description}</div>
        </div>
        <button class="favorite-button ${this.favorites.has(node.id) ? 'active' : ''}" data-node-id="${node.id}">
          <i class="ph ${this.favorites.has(node.id) ? 'ph-star-fill' : 'ph-star'}"></i>
        </button>
      `;

      // Add favorite button click handler
      const favoriteButton = nodeElement.querySelector('.favorite-button') as HTMLButtonElement;
      favoriteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(node.id);
      });

      nodesContainer.appendChild(nodeElement);
    });

    this.setupDragAndDrop();
  }

  private setupDragAndDrop() {
    const canvasElement = this.canvas.getCanvas();
    
    this.container.querySelectorAll('.node-item').forEach(nodeItem => {
      nodeItem.addEventListener('dragstart', (e) => {
        const element = e.target as HTMLElement;
        const nodeType = element.dataset.nodeType;
        element.classList.add('dragging');
        
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', nodeType || '');
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

      nodeItem.addEventListener('dragend', (e) => {
        const element = e.target as HTMLElement;
        element.classList.remove('dragging');
      });
    });

    canvasElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    canvasElement.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      
      const nodeType = e.dataTransfer.getData('text/plain');
      if (!nodeType) return;

      const rect = canvasElement.getBoundingClientRect();
      const viewState = this.canvas.getViewState();
      
      let x = (e.clientX - rect.left - viewState.offset.x) / viewState.scale;
      let y = (e.clientY - rect.top - viewState.offset.y) / viewState.scale;
      
      if (viewState.snapToGrid) {
        const snapped = this.canvas.snapToGrid({ x, y });
        x = snapped.x;
        y = snapped.y;
      }

      const nodeDefinition = this.nodes.find(n => n.id === nodeType);
      if (nodeDefinition) {
        if (nodeDefinition.id === 'sticky-note') {
          this.createStickyNote({ x, y });
        } else {
          const node = this.nodeManager.createNode(nodeDefinition.title, { x, y });
          node.type = nodeDefinition.category;
          node.icon = nodeDefinition.icon;
          node.description = nodeDefinition.description;
          node.status = 'unsaved';
          node.config = nodeDefinition.config;
          
          this.nodeManager.addPort(node.id, 'input', 'Input');
          this.nodeManager.addPort(node.id, 'output', 'Output');
        }
      }
    });
  }

  private createStickyNote(position: { x: number; y: number }) {
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.left = `${position.x}px`;
    note.style.top = `${position.y}px`;
    note.style.backgroundColor = '#2a2a2a';
    note.style.color = '#ffffff';
    
    note.innerHTML = `
      <div class="sticky-note-toolbar">
        <button class="sticky-note-button" data-action="color">
          <i class="ph ph-paint-brush"></i>
        </button>
        <button class="sticky-note-button" data-action="delete">
          <i class="ph ph-trash"></i>
        </button>
      </div>
      <textarea class="sticky-note-content" placeholder="Type your note here..."></textarea>
    `;

    document.body.appendChild(note);

    // Make the note draggable
    let isDragging = false;
    let startX: number;
    let startY: number;

    note.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.sticky-note-button')) return;
      
      isDragging = true;
      startX = e.clientX - note.offsetLeft;
      startY = e.clientY - note.offsetTop;
      
      note.style.cursor = 'move';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      note.style.left = `${e.clientX - startX}px`;
      note.style.top = `${e.clientY - startY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      note.style.cursor = 'default';
    });

    // Handle toolbar actions
    const toolbar = note.querySelector('.sticky-note-toolbar');
    toolbar?.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('.sticky-note-button');
      if (!button) return;

      const action = button.getAttribute('data-action');
      switch (action) {
        case 'color':
          const colors = ['#2a2a2a', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
          const currentColor = note.style.backgroundColor;
          const nextColorIndex = (colors.indexOf(currentColor) + 1) % colors.length;
          note.style.backgroundColor = colors[nextColorIndex];
          break;
        case 'delete':
          note.remove();
          break;
      }
    });
  }

  private getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'All': 'ph-list',
      'Favorites': 'ph-star',
      'Annotations': 'ph-note',
      'Triggers': 'ph-play',
      'Actions': 'ph-lightning',
      'Logic': 'ph-flow-arrow',
      'Connectors': 'ph-plugs',
      'Custom Code': 'ph-code'
    };
    return icons[category] || 'ph-folder';
  }

  private getFilteredNodes(): NodeDefinition[] {
    return this.nodes.filter(node => {
      const matchesSearch = this.searchTerm === '' ||
        node.title.toLowerCase().includes(this.searchTerm) ||
        node.description.toLowerCase().includes(this.searchTerm);

      const matchesCategory =
        this.currentCategory === 'All' ||
        (this.currentCategory === 'Favorites' && this.favorites.has(node.id)) ||
        node.category === this.currentCategory;

      return matchesSearch && matchesCategory;
    });
  }

  private filterNodes() {
    this.renderNodes();
  }

  private toggleFavorite(nodeId: string) {
    if (this.favorites.has(nodeId)) {
      this.favorites.delete(nodeId);
    } else {
      this.favorites.add(nodeId);
    }

    // Save to localStorage
    localStorage.setItem('nodeFavorites', JSON.stringify(Array.from(this.favorites)));

    // Update UI
    this.renderNodes();
  }
}