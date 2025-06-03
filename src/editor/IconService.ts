// src/editor/IconService.ts

// Interface para opções de ícone, pode ser expandida
export interface IconOptions {
    size?: string; // ex: '16px', '2em'
    color?: string;
    className?: string; // Classes CSS adicionais
  }
  
  export class IconService {
    // Mapeamento de nomes de ícones para caracteres Unicode da fonte Phosphor (exemplo)
    // Baseado no seu uso original de 'ph-globe': '\uf33d', etc. em NodeEditor.ts
    // Você precisará preencher este mapa com os ícones Phosphor que utiliza.
    // Procure os valores Unicode corretos para as classes 'ph-*' ou use as classes CSS diretamente.
    private phosphorIconMap: Record<string, string> = {
      'globe': '\uf33d', // ph-globe
      'clock': '\uf24b', // ph-clock
      'arrows-in-line-horizontal': '\uf13c', // ph-arrows-in-line-horizontal
      'envelope': '\uf2e7', // ph-envelope
      'git-fork': '\uf334', // ph-git-fork
      'repeat': '\uf47b', // ph-repeat
      'database': '\uf282', // ph-database
      'plugs': '\uf44d', // ph-plugs
      'file-js': '\uf2f7', // ph-file-js
      'file-py': '\uf2fc', // ph-file-py
      'note': '\uf3f3', // ph-note
      'paint-brush': '\uf41a', // ph-paint-brush
      'gear': '\uf322', // ph-gear
      'sliders': '\uf4d9', // ph-sliders
      'lock': '\uf3a9', // ph-lock
      'list': '\uf3a2', // ph-list
      'key': '\uf388', // ph-key
      'server': '\uf4c9', // ph-server
      'file-text': '\uf2fe', // ph-file-text
      'code': '\uf25f', // ph-code
      'play': '\uf449', // ph-play
      'lightning': '\uf39d', // ph-lightning
      'flow-arrow': '\uf301', // ph-flow-arrow
      'folder': '\uf312', // ph-folder
      'star': '\uf4fe', // ph-star
      'star-fill': '\uf4ff', // ph-star-fill (para favoritos)
      'x': '\uf558', // ph-x (para fechar)
      'check': '\uf23d', // ph-check (para aplicar)
      'plus': '\uf451', // ph-plus
      'grid-four': '\uf340', // ph-grid-four
      'magnet': '\uf3b2', // ph-magnet
      'arrows-out': '\uf144', // ph-arrows-out
      'arrows-in': '\uf13b', // ph-arrows-in
      'cube': '\uf27a', // ph-cube (ícone padrão)
      'question': '\uf469', // ph-question
      'arrow-counter-clockwise': '\uf0e8', // Ícone para Undo
      'arrow-clockwise': '\uf0e7',      // Ícone para Redo
      'magnifying-glass': '\uf3b0', // Para Zoom to Selection
    };
  
    constructor() {
      // Carregar fontes de ícones ou SVGs se necessário no futuro
    }
  
    /**
     * Retorna o HTML para um ícone da fonte Phosphor.
     * @param iconName Nome do ícone sem o prefixo 'ph-' (ex: 'globe', 'x').
     * Ou o nome completo da classe (ex: 'ph-globe').
     * @param options Opções adicionais de estilo.
     */
    public getIconHTML(iconName: string, options: IconOptions = {}): string {
      const fullClassName = iconName.startsWith('ph-') ? iconName : `ph-${iconName}`;
      let finalClassName = `ph ${fullClassName}`; // (Phosphor font-family)
      if (options.className) {
        finalClassName += ` ${options.className}`;
      }
  
      let style = '';
      if (options.size) style += `font-size: ${options.size};`;
      if (options.color) style += `color: ${options.color};`;
  
      // Se você estiver usando os caracteres unicode diretamente via @font-face com a classe 'ph' genérica:
      // const char = this.phosphorIconMap[iconName.replace('ph-','')];
      // if (char) {
      //     return `<i class="ph ${options.className || ''}" style="${style}" data-icon-char="${char}">${char}</i>`;
      // }
      // Se você estiver usando classes CSS específicas para cada ícone (ex: .ph-globe):
      return `<i class="${finalClassName}" style="${style}"></i>`;
    }
  
    /**
     * Retorna o caractere unicode para um ícone Phosphor (se estiver usando a fonte diretamente).
     * @param iconName Nome do ícone sem o prefixo 'ph-' (ex: 'globe').
     */
    public getPhosphorIconCharacter(iconName: string): string | undefined {
      const cleanName = iconName.startsWith('ph-') ? iconName.substring(3) : iconName;
      return this.phosphorIconMap[cleanName];
    }
  }