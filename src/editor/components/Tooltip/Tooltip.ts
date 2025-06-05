// src/editor/components/Tooltip/Tooltip.ts
import { Point } from '../../core/types';
import { TOOLTIP_DELAY } from '../../core/constants';
import './Tooltip.css'; // Co-located CSS

// Define the structure of the content the tooltip will display
export interface TooltipContent {
  title: string;
  type?: string; // e.g., Node type, Port type
  description?: string;
  id?: string; // Short ID or relevant identifier
  // We can add more fields like status, custom HTML, etc.
}

export class Tooltip {
  private wrapper: HTMLElement; // The overlay container where the tooltip is appended
  private tooltipElement: HTMLElement | null = null;
  private showTimeout: number | null = null;
  private readonly delay: number = TOOLTIP_DELAY; // Delay in ms before showing

  constructor(
    wrapperElement: HTMLElement // e.g., the .editor-overlay-container
  ) {
    this.wrapper = wrapperElement;
    // Tooltip element is created on demand by createTooltipElement
  }

  private createTooltipElement(): void {
    if (this.tooltipElement) {
        // If it exists, just clear its content, ready for new content.
        this.tooltipElement.innerHTML = '';
        return;
    }
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'editor-tooltip'; // Use a more specific class
    this.tooltipElement.style.display = 'none'; // Initially hidden
    // Tooltip is absolutely positioned within its wrapper
    this.wrapper.appendChild(this.tooltipElement);
  }

  // Method to schedule showing the tooltip after a delay
  // `content` can be an object or a function that returns an object (or null to cancel)
  public scheduleShow(clientPosition: Point, contentSource: TooltipContent | (() => TooltipContent | null)): void {
    this.clearPendingShow(); // Clear any existing timeout to show
    this.hideImmediate();   // Hide any currently visible tooltip immediately

    this.showTimeout = window.setTimeout(() => {
      const resolvedContent = typeof contentSource === 'function' ? contentSource() : contentSource;

      if (resolvedContent && resolvedContent.title) { // Ensure there's at least a title
        this.createTooltipElement(); // Ensures element exists
        if (!this.tooltipElement) return;

        this.tooltipElement.innerHTML = `
          <div class="tooltip-title">${resolvedContent.title}</div>
          ${resolvedContent.type ? `<div class="tooltip-type">${resolvedContent.type}</div>` : ''}
          ${resolvedContent.description ? `<div class="tooltip-description">${resolvedContent.description}</div>` : ''}
          ${resolvedContent.id ? `<div class="tooltip-id">ID: ${resolvedContent.id}</div>` : ''}
        `;

        // Position and display the tooltip
        this.tooltipElement.style.display = 'block'; // Show to get dimensions
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const wrapperRect = this.wrapper.getBoundingClientRect(); // Tooltip is positioned relative to this wrapper

        let x = clientPosition.x + 15; // Offset from cursor
        let y = clientPosition.y + 15;

        // Adjust if it goes off-screen relative to the wrapper
        if (x + tooltipRect.width > wrapperRect.left + wrapperRect.width) {
          x = clientPosition.x - tooltipRect.width - 15; // Show on the left
        }
        if (y + tooltipRect.height > wrapperRect.top + wrapperRect.height) {
          y = clientPosition.y - tooltipRect.height - 15; // Show above
        }
        // Ensure it's not off-screen top/left relative to wrapper
        x = Math.max(wrapperRect.left, x);
        y = Math.max(wrapperRect.top, y);


        this.tooltipElement.style.left = `${x - wrapperRect.left}px`;
        this.tooltipElement.style.top = `${y - wrapperRect.top}px`;
        this.tooltipElement.style.pointerEvents = 'none'; // Tooltip should not be interactable
      }
    }, this.delay);
  }

  // Hide the tooltip (e.g., on mouseout or if content becomes null)
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
    this.tooltipElement?.remove(); // Remove from DOM
    this.tooltipElement = null;
    // No global listeners to remove in this version
  }
}