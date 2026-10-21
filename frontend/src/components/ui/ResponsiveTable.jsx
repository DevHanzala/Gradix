import { useTranslation } from "react-i18next";
/**
 * A table on medium+ screens that turns into stacked cards on phones.
 *
 * columns: [{ key, header, render?(row), className?, primary? }]
 *   - `primary` columns become the card title on mobile.
 * rows: array of objects; rowKey: (row) => key
 * actions?(row): node rendered in the last column / card footer.
 * breakpoint: "md" (default) or "lg" — where the table replaces the cards.
 *   Use "lg" for wide rows (e.g. inline form controls).
 */
const BREAKPOINTS = {
  md: { table: "hidden md:block", cards: "md:hidden" },
  lg: { table: "hidden lg:block", cards: "lg:hidden" },
};

function ResponsiveTable({ columns, rows, rowKey = (row) => row.id, actions, caption, breakpoint = "md" }) {
  const { t } = useTranslation();
  const bp = BREAKPOINTS[breakpoint] || BREAKPOINTS.md;
  const cell = (column, row) => (column.render ? column.render(row) : row[column.key]);
  const primary = columns.filter((c) => c.primary);
  const secondary = columns.filter((c) => !c.primary);

  return (
    <>
      {/* Desktop / tablet */}
      <div className={`${bp.table} overflow-x-auto`}>
        <table className="min-w-full divide-y divide-line text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-3 text-start font-semibold text-ink-muted ${c.className || ""}`}>
                  {c.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-4 py-3 text-end font-semibold text-ink-muted">
                  <span className="sr-only">{t("common.actions")}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle text-ink ${c.className || ""}`}>
                    {cell(c, row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-end">
                    <div className="flex flex-wrap justify-end gap-2">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className={`divide-y divide-line ${bp.cards}`}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="space-y-2 p-4">
            {primary.map((c) => (
              <div key={c.key} className="font-semibold text-ink">
                {cell(c, row)}
              </div>
            ))}
            {secondary.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {secondary.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-ink-subtle">{c.header}</dt>
                    <dd className="truncate text-ink">{cell(c, row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="flex flex-wrap gap-2 pt-1">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

export default ResponsiveTable;
