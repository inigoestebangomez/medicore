# apps/stats-service/app/routers/crosstab.py
# POST /internal/cross-tab — contingency table with chi-square/Fisher,
# odds ratio (2x2) and N<5 suppression (BR-RES-004). Mirrors CrossTabResult.

from __future__ import annotations

from typing import List

from fastapi import APIRouter

from ..schemas import CrossTabCell, CrossTabRequest, CrossTabResult
from ..services import stats as S

router = APIRouter()

SUPPRESSION = 5  # BR-RES-004


@router.post("/internal/cross-tab")
def cross_tab(req: CrossTabRequest) -> CrossTabResult:
    data = req.data or {}
    pairs = data.get("pairs", [])  # [{rowValue, colValue}, ...] (TS sends this shape)
    rows: List[str] = []
    cols: List[str] = []
    grid: dict = {}
    for pair in pairs or []:
        r = str(pair.get("rowValue"))
        c = str(pair.get("colValue"))
        if r not in rows: rows.append(r)
        if c not in cols: cols.append(c)
        grid[(r, c)] = grid.get((r, c), 0) + 1

    cells = []
    row_totals = []
    col_totals = [0] * len(cols)
    for r in rows:
        row_total = 0
        row_cells = []
        for ci, c in enumerate(cols):
            count = grid.get((r, c), 0)
            row_total += count
            col_totals[ci] += count
            row_cells.append(CrossTabCell(count=count, suppressed=count < SUPPRESSION))
        cells.append(row_cells)
        row_totals.append(row_total)
    grand = sum(row_totals)

    chi2 = chi2p = fisher_p = odds_ratio = None
    odds_ci = None
    warnings: List[str] = []
    try:
        table = [[grid.get((r, c), 0) for c in cols] for r in rows]
        chi2, chi2p, _, exp = S.chi_square(table)
        if any(e < SUPPRESSION for e in exp) and len(rows) == 2 and len(cols) == 2:
            f = S.fisher_exact(table)
            fisher_p = f["pValue"]
            es = f["effectSize"]
            odds_ratio = es["value"]
    except Exception as exc:  # graceful — never 5xx
        warnings.append(f"cross_tab_error: {exc}")

    return CrossTabResult(
        rowField=req.rowField, colField=req.colField,
        rows=rows, cols=cols, cells=cells,
        rowTotals=row_totals, colTotals=col_totals, grandTotal=grand,
        chiSquare=chi2, chiSquareP=chi2p, fisherExactP=fisher_p,
        oddsRatio=odds_ratio, oddsRatioCi95=odds_ci, warnings=warnings,
    )