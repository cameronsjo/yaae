import { setIcon } from 'obsidian';

/**
 * Creates a collapsible accordion section in a settings container.
 *
 * Returns the content container — append Setting items to it.
 * Expand/collapse state is tracked in the provided Set, so it
 * persists across tab switches (re-renders of display()).
 */
export function createCollapsibleSection(
  containerEl: HTMLElement,
  expandedSections: Set<string>,
  id: string,
  title: string,
  defaultExpanded = false,
): HTMLElement {
  // Seed default state on first render
  if (!expandedSections.has(`__init_${id}`)) {
    expandedSections.add(`__init_${id}`);
    if (defaultExpanded) {
      expandedSections.add(id);
    }
  }

  const isExpanded = expandedSections.has(id);

  // Header row — clickable with chevron
  const header = containerEl.createDiv({
    cls: `yaae-section-header${isExpanded ? ' is-expanded' : ''}`,
  });

  const chevron = header.createSpan({ cls: 'yaae-section-chevron' });
  setIcon(chevron, 'chevron-right');

  header.createSpan({ text: title, cls: 'yaae-section-title' });

  // Content container — hidden when collapsed
  const content = containerEl.createDiv({
    cls: `yaae-section-content${isExpanded ? ' is-expanded' : ''}`,
  });

  // Toggle on click
  header.addEventListener('click', () => {
    const expanding = !expandedSections.has(id);
    if (expanding) {
      expandedSections.add(id);
    } else {
      expandedSections.delete(id);
    }
    header.toggleClass('is-expanded', expanding);
    content.toggleClass('is-expanded', expanding);
  });

  return content;
}
