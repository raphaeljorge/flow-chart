// src/editor/services/EditorIconService.ts

export interface IconOptions {
    size?: string; // e.g., '16px', '2em'
    color?: string;
    className?: string; // Additional CSS classes to apply to the <i> element
    title?: string; // For tooltip on the icon itself
  }
  
  export class EditorIconService {
    // This service primarily relies on CSS classes for Phosphor Icons.
    // The actual font/CSS for Phosphor Icons should be imported globally (e.g., in main.ts or index.html).
    // Example: import '@phosphor-icons/web/regular'; (or bold, light, etc.)
  
    constructor() {
      // Initialization if needed (e.g., loading SVG sprite, though not used here)
    }
  
    /**
     * Returns an HTML string for a Phosphor icon <i> element.
     * @param iconName The name of the icon, e.g., 'globe', 'plus', 'ph-gear' (prefix is optional).
     * @param options Optional styling and attributes.
     */
    public getIconHTMLString(iconName: string, options: IconOptions = {}): string {
      if (!iconName || iconName.trim() === '') {
        // Return a default placeholder icon or an empty string if no icon name is provided
        // For example, a "question mark" icon for unknown icons
        iconName = 'ph-question'; // Default to a question mark icon
      }
      const fullClassName = iconName.startsWith('ph-') ? iconName : `ph-${iconName}`;
      let classes = `ph ${fullClassName}`; // Base classes for Phosphor font
  
      if (options.className) {
        classes += ` ${options.className}`;
      }
  
      let styleString = '';
      if (options.size) styleString += `font-size: ${options.size};`;
      if (options.color) styleString += `color: ${options.color};`;
  
      const titleAttribute = options.title ? `title="${options.title}"` : '';
  
      return `<i class="${classes}" ${styleString ? `style="${styleString}"` : ''} ${titleAttribute}></i>`;
    }
  
    /**
     * Creates and returns an HTMLElement (<i>) for a Phosphor icon.
     * This is useful if you need to append the icon as a DOM element directly.
     * @param iconName The name of the icon, e.g., 'globe', 'plus'.
     * @param options Optional styling and attributes.
     */
    public createIconElement(iconName: string, options: IconOptions = {}): HTMLElement {
      if (!iconName || iconName.trim() === '') {
        iconName = 'ph-question';
      }
      const iconElement = document.createElement('i');
      const fullClassName = iconName.startsWith('ph-') ? iconName : `ph-${iconName}`;
      let classes = `ph ${fullClassName}`;
  
      if (options.className) {
        classes += ` ${options.className}`;
      }
      iconElement.className = classes;
  
      if (options.size) iconElement.style.fontSize = options.size;
      if (options.color) iconElement.style.color = options.color;
      if (options.title) iconElement.title = options.title;
  
      return iconElement;
    }
  }