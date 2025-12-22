import type {
  ClearMessage,
  GetResultsListMessage,
  GetStateMessage,
  JumpToMatchMessage,
  Message,
  NavigateMessage,
  SearchMessage,
  SearchResponse,
  SearchResultsListResponse,
  StateResponse,
} from '~/lib/types';
import { handleError } from '~/lib/utils/errorHandler';
/**
 * Message router for content script
 */
import type { MessageHandlerContext } from './handlers';
import {
  handleClear,
  handleGetResultsList,
  handleGetState,
  handleJumpToMatch,
  handleNavigateNext,
  handleNavigatePrev,
  handleSearch,
} from './handlers';

/**
 * Route message to appropriate handler with type safety
 */
export async function routeMessage(
  message: Message,
  context: MessageHandlerContext
): Promise<SearchResponse | StateResponse | SearchResultsListResponse | undefined> {
  try {
    switch (message.action) {
      case 'search': {
        const result = await handleSearch(message as SearchMessage, context);
        return result;
      }
      case 'clear': {
        const result = handleClear(message as ClearMessage, context);
        return result;
      }
      case 'navigate-next': {
        const result = handleNavigateNext(message as NavigateMessage, context);
        return result;
      }
      case 'navigate-prev': {
        const result = handleNavigatePrev(message as NavigateMessage, context);
        return result;
      }
      case 'get-state': {
        const result = handleGetState(message as GetStateMessage, context);
        return result;
      }
      case 'get-results-list': {
        const result = handleGetResultsList(message as GetResultsListMessage, context);
        return result;
      }
      case 'jump-to-match': {
        const result = handleJumpToMatch(message as JumpToMatchMessage, context);
        return result;
      }
      case 'ping': {
        // Ping handler - just return success to confirm content script is loaded
        return { success: true };
      }
      case 'open-popup': {
        // This action is handled by background script, not content script
        // Return undefined to indicate this action is not handled here
        return undefined;
      }
      default: {
        // Exhaustiveness check - TypeScript will error if a new action is added but not handled
        // This should never be reached if all message types are handled above
        const _exhaustive: never = message as never;
        handleError(
          new Error(`Unknown action: ${(message as Message).action}`),
          'routeMessage: Unknown action',
          undefined
        );
        return undefined;
      }
    }
  } catch (error) {
    handleError(error, `routeMessage: Handler for ${message.action} failed`, undefined);
    return { success: false, error: (error as Error).message } as SearchResponse;
  }
}
