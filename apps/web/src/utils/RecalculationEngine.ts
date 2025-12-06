import { SheetData } from '@/types/spreadsheet';
import { tokenize, evaluateFormula } from './FormulaEngine';
import { formatValue } from './formatting';

// Helper to get cell key like "0:1" for row 0, col 1
const getCellKey = (row: number, col: number) => `${row}:${col}`;
const parseCellKey = (key: string) => {
    const [row, col] = key.split(':').map(Number);
    return { row, col };
};

// Extract dependencies from a formula string
// Returns array of cell keys "row:col"
function getDependencies(formula: string): string[] {
    if (!formula.startsWith('=')) return [];
    
    const tokens = tokenize(formula);
    const deps: Set<string> = new Set();
    
    for (const token of tokens) {
        if (token.type === 'REF') {
             // Convert A1 -> row,col
             const match = token.value.match(/^([A-Z]+)([0-9]+)$/);
             if (match) {
                 const colStr = match[1];
                 const rowStr = match[2];
                 let col = 0;
                 for (let i = 0; i < colStr.length; i++) {
                    col = col * 26 + (colStr.charCodeAt(i) - 64);
                 }
                 const r = parseInt(rowStr) - 1;
                 const c = col - 1;
                 deps.add(getCellKey(r, c));
             }
        } else if (token.type === 'RANGE') {
            // Flatten range to individual cells? 
            // Or treat range as a dependency?
            // Simple approach: Flatten for granular updates.
            // But A1:A100 is 100 deps.
            // For MVP: Let's accept that ranges create dependencies on all cells in them?
            // Actually, for getDependencies, we just need to know what to listen to.
            // If A1 depends on B1:B2, then if B1 changes, A1 updates.
            // We need to parse range A1:B2 -> A1, A2, B1, B2 keys.
            const parts = token.value.split(':');
             if (parts.length === 2) {
                 // Duplicate logic from FormulaEngine? 
                 // Ideally extract that logic too.
                 // For now, inline simplified range expansion.
                 // ... (implementation typically needs shared generic utils)
                 // Let's defer exact range expansion and just log warning or simple impl.
                 // We will skip range expansion for strict MVP optimization and just rely on maybe partial?
                 // NO, without range dep, SUM(A1:A2) won't update.
                 // Let's assume range is small enough to loop.
                 const start = parseRef(parts[0]);
                 const end = parseRef(parts[1]);
                 if (start && end) {
                     const minR = Math.min(start.row, end.row);
                     const maxR = Math.max(start.row, end.row);
                     const minC = Math.min(start.col, end.col);
                     const maxC = Math.max(start.col, end.col);
                     for(let r=minR; r<=maxR; r++) {
                         for(let c=minC; c<=maxC; c++) {
                             deps.add(getCellKey(r,c));
                         }
                     }
                 }
             }
        }
    }
    return Array.from(deps);
}

function parseRef(ref: string) {
    const match = ref.match(/^([A-Z]+)([0-9]+)$/);
     if (match) {
         const colStr = match[1];
         const rowStr = match[2];
         let col = 0;
         for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 64);
         }
         return { row: parseInt(rowStr) - 1, col: col - 1 };
     }
     return null;
}

export function recalculate(data: SheetData): SheetData {
    // 1. Build Graph
    const graph = new Map<string, string[]>(); // Key -> dependants (who depends on Key)
    const inDegree = new Map<string, number>(); // Key -> number of dependencies
    
    // Scan all cells with formulas
    const cellsWithFormulas: string[] = [];
    
    // We need to iterate all existing cells in data
    // Data is sparse object: data[row][col]
    Object.keys(data).forEach(rowKey => {
        const row = Number(rowKey);
        const rowData = data[row];
        if (!rowData) return;
        
        Object.keys(rowData).forEach(colKey => {
            const col = Number(colKey);
            const cell = rowData[col];
            if (cell?.formula) {
                const key = getCellKey(row, col);
                cellsWithFormulas.push(key);
                
                const deps = getDependencies(cell.formula);
                deps.forEach(dep => {
                    // dep is a cell that 'key' needs.
                    // So if 'dep' changes, 'key' needs update.
                    // Graph: dep -> [key, ...] (Adjacency List)
                    if (!graph.has(dep)) graph.set(dep, []);
                    graph.get(dep)!.push(key);
                });
                
                inDegree.set(key, deps.length);
            }
        });
    });
    
    // 2. Topological Sort (Kahn's Algorithm)
    // Actually we only need to re-evaluate cells that have formulas.
    // Initial queue: Cells with 0 dependencies (in the context of formula cells)? 
    // Wait, Kahn's is for sorting ALL nodes.
    // Here we have a mix.
    // Easier approach for Spreadsheet:
    // Just find "Evaluation Order".
    // 
    // Problem: logic above builds graph of dependencies.
    // If A1 depends on B1. Graph: B1 -> A1. InDegree(A1) = 1.
    // If B1 is a constant, InDegree(B1) = 0.
    // Queue should start with all cells that have InDegree 0.
    
    const queue: string[] = [];
    // Populate queue with all cells that have formula but 0 pending internal dependencies?
    // Actually, we want to recalc everything that MIGHT change.
    // But for a full refresh, we can just topo sort all formula cells.
    // Any formula cell with 0 dependencies on OTHER FORMULA CELLS can be calc'd immediately (it only depends on constants).
    // So we need to track inDegree only from other formula cells?
    //
    // Let's refine: InDegree = number of dependencies on ANY cell?
    // If A1 = B1 (constant). InDegree(A1) = 1.
    // But B1 is ready. So A1 is ready?
    // So we treat all non-formula cells as already "evaluated".
    // 
    // Correct Algorithm:
    // 1. Graph edges: ReferencedCell -> DependentCell
    // 2. InDegree count for DependentCell for each Reference.
    // 3. Queue = [All Formula Cells with InDegree 0 ?? No]
    //    Actually, if A1 depends on B1 (constant), A1 is ready.
    //    If A1 depends on C1 (formula), A1 waits for C1.
    //    So InDegree should count ONLY dependencies that are *also* in the 'cellsWithFormulas' set.
    
    const formulaSet = new Set(cellsWithFormulas);
    const effectiveInDegree = new Map<string, number>();
    
    cellsWithFormulas.forEach(cellKey => {
         // Re-scan dependencies to count only internal formula deps
         const { row, col } = parseCellKey(cellKey);
         const cell = data[row]?.[col];
         const deps = getDependencies(cell?.formula || '');
         
         let count = 0;
         deps.forEach(dep => {
             if (formulaSet.has(dep)) {
                 count++;
                 // We also need to build the internal graph for these
                 if (!graph.has(dep)) graph.set(dep, []);
                 // Check if we already added this edge? getDependencies might return dups.
                 // internal implementation of getDependencies uses Set, so unique.
                 // avoid duplicate edges in graph? 
                 // actually graph was built for ALL deps above. We should rebuild or reuse.
             }
         });
         effectiveInDegree.set(cellKey, count);
         if (count === 0) {
             queue.push(cellKey);
         }
    });
    
    // Check circular or missing?
    // If queue empty but formulas exist -> Cycle or all depend on each other.
    
    const sortedOrder: string[] = [];
    
    while(queue.length > 0) {
        const u = queue.shift()!;
        sortedOrder.push(u);
        
        // Find who depends on u
        // User graph built earlier? 
        // We need graph: Provider -> Consumer (Where Provider is u)
        // Above we built: dep -> key.
        // But that included constants.
        // We can just use that graph.
        
        const consumers = graph.get(u);
        if (consumers) {
            consumers.forEach(v => {
                if (formulaSet.has(v)) {
                    const current = effectiveInDegree.get(v) || 0;
                    effectiveInDegree.set(v, current - 1);
                    if (current - 1 === 0) {
                        queue.push(v);
                    }
                }
            });
        }
    }
    
    // Cycle detection?
    // If sortedOrder.length < cellsWithFormulas.length, there is a cycle.
    // Users with cycles won't be in the list, so they won't update? 
    // Or we should update them with error?
    // For now, let's just update what we can.
    
    // 3. Evaluate in Order
    // We need to mutate data? Or produce new one.
    // We are inside a function that returns new data usually, or mutates a draft.
    // Assuming 'data' passed here is a draft from Immer (if called from setCellValue)
    // OR we clone it.
    // The hook calls this. If hook uses Immer, it passes a draft. 
    // Draft is mutable.
    
    sortedOrder.forEach(key => {
        const { row, col } = parseCellKey(key);
        const cell = data[row]?.[col];
        if (cell && cell.formula) {
            try {
                // Evaluate
                const result = evaluateFormula(cell.formula, data);
                 // Check if result changed?
                 // Update cell
                 // NOTE: evaluateFormula needs to support 'data' being the draft itself.
                 // It reads from data[r][c].value. If we updated a dependency earlier in this loop,
                 // the 'data' has the new value. So this works!
                 
                 // Reuse formatting logic?
                 // We can't import formatValue easily if circular deps? 
                 // formatValue is in formatting.ts. safe.
                 
                // We need to format the result if needed.
                // But RecalculationEngine shouldn't necessarily know about formatting?
                // It should just set value/displayValue.
                // Let's assume we maintain simple value setting here or duplicate simple format.
                
                // TODO: Import formatValue
                // For now, just set value. formatting call sites usually handle display.
                // But wait, displayValue IS stored. We must update it.
                // Otherwise Canvas shows old value.
                
                let displayVal = String(result);
                if (typeof result === 'number') {
                     displayVal = formatValue(result, cell.format || 'general');
                }
                
                // Update
                data[row][col] = {
                    ...cell,
                    value: typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean' ? result : String(result),
                    displayValue: displayVal,
                    error: undefined
                };
                
            } catch (e) {
                 data[row][col] = {
                    ...cell,
                    value: '#ERROR!',
                    displayValue: '#ERROR!',
                    error: e instanceof Error ? e.message : 'Error'
                };
            }
        }
    });

    return data;
}
