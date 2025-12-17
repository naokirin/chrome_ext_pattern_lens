/**
 * Constants used throughout the Pattern Lens extension
 */

// ============================================================================
// DOM Element IDs
// ============================================================================

/** ID for the highlight overlay container */
export const HIGHLIGHT_OVERLAY_ID = 'pattern-lens-overlay-container';

/** ID for the minimap container */
export const MINIMAP_CONTAINER_ID = 'pattern-lens-minimap-container';

// ============================================================================
// CSS Classes
// ============================================================================

/** CSS class for highlight overlay elements */
export const HIGHLIGHT_CLASS = 'pattern-lens-highlight-overlay';

/** CSS class for the current match highlight */
export const CURRENT_MATCH_CLASS = 'pattern-lens-current-match';

// ============================================================================
// Z-Index Values
// ============================================================================

/** Z-index for the highlight overlay container (highest priority) */
export const OVERLAY_Z_INDEX = 2147483647;

/** Z-index for the minimap container (below overlay) */
export const MINIMAP_Z_INDEX = 2147483646;

// ============================================================================
// Overlay Styling
// ============================================================================

/** Padding around highlight overlays in pixels */
export const OVERLAY_PADDING = 2;

/** Border width for highlight overlays in pixels */
export const OVERLAY_BORDER_WIDTH = 1;

/** Border radius for highlight overlays in pixels */
export const OVERLAY_BORDER_RADIUS = 2;

// ============================================================================
// Overlay Colors
// ============================================================================

/** Background color for normal match highlights */
export const OVERLAY_BG_COLOR_NORMAL = 'rgba(255, 235, 59, 0.4)';

/** Background color for current match highlights */
export const OVERLAY_BG_COLOR_CURRENT = 'rgba(255, 152, 0, 0.5)';

/** Border color for normal match highlights */
export const OVERLAY_BORDER_COLOR_NORMAL = 'rgba(255, 193, 7, 0.8)';

/** Border color for current match highlights */
export const OVERLAY_BORDER_COLOR_CURRENT = 'rgba(255, 87, 34, 0.9)';

// ============================================================================
// Minimap Styling
// ============================================================================

/** Width of the minimap container in pixels */
export const MINIMAP_WIDTH = 12;

/** Height of minimap markers in pixels */
export const MINIMAP_MARKER_HEIGHT = 4;

/** Border radius of minimap markers in pixels */
export const MINIMAP_MARKER_BORDER_RADIUS = 1;

/** Background color for the minimap container */
export const MINIMAP_BG_COLOR = 'rgba(0, 0, 0, 0.05)';

/** Background color for normal minimap markers */
export const MINIMAP_MARKER_COLOR_NORMAL = 'rgba(255, 193, 7, 0.8)';

/** Background color for current minimap marker */
export const MINIMAP_MARKER_COLOR_CURRENT = 'rgba(255, 87, 34, 0.9)';

// ============================================================================
// Virtual Text Markers
// ============================================================================

/**
 * Unicode Private Use Area character used as block boundary marker
 * This character won't appear in normal text and won't be matched by user regex accidentally
 */
export const BLOCK_BOUNDARY_MARKER = '\uE000';

/**
 * Placeholder for escaped dots in regex patterns
 * Uses Unicode Private Use Area character to avoid conflicts
 */
export const ESCAPED_DOT_PLACEHOLDER = '\uE001ESCAPED_DOT\uE001';

// ============================================================================
// Timing Constants
// ============================================================================

/** Debounce delay for search input in milliseconds */
export const SEARCH_DEBOUNCE_DELAY_MS = 300;

/** Throttle delay for overlay position updates in milliseconds */
export const OVERLAY_UPDATE_THROTTLE_MS = 16; // ~60fps

// ============================================================================
// Rectangle Merging
// ============================================================================

/** Default tolerance for merging adjacent rectangles in pixels */
export const RECT_MERGE_TOLERANCE = 1;

// ============================================================================
// Fuzzy Search Constants
// ============================================================================

/**
 * Multiplier for calculating maximum keyword distance based on total keyword length
 * Range = totalKeywordLength × FUZZY_SEARCH_BASE_MULTIPLIER
 * Examples:
 * - 5 characters → 30 characters range
 * - 10 characters → 60 characters range
 * - 20 characters → 120 characters range
 */
export const FUZZY_SEARCH_BASE_MULTIPLIER = 6;

/**
 * Minimum range for fuzzy search multi-keyword matching (in characters)
 * Even for very short keywords, this minimum range is applied
 */
export const FUZZY_SEARCH_MIN_DISTANCE = 20;

/**
 * Maximum range for fuzzy search multi-keyword matching (in characters)
 * Prevents excessive matches for very long keywords
 */
export const FUZZY_SEARCH_MAX_DISTANCE = 200;

// ============================================================================
// Search Results List Constants
// ============================================================================

/**
 * Default context length (characters before and after match) for search results list
 */
export const DEFAULT_RESULTS_LIST_CONTEXT_LENGTH = 30;

/**
 * Minimum context length for search results list
 */
export const MIN_RESULTS_LIST_CONTEXT_LENGTH = 10;

/**
 * Maximum context length for search results list
 */
export const MAX_RESULTS_LIST_CONTEXT_LENGTH = 100;
