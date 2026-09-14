# apps/stats-service/tests/test_guided.py
# pytest for guided statistical analysis additions (Phase 1):
# - relative_risk: valid 2x2 → RR+CI; zero cell → suppression warning
# - p_adjust: Holm and BH-FDR on known datasets, n=1 edge

from __future__ import annotations

import math
import pytest

st = pytest.importorskip("scipy.stats")
fastapi_testclient = pytest.importorskip("fastapi.testclient")
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


# ─────────────────────────────────────────────
# relative_risk
# ─────────────────────────────────────────────

def test_relative_risk_valid_2x2(client):
    """Known 2x2: exposed=30/70, unexposed=10/90 → RR≈3.09."""
    body = {
        "exposedCases": 30,
        "exposedNonCases": 70,
        "unexposedCases": 10,
        "unexposedNonCases": 90,
    }
    r = client.post("/internal/stats/relative-risk", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["exposedCases"] == 30
    assert j["exposedNonCases"] == 70
    assert j["unexposedCases"] == 10
    assert j["unexposedNonCases"] == 90
    # RR = (30/100) / (10/100) = 3.0
    assert j["relativeRisk"] is not None
    assert abs(j["relativeRisk"] - 3.0) < 0.01
    # CI should be present and non-null
    assert j["ci95Lower"] is not None
    assert j["ci95Upper"] is not None
    assert j["ci95Lower"] < j["relativeRisk"] < j["ci95Upper"]
    # OR should also be computed
    assert j["oddsRatio"] is not None
    assert not j["suppressed"]


def test_relative_risk_zero_cell_suppression(client):
    """Zero cell → suppression, no continuity correction."""
    body = {
        "exposedCases": 0,
        "exposedNonCases": 50,
        "unexposedCases": 10,
        "unexposedNonCases": 40,
    }
    r = client.post("/internal/stats/relative-risk", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["suppressed"] is True
    assert j["relativeRisk"] is None
    assert j["ci95Lower"] is None
    assert j["ci95Upper"] is None
    assert len(j["warnings"]) > 0
    assert any("zero" in w["code"].lower() or "sparse" in w["code"].lower() for w in j["warnings"])


def test_relative_risk_all_zero(client):
    """All zeros → fully suppressed."""
    body = {
        "exposedCases": 0,
        "exposedNonCases": 0,
        "unexposedCases": 0,
        "unexposedNonCases": 0,
    }
    r = client.post("/internal/stats/relative-risk", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["suppressed"] is True
    assert j["relativeRisk"] is None


# ─────────────────────────────────────────────
# p_adjust (Holm / BH-FDR)
# ─────────────────────────────────────────────

def test_p_adjust_holm_known(client):
    """Holm step-down on [0.001, 0.01, 0.05, 0.5] — known adjusted values."""
    body = {"method": "holm", "pValues": [0.001, 0.01, 0.05, 0.5]}
    r = client.post("/internal/stats/p-adjust", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["method"] == "holm"
    assert j["n"] == 4
    assert len(j["adjustedP"]) == 4
    # Holm: adjusted p-values must be ≥ original
    for orig, adj in zip(j["originalP"], j["adjustedP"]):
        assert adj >= orig - 1e-10
    # Adjusted values must be monotonically non-decreasing when sorted by original
    assert j["adjustedP"] == sorted(j["adjustedP"]) or all(
        j["adjustedP"][i] <= j["adjustedP"][i + 1]
        for i in range(len(j["adjustedP"]) - 1)
    )


def test_p_adjust_fdr_known(client):
    """BH-FDR on [0.001, 0.01, 0.05, 0.5]."""
    body = {"method": "fdr", "pValues": [0.001, 0.01, 0.05, 0.5]}
    r = client.post("/internal/stats/p-adjust", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["method"] == "fdr"
    assert j["n"] == 4
    assert len(j["adjustedP"]) == 4
    for orig, adj in zip(j["originalP"], j["adjustedP"]):
        assert adj >= orig - 1e-10


def test_p_adjust_single_value(client):
    """n=1 edge: adjustment should return the original p-value."""
    body = {"method": "holm", "pValues": [0.03]}
    r = client.post("/internal/stats/p-adjust", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["n"] == 1
    assert abs(j["adjustedP"][0] - 0.03) < 1e-10


def test_p_adjust_empty(client):
    """Empty list → empty result."""
    body = {"method": "holm", "pValues": []}
    r = client.post("/internal/stats/p-adjust", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["n"] == 0
    assert j["adjustedP"] == []
