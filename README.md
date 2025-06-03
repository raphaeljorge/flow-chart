flow-chart

flow-chart/
├── .bolt/
│   └── config.json
├── public/                     # Assets estáticos (ex: vite.svg se ainda usado)
├── src/
│   ├── assets/
│   │   └── style.css           # Estilos principais da aplicação
│   │   └── (fontes, ícones, se houver arquivos específicos)
│   │
│   ├── core/                   # Engine principal e gerenciamento de dados
│   │   ├── CanvasEngine.ts     # Gerencia o canvas, contexto de renderização, transformações de visualização (pan, zoom), grade
│   │   ├── InteractionManager.ts # Lida com interações no canvas (arrastar, redimensionar, seleção em caixa)
│   │   ├── NodeManager.ts      # Gerencia dados de nós, propriedades e conexões
│   │   ├── StickyNoteManager.ts # Gerencia dados e propriedades de notas adesivas
│   │   ├── SelectionManager.ts # Gerencia o estado de seleção para todos os objetos do canvas
│   │   ├── RenderService.ts    # Contém lógica de renderização para diferentes elementos
│   │   ├── ClipboardManager.ts # Lida com operações de copiar/colar
│   │   ├── ShortcutManager.ts  # Lida com atalhos de teclado
│   │   └── Types.ts            # Interfaces e tipos TypeScript centrais
│   │
│   ├── editor/                 # Orquestrador principal da aplicação e configurações
│   │   ├── NodeEditor.ts       # Orquestra todos os componentes, lógica principal da aplicação
│   │   ├── NodeDefinitions.ts  # Definições para os tipos de nós disponíveis
│   │   └── IconService.ts      # Utilitário para gerenciar/recuperar ícones
│   │
│   ├── ui/                     # Componentes de UI (baseados em DOM, interagindo com o core)
│   │   ├── NodePalette.ts      # UI para a paleta de nós
│   │   ├── ConfigPanel.ts      # UI para o painel de configuração
│   │   ├── Toolbar.ts          # UI para a barra de ferramentas flutuante
│   │   ├── ContextMenu.ts      # UI para o menu de contexto
│   │   ├── QuickAddMenu.ts     # UI para o menu de adição rápida de nós
│   │   ├── Tooltip.ts          # UI para tooltips
│   │
│   ├── lib/                    # Ponto de entrada se este projeto for uma biblioteca
│   │   └── index.ts            # Exporta a API pública do editor
│   │
│   ├── main.ts                 # Ponto de entrada principal da aplicação
│   └── vite-env.d.ts         # Definições de tipo específicas do Vite
│
├── index.html
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.json