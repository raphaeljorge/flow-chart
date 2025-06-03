// src/ui/Tooltip.ts
import { Point, Node, NodePort } from '../core/Types'; // Adicionar tipos para o conteúdo do tooltip

export interface TooltipContent {
  title: string;
  type?: string;
  description?: string;
  id?: string;
  // Adicionar mais campos conforme necessário
}

export class Tooltip {
  private tooltipElement: HTMLElement | null = null;
  private showTimeout: number | null = null;
  private readonly delay: number = 500; // ms

  constructor(private container: HTMLElement) { // Onde o tooltip será anexado (ex: document.body ou container do editor)
    this.createTooltipElement();
  }

  private createTooltipElement(): void {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'tooltip'; //
    this.tooltipElement.style.display = 'none';
    this.tooltipElement.style.position = 'fixed'; // Para posicionamento relativo à viewport
    this.container.appendChild(this.tooltipElement);
  }

  public scheduleShow(clientPosition: Point, content: TooltipContent | (() => TooltipContent | null)): void {
    this.clearPendingShow(); // Limpa qualquer tooltip pendente
    this.hideImmediate(); // Esconde qualquer tooltip visível imediatamente

    this.showTimeout = window.setTimeout(() => {
      const resolvedContent = typeof content === 'function' ? content() : content;
      if (resolvedContent && this.tooltipElement) {
        this.tooltipElement.innerHTML = `
          <div class="tooltip-title">${resolvedContent.title}</div>
          ${resolvedContent.type ? `<div class="tooltip-type">${resolvedContent.type}</div>` : ''}
          ${resolvedContent.description ? `<div class="tooltip-description">${resolvedContent.description}</div>` : ''}
          ${resolvedContent.id ? `<div class="tooltip-id">ID: ${resolvedContent.id}</div>` : ''}
        `; //
        
        // Ajustar posição para não sair da tela
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        let x = clientPosition.x + 15;
        let y = clientPosition.y + 15;

        if (x + tooltipRect.width > window.innerWidth) {
            x = clientPosition.x - tooltipRect.width - 15;
        }
        if (y + tooltipRect.height > window.innerHeight) {
            y = clientPosition.y - tooltipRect.height - 15;
        }

        this.tooltipElement.style.left = `${x}px`;
        this.tooltipElement.style.top = `${y}px`;
        this.tooltipElement.style.display = 'block';
      }
    }, this.delay);
  }

  public hide(): void {
    this.clearPendingShow();
    this.hideImmediate();
  }
  
  private hideImmediate(): void {
     if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
    }
  }

  private clearPendingShow(): void {
    if (this.showTimeout !== null) {
      window.clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
  }

  public destroy(): void {
    this.clearPendingShow();
    this.tooltipElement?.remove();
  }
}