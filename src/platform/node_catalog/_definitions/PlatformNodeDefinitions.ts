// src/platform/node_catalog/_definitions/PlatformNodeDefinitions.ts
import { PlatformNodeDefinition } from '../node.types';
import { NodeConfig } from '../../../editor/core/types';

const asNodeConfig = (config: any): NodeConfig => config as NodeConfig;

export const ALL_PLATFORM_NODE_DEFINITIONS: PlatformNodeDefinition[] = [
  {
    id: 'sticky-note-def',
    title: 'Sticky Note',
    description: 'Add notes and documentation to your flow.',
    category: 'Annotations',
    icon: 'ph-note-pencil',
    defaultWidth: 180,
    defaultHeight: 120,
    color: '#888888',
  },
  {
    id: 'trigger-webhook',
    title: 'Webhook',
    description: 'Triggers flow when an HTTP webhook is received.',
    category: 'Triggers',
    icon: 'ph-globe-hemisphere-west',
    defaultWidth: 240,
    defaultHeight: 130,
    defaultFixedOutputs: [{ name: 'Output', type: 'output' }],
    color: '#FFD700',
    config: asNodeConfig({
      id: 'webhook-config',
      itemType: 'node',
      tabs: [
        { id: 'general', label: 'General', icon: 'ph-gear' },
        { id: 'security', label: 'Security', icon: 'ph-shield-check' },
        { id: 'advanced', label: 'Advanced', icon: 'ph-sliders-horizontal' },
      ],
      parameters: [
        // Corrected regex: removed the slash from inside the character class,
        // as forward slashes are allowed by not being restricted by the class.
        // If you wanted to specifically match a path starting with slash and then only those chars:
        // /^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$/  (example for multi-segment paths)
        // For a simple single segment after initial slash: /^\/[a-zA-Z0-9_-]*$/
        // The original seemed to imply segments separated by slashes.
        // A more robust path regex might be needed depending on exact requirements.
        // For now, a simple path segment:
        { id: 'path', tabId: 'general', type: 'text', label: 'Webhook Path', description: 'Unique URL path (e.g., /my-event or my-event/sub-path)', required: true, validation: { pattern: '^(\\/?[a-zA-Z0-9_\\-]+)+$' }, defaultValue: '/flow-trigger' },
        { id: 'method', tabId: 'general', type: 'select', label: 'HTTP Method', options: [ { label: 'POST', value: 'POST' }, { label: 'GET', value: 'GET' }, { label: 'PUT', value: 'PUT' }], defaultValue: 'POST' },
        { id: 'authToken', tabId: 'security', type: 'secret', label: 'Authentication Token', description: 'Optional secret token for request validation.' },
        { id: 'responseBody', tabId: 'advanced', type: 'code', label: 'Immediate Response Body', description: 'JSON body to respond immediately to the webhook caller.', defaultValue: '{ "status": "received" }' },
        { id: 'timeout', tabId: 'advanced', type: 'number', label: 'Processing Timeout (s)', defaultValue: 60, validation: { min: 5, max: 300 } },
      ],
    }),
  },
  {
    id: 'trigger-schedule',
    title: 'Scheduler',
    description: 'Triggers flow based on a defined schedule (e.g., cron).',
    category: 'Triggers',
    icon: 'ph-timer',
    defaultWidth: 240,
    defaultHeight: 130,
    defaultFixedOutputs: [{ name: 'Output', type: 'output' }],
    color: '#FFD700',
    config: asNodeConfig({
      id: 'schedule-config',
      itemType: 'node',
      tabs: [ { id: 'schedule', label: 'Schedule', icon: 'ph-calendar-check' }, ],
      parameters: [
        { id: 'cronExpression', tabId: 'schedule', type: 'text', label: 'Cron Expression', description: 'e.g., "0 * * * *" for hourly. Uses standard cron syntax.', required: true, defaultValue: '*/5 * * * *' },
        { id: 'timezone', tabId: 'schedule', type: 'select', label: 'Timezone', options: [ { label: 'UTC', value: 'UTC' }, { label: 'Server Default', value: 'SERVER_DEFAULT' }], defaultValue: 'UTC', description: 'Timezone for schedule execution.' },
        { id: 'payload', tabId: 'schedule', type: 'code', label: 'Initial Payload (JSON)', description: 'JSON object to pass as data when the schedule triggers.', defaultValue: '{}'},
      ],
    }),
  },
  {
    id: 'action-http-request',
    title: 'HTTP Request',
    description: 'Make an HTTP request to an external URL or API.',
    category: 'Actions',
    icon: 'ph-paper-plane-tilt',
    defaultFixedInputs: [{ name: 'Input', type: 'input' }],
    defaultFixedOutputs: [{ name: 'Response', type: 'output' }, { name: 'Error', type: 'output' }],
    defaultWidth: 260,
    defaultHeight: 150,
    color: '#5A93E4',
    config: asNodeConfig({
      id: 'http-request-config',
      itemType: 'node',
      tabs: [ { id: 'request', label: 'Request', icon: 'ph-arrow-square-out' }, { id: 'headers', label: 'Headers', icon: 'ph-list-bullets' }, { id: 'auth', label: 'Authentication', icon: 'ph-key' }, {id: 'response', label: 'Response', icon: 'ph-arrow-square-in'}],
      parameters: [
        { id: 'url', tabId: 'request', type: 'text', label: 'URL', description: 'The full URL to send the request to.', required: true, validation: { pattern: '^https?://.+' }, defaultValue: 'https://api.example.com/data' },
        { id: 'method', tabId: 'request', type: 'select', label: 'Method', options: [ { label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }, { label: 'DELETE', value: 'DELETE' }, { label: 'PATCH', value: 'PATCH' }], defaultValue: 'GET' },
        { id: 'body', tabId: 'request', type: 'code', label: 'Request Body (JSON)', description: 'JSON body for POST/PUT/PATCH requests. Use {{input.data}} for variables.' },
        { id: 'customHeaders', tabId: 'headers', type: 'code', label: 'Custom Headers (JSON)', description: 'Add custom headers as a JSON object.', defaultValue: '{ "Content-Type": "application/json" }' },
        { id: 'authType', tabId: 'auth', type: 'select', label: 'Authentication', options: [ { label: 'None', value: 'none' }, { label: 'Basic Auth', value: 'basic' }, { label: 'Bearer Token', value: 'bearer' }], defaultValue: 'none' },
        { id: 'username', tabId: 'auth', type: 'text', label: 'Username (Basic Auth)', description: 'Visible if Basic Auth selected.'},
        { id: 'password', tabId: 'auth', type: 'secret', label: 'Password (Basic Auth)', description: 'Visible if Basic Auth selected.'},
        { id: 'token', tabId: 'auth', type: 'secret', label: 'Bearer Token', description: 'Visible if Bearer Token selected.'},
        { id: 'parseResponseAs', tabId: 'response', type: 'select', label: 'Parse Response As', options: [{label: 'JSON', value: 'json'}, {label: 'Text', value: 'text'}, {label: 'Ignore', value: 'ignore'}], defaultValue: 'json'},
      ],
    }),
  },
  {
    id: 'action-send-email',
    title: 'Send Email',
    description: 'Send an email via a configured SMTP server or service.',
    category: 'Actions',
    icon: 'ph-envelope-simple',
    defaultFixedInputs: [{ name: 'Input', type: 'input' }],
    defaultFixedOutputs: [{ name: 'Sent', type: 'output' }, { name: 'Error', type: 'output' }],
    defaultWidth: 260,
    defaultHeight: 150,
    color: '#5A93E4',
    config: asNodeConfig({
      id: 'send-email-config',
      itemType: 'node',
      tabs: [ { id: 'recipient', label: 'Recipient', icon: 'ph-user-focus' }, { id: 'content', label: 'Content', icon: 'ph-article' }, { id: 'server', label: 'Server (SMTP)', icon: 'ph-upload-simple' }],
      parameters: [
        { id: 'to', tabId:'recipient', type: 'text', label: 'To Address(es)', description: 'Comma-separated email addresses.', required: true, },
        { id: 'subject', tabId:'recipient', type: 'text', label: 'Subject', required: true, defaultValue: 'Notification from Flow' },
        { id: 'from', tabId:'recipient', type: 'text', label: 'From Address (Optional)', description: 'If different from server default.'},
        { id: 'bodyType', tabId: 'content', type: 'select', label: 'Body Type', options: [{label: 'HTML', value: 'html'}, {label: 'Plain Text', value: 'text'}], defaultValue: 'html'},
        { id: 'body', tabId:'content', type: 'code', label: 'Email Body', description: 'HTML or Plain Text. Use {{input.data}} for variables.' },
        { id: 'smtpHost', tabId:'server', type: 'text', label: 'SMTP Host' },
        { id: 'smtpPort', tabId:'server', type: 'number', label: 'SMTP Port', defaultValue: 587 },
        { id: 'smtpUser', tabId:'server', type: 'text', label: 'SMTP Username' },
        { id: 'smtpPassword', tabId:'server', type: 'secret', label: 'SMTP Password' },
        { id: 'smtpSecure', tabId:'server', type: 'boolean', label: 'Use SSL/TLS', defaultValue: true},
      ],
    }),
  },
  {
    id: 'logic-condition',
    title: 'Condition (If/Else)',
    description: 'Routes flow based on a condition (true/false).',
    category: 'Logic',
    icon: 'ph-git-fork',
    defaultFixedInputs: [{ name: 'Input', type: 'input' }],
    defaultFixedOutputs: [{ name: 'True', type: 'output' }, { name: 'False', type: 'output' }],
    defaultWidth: 200,
    defaultHeight: 120,
    color: '#22C55E',
    config: asNodeConfig({
        id: 'condition-config', itemType: 'node',
        parameters: [ { id: 'conditionExpression', type: 'code', label: 'Condition', description: 'JavaScript expression evaluating to true or false. e.g., {{input.value}} > 10', required: true} ]
    })
  },
  {
    id: 'logic-custom-code-js',
    title: 'JavaScript Code',
    description: 'Execute custom JavaScript code snippet.',
    category: 'Custom Code',
    icon: 'ph-file-js',
    defaultFixedInputs: [{ name: 'Input', type: 'input' }],
    defaultFixedOutputs: [{ name: 'Output', type: 'output' }],
    defaultWidth: 280,
    defaultHeight: 180,
    color: '#EF4444',
    config: asNodeConfig({
        id: 'custom-js-config', itemType: 'node',
        parameters: [ { id: 'script', type: 'code', label: 'JavaScript Code', description: 'Access input data via `input` object. Return a value for output.', required: true, defaultValue: '// Access input via input.propertyName\n// Example: return { result: input.value * 2 };\n\nreturn input;'} ]
    })
  },
];