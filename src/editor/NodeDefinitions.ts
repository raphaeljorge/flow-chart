import { NodeDefinition } from '../core/Types';

// Estas definições são baseadas no seu NodePalette.ts original
//
export const ALL_NODE_DEFINITIONS: NodeDefinition[] = [
  {
    id: 'sticky-note-def', // ID da definição, diferente do tipo do nó 'sticky-note' se necessário
    title: 'Sticky Note',
    description: 'Add notes and documentation',
    category: 'Annotations',
    icon: 'ph-note', // Usar classes do Phosphor Icons
    // Sticky notes não usam o mesmo config que nós, elas são tratadas pelo StickyNoteManager
    // Poderíamos ter um tipo específico de 'itemDefinition' para notas
    // ou apenas um identificador especial para a paleta.
    // Por enquanto, o NodeEditor tratará a criação de sticky notes de forma especial.
  },
  {
    id: 'trigger-webhook',
    title: 'Webhook Trigger',
    description: 'Triggers when a webhook is received',
    category: 'Triggers',
    icon: 'ph-globe',
    defaultWidth: 220,
    defaultHeight: 120,
    defaultInputs: [], // Webhook geralmente é um nó de início, sem inputs de fluxo
    defaultOutputs: [{ name: 'Output', type: 'output' }],
    config: {
      id: 'webhook-config',
      nodeType: 'trigger-webhook',
      tabs: [
        { id: 'basic', label: 'Basic', icon: 'ph-gear' },
        { id: 'advanced', label: 'Advanced', icon: 'ph-sliders' },
        { id: 'security', label: 'Security', icon: 'ph-lock' },
      ],
      parameters: [
        { id: 'basic-path', tabId: 'basic', type: 'text', label: 'Webhook Path', description: 'The URL path to receive webhooks (e.g., /my-webhook)', required: true, validation: { pattern: '^/[a-zA-Z0-9-_/]*$' } },
        { id: 'basic-method', tabId: 'basic', type: 'select', label: 'HTTP Method', options: [ { label: 'POST', value: 'post' }, { label: 'GET', value: 'get' }, { label: 'PUT', value: 'put' }, { label: 'DELETE', value: 'delete' }], defaultValue: 'post' },
        { id: 'security-secret', tabId: 'security', type: 'secret', label: 'Webhook Secret', description: 'Secret token to validate webhook requests' },
        { id: 'advanced-timeout', tabId: 'advanced', type: 'number', label: 'Timeout (seconds)', defaultValue: 30, validation: { min: 1, max: 300 } },
      ],
    },
  },
  {
    id: 'trigger-schedule',
    title: 'Schedule',
    description: 'Triggers at specified intervals',
    category: 'Triggers',
    icon: 'ph-clock',
    defaultWidth: 220,
    defaultHeight: 120,
    defaultOutputs: [{ name: 'Output', type: 'output' }],
    config: {
      id: 'schedule-config',
      nodeType: 'trigger-schedule',
      tabs: [
        { id: 'basic', label: 'Basic', icon: 'ph-gear' },
        { id: 'advanced', label: 'Advanced', icon: 'ph-sliders' },
      ],
      parameters: [
        { id: 'basic-cron', tabId: 'basic', type: 'text', label: 'Cron Expression', description: 'Schedule using cron syntax (e.g., */5 * * * *)', required: true },
        { id: 'basic-timezone', tabId: 'basic', type: 'select', label: 'Timezone', options: [ { label: 'UTC', value: 'UTC' }, { label: 'Local', value: 'local' }], defaultValue: 'UTC' },
        { id: 'advanced-retry', tabId: 'advanced', type: 'boolean', label: 'Enable automatic retry', defaultValue: true },
      ],
    },
  },
  {
    id: 'action-http',
    title: 'HTTP Request',
    description: 'Make HTTP requests to external services',
    category: 'Actions',
    icon: 'ph-arrows-in-line-horizontal',
    defaultInputs: [{ name: 'Input', type: 'input' }],
    defaultOutputs: [{ name: 'Response', type: 'output' }, { name: 'Error', type: 'output' }],
    config: {
      id: 'http-config',
      nodeType: 'action-http',
      tabs: [ { id: 'basic', label: 'Basic', icon: 'ph-gear' }, { id: 'headers', label: 'Headers', icon: 'ph-list' }, { id: 'auth', label: 'Authentication', icon: 'ph-key' }],
      parameters: [
        { id: 'basic-url', tabId: 'basic', type: 'text', label: 'URL', description: 'The URL to send the request to', required: true, validation: { pattern: '^https?://.+' } },
        { id: 'basic-method', tabId: 'basic', type: 'select', label: 'Method', options: [ { label: 'GET', value: 'get' }, { label: 'POST', value: 'post' }, { label: 'PUT', value: 'put' }, { label: 'DELETE', value: 'delete' }], defaultValue: 'get' },
        { id: 'headers-custom', tabId: 'headers', type: 'code', label: 'Custom Headers (JSON)', description: 'Add custom headers in JSON format' },
        { id: 'auth-type', tabId: 'auth', type: 'select', label: 'Authentication Type', options: [ { label: 'None', value: 'none' }, { label: 'Basic Auth', value: 'basic' }, { label: 'Bearer Token', value: 'bearer' }] },
      ],
    },
  },
  // ... (restantes das definições de nós do seu NodePalette.ts original)
  // Exemplo para action-email:
  {
    id: 'action-email',
    title: 'Send Email',
    description: 'Send emails using SMTP',
    category: 'Actions',
    icon: 'ph-envelope',
    defaultInputs: [{ name: 'Input', type: 'input' }],
    defaultOutputs: [{ name: 'Sent', type: 'output' }, { name: 'Error', type: 'output' }],
    config: {
      id: 'email-config',
      nodeType: 'action-email',
      tabs: [ { id: 'basic', label: 'Basic', icon: 'ph-gear' }, { id: 'smtp', label: 'SMTP', icon: 'ph-server' }, { id: 'template', label: 'Template', icon: 'ph-file-text' }],
      parameters: [
        { id: 'basic-to', tabId:'basic', type: 'text', label: 'To', description: 'Recipient email address', required: true, validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' } },
        { id: 'basic-subject', tabId:'basic', type: 'text', label: 'Subject', required: true },
        { id: 'template-body', tabId:'template', type: 'code', label: 'Email Body (HTML)', description: 'Supports HTML and template variables' },
        { id: 'smtp-host', tabId:'smtp', type: 'text', label: 'SMTP Host' },
        { id: 'smtp-port', tabId:'smtp', type: 'number', label: 'SMTP Port', defaultValue: 587 },
      ],
    },
  },
  // Adicione as outras definições: logic-branch, logic-loop, connector-database, connector-api, code-javascript, code-python
  // seguindo o mesmo padrão.
  // ...
];

// Você pode também exportar um mapa se for mais fácil de acessar por ID:
// export const NODE_DEFINITIONS_MAP = new Map(ALL_NODE_DEFINITIONS.map(def => [def.id, def]));