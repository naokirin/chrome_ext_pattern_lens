// Highlight marker class
const HIGHLIGHT_CLASS = 'pattern-lens-highlight';
const HIGHLIGHT_STYLE_ID = 'pattern-lens-styles';

// Initialize highlight styles
function initializeStyles() {
  if (!document.getElementById(HIGHLIGHT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        background-color: #ffeb3b !important;
        color: #000 !important;
        padding: 2px !important;
        border-radius: 2px !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Remove all highlights
function clearHighlights() {
  const highlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  highlights.forEach((element) => {
    const parent = element.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(element.textContent), element);
      parent.normalize();
    }
  });
}

// Search and highlight text
function searchText(query, useRegex) {
  let count = 0;
  const pattern = useRegex ? new RegExp(query, 'gi') : null;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script, style, and already highlighted elements
        if (
          node.parentElement.tagName === 'SCRIPT' ||
          node.parentElement.tagName === 'STYLE' ||
          node.parentElement.classList.contains(HIGHLIGHT_CLASS)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodesToProcess = [];
  let currentNode;

  while ((currentNode = walker.nextNode())) {
    nodesToProcess.push(currentNode);
  }

  nodesToProcess.forEach((node) => {
    const text = node.nodeValue;
    let matches = [];

    if (useRegex && pattern) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });
      }
    } else {
      let pos = text.toLowerCase().indexOf(query.toLowerCase());
      while (pos !== -1) {
        matches.push({
          start: pos,
          end: pos + query.length,
          text: text.substring(pos, pos + query.length),
        });
        pos = text.toLowerCase().indexOf(query.toLowerCase(), pos + 1);
      }
    }

    if (matches.length > 0) {
      count += matches.length;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach((match) => {
        // Add text before match
        if (match.start > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, match.start))
          );
        }

        // Add highlighted match
        const highlight = document.createElement('mark');
        highlight.className = HIGHLIGHT_CLASS;
        highlight.textContent = match.text;
        fragment.appendChild(highlight);

        lastIndex = match.end;
      });

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    }
  });

  return count;
}

// Search elements by CSS selector or XPath
function searchElements(query, mode) {
  let elements = [];

  try {
    if (mode === 'css') {
      elements = Array.from(document.querySelectorAll(query));
    } else if (mode === 'xpath') {
      const result = document.evaluate(
        query,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      for (let i = 0; i < result.snapshotLength; i++) {
        elements.push(result.snapshotItem(i));
      }
    }

    elements.forEach((element) => {
      if (element.nodeType === Node.ELEMENT_NODE) {
        element.classList.add(HIGHLIGHT_CLASS);
      }
    });

    return elements.length;
  } catch (error) {
    throw new Error(`Invalid ${mode === 'css' ? 'CSS selector' : 'XPath'}: ${error.message}`);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'search') {
    try {
      initializeStyles();
      clearHighlights();

      let count = 0;

      if (request.useElementSearch) {
        count = searchElements(request.query, request.elementSearchMode);
      } else {
        count = searchText(request.query, request.useRegex);
      }

      sendResponse({ success: true, count: count });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === 'clear') {
    clearHighlights();
    sendResponse({ success: true });
  }

  return true; // Keep the message channel open for async response
});
