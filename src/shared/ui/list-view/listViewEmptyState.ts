type TranslateFn = (key: string) => string;

export type ListViewEmptyStateInput = {
  baseRowCount: number;
  visibleRowCount: number;
  searchActive: boolean;
  filtersActive: boolean;
};

export type ListViewEmptyStateContent = {
  title: string;
  hint: string;
};

function tOrFallback(t: TranslateFn, key: string, fallback: string): string {
  const translated = t(key);
  if (translated === key) return fallback;
  const keyTail = key.split(".").pop();
  if (keyTail && translated === keyTail) return fallback;
  return translated.trim() === "" ? fallback : translated;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getListViewEmptyStateContent(
  input: ListViewEmptyStateInput,
  t: TranslateFn,
): ListViewEmptyStateContent | null {
  if (input.visibleRowCount > 0) return null;

  if (input.baseRowCount === 0 && !input.searchActive && !input.filtersActive) {
    return {
      title: tOrFallback(t, "doc.list.noRowsTrueEmptyTitle", "Записей пока нет"),
      hint: tOrFallback(t, "doc.list.noRowsTrueEmptyHint", ""),
    };
  }

  if (input.baseRowCount > 0 && input.searchActive && input.filtersActive) {
    return {
      title: tOrFallback(t, "doc.list.noRowsSearchAndFiltersTitle", "Нет строк по текущему поиску или фильтрам"),
      hint: tOrFallback(t, "doc.list.noRowsSearchAndFiltersHint", "Измените условия поиска или фильтрации"),
    };
  }

  if (input.baseRowCount > 0 && input.searchActive) {
    return {
      title: tOrFallback(t, "doc.list.noRowsSearchTitle", "Нет строк по текущему поиску"),
      hint: tOrFallback(t, "doc.list.noRowsSearchHint", "Измените поисковый запрос"),
    };
  }

  if (input.baseRowCount > 0 && input.filtersActive) {
    return {
      title: tOrFallback(t, "doc.list.noRowsFiltersTitle", "Нет строк по текущему фильтру"),
      hint: tOrFallback(t, "doc.list.noRowsFiltersHint", "Измените фильтр в заголовке колонки"),
    };
  }

  return {
    title: tOrFallback(t, "doc.list.noRows", "Нет строк для отображения."),
    hint: "",
  };
}

export function buildListViewEmptyStateHtmlTemplate(content: ListViewEmptyStateContent | null): string | undefined {
  if (!content) return undefined;
  const title = escapeHtml(content.title);
  const hint =
    content.hint.trim() === "" ? "" : `<div class="list-view-empty__hint">${escapeHtml(content.hint)}</div>`;
  return `<div class="list-view-empty"><div class="list-view-empty__title">${title}</div>${hint}</div>`;
}
