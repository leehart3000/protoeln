import type { TableCellNode, TableNode } from './types.ts'

// A table as a grid, for copies that can't merge cells (plain text and Markdown): each row has
// a place for every column, and the places a merged cell covers, to its right and below, are
// null. So the columns still line up.
export function tableGrid(table: TableNode): (TableCellNode | null)[][] {
  const grid: (TableCellNode | null)[][] = table.content.map(() => [])
  table.content.forEach((row, r) => {
    let column = 0
    for (const cell of row.content) {
      while (grid[r]![column] !== undefined) column += 1
      const colspan = cell.attrs?.colspan ?? 1
      const rowspan = cell.attrs?.rowspan ?? 1
      for (let down = 0; down < rowspan && r + down < grid.length; down += 1) {
        for (let across = 0; across < colspan; across += 1) {
          grid[r + down]![column + across] = down === 0 && across === 0 ? cell : null
        }
      }
      column += colspan
    }
  })
  const width = Math.max(0, ...grid.map((row) => row.length))
  return grid.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null))
}
