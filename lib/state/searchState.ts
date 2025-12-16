// State management for Pattern Lens content script
import type { HighlightData, SearchState } from '~/lib/types';

/**
 * Manages search state including highlights, navigation, and search parameters
 */
export class SearchStateManager {
  private highlightData: HighlightData = {
    ranges: [],
    elements: [],
    overlays: [],
  };

  private currentMatchIndex = -1;

  private lastSearchState: SearchState = {
    query: '',
    useRegex: false,
    caseSensitive: false,
    useElementSearch: false,
    elementSearchMode: 'css',
    useFuzzy: false,
  };

  // Getters for highlight data
  get ranges(): Range[] {
    return this.highlightData.ranges;
  }

  get elements(): Element[] {
    return this.highlightData.elements;
  }

  get overlays(): HTMLDivElement[] {
    return this.highlightData.overlays;
  }

  get currentIndex(): number {
    return this.currentMatchIndex;
  }

  get searchState(): SearchState {
    return { ...this.lastSearchState };
  }

  get totalMatches(): number {
    return this.highlightData.ranges.length || this.highlightData.elements.length;
  }

  // Methods for managing ranges
  addRange(range: Range): void {
    this.highlightData.ranges.push(range);
  }

  addElement(element: Element): void {
    this.highlightData.elements.push(element);
  }

  addOverlay(overlay: HTMLDivElement): void {
    this.highlightData.overlays.push(overlay);
  }

  // Methods for managing current match index
  setCurrentIndex(index: number): void {
    this.currentMatchIndex = index;
  }

  // Methods for managing search state
  updateSearchState(state: SearchState): void {
    this.lastSearchState = { ...state };
  }

  // Clear all highlights and reset state
  clear(): void {
    this.highlightData.ranges.length = 0;
    this.highlightData.elements.length = 0;
    this.highlightData.overlays.length = 0;
    this.currentMatchIndex = -1;
  }

  // Clear overlays array (used when recreating overlays)
  clearOverlays(): void {
    this.highlightData.overlays.length = 0;
  }

  // Check if there are any matches
  hasMatches(): boolean {
    return this.highlightData.ranges.length > 0 || this.highlightData.elements.length > 0;
  }

  // Check if there are text search matches (ranges)
  hasTextMatches(): boolean {
    return this.highlightData.ranges.length > 0;
  }

  // Check if there are element search matches
  hasElementMatches(): boolean {
    return this.highlightData.elements.length > 0;
  }

  // Get current range (for text search)
  getCurrentRange(): Range | null {
    if (this.highlightData.ranges.length === 0) {
      return null;
    }
    return this.highlightData.ranges[this.currentMatchIndex] ?? null;
  }

  // Get current element (for element search)
  getCurrentElement(): Element | null {
    if (this.highlightData.elements.length === 0) {
      return null;
    }
    return this.highlightData.elements[this.currentMatchIndex] ?? null;
  }

  // Iterate over ranges with index
  forEachRange(callback: (range: Range, index: number) => void): void {
    this.highlightData.ranges.forEach(callback);
  }

  // Iterate over elements with index
  forEachElement(callback: (element: Element, index: number) => void): void {
    this.highlightData.elements.forEach(callback);
  }
}
