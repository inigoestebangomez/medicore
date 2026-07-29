# apps/stats-service/tests/test_stats.py
# pytest for the stats microservice (tasks 3.2/3.3). Verifies known datasets
# produce expected statistic/p-value/effect-size within tolerance, health
# returns ok, and cross-tab N<5 suppression applies. Uses FastAPI TestClient.
# SciPy is a hard dependency; tests skip if scipy absent (CI without deps).

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


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_independent_ttest_known_dataset(client):
    # Two well-separated groups → large |t|, small p, |cohen_d| >> 0.
    body = {"test": "ttest_independent",
            "data": {"group1": [85, 86, 88, 90, 92], "group2": [70, 72, 68, 65, 71]},
            "alpha": 0.05}
    r = client.post("/internal/stats/inferential", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["test"] == "ttest_independent"
    assert abs(j["statistic"]) > 5
    assert j["pValue"] < 0.01
    assert abs(j["effectSize"]["value"]) > 1.0  # large effect


def test_paired_ttest(client):
    body = {"test": "ttest_paired",
            "data": {"group1": [1, 2, 3, 4, 5], "group2": [2, 3, 4, 5, 6]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "ttest_paired"
    assert j["degreesFreedom"] == 4
    # Perfectly correlated paired samples → statistic has magnitude > 20 or
    # +/-inf (0 std of differences); accept either shape.
    assert abs(float(j["statistic"])) > 20 or math.isinf(float(j["statistic"]))


def test_chi_square(client):
    # 2x3 observed table
    body = {"test": "chi_square",
            "data": {"observed": [[10, 20, 30], [6, 9, 12]]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "chi_square"
    assert j["pValue"] is not None
    assert j["degreesFreedom"] == 2


def test_fisher_exact(client):
    body = {"test": "fisher_exact",
            "data": {"observed": [[1, 9], [11, 3]]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "fisher_exact"
    assert 0 <= j["pValue"] <= 1
    assert j["effectSize"]["name"] == "odds_ratio"


def test_mannwhitney(client):
    body = {"test": "mannwhitney",
            "data": {"group1": [1, 2, 3, 4, 5], "group2": [6, 7, 8, 9, 10]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "mannwhitney"
    assert j["pValue"] < 0.05


def test_pearson(client):
    # Perfect linear correlation r=1
    body = {"test": "pearson",
            "data": {"x": [1, 2, 3, 4, 5], "y": [2, 4, 6, 8, 10]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "pearson"
    assert abs(j["statistic"] - 1.0) < 1e-9


def test_kruskalwallis(client):
    body = {"test": "kruskalwallis",
            "data": {"groups": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "kruskalwallis"
    assert j["degreesFreedom"] == 2
    assert j["pValue"] is not None


def test_anova(client):
    body = {"test": "anova_oneway",
            "data": {"groups": [[1, 2, 3], [10, 12, 14], [20, 22, 24]]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "anova_oneway"
    assert j["pValue"] < 0.01


def test_survival_km_curve(client):
    body = {"test": "kaplan_meier",
            "data": {"time": [1, 2, 3, 4, 5, 6], "event": [1, 1, 0, 1, 0, 1]}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["test"] == "kaplan_meier"
    assert j["effectSize"]["name"] == "median_survival"
    # Dedicated survival route returns the full curve arrays.
    s = client.post("/internal/survival",
                    json={"timeField": "t", "eventField": "e",
                          "data": {"time": [1, 2, 3, 4, 5, 6], "event": [1, 1, 0, 1, 0, 1]}}).json()
    assert len(s["timePoints"]) > 0
    assert 0 <= s["survival"][-1] <= 1
    assert all(0 <= c <= 1 for c in s["ciLower"])
    assert all(0 <= c <= 1 for c in s["ciUpper"])


def test_logrank_two_groups(client):
    s = client.post("/internal/survival",
                    json={"timeField": "t", "eventField": "e",
                          "data": {"time": [1, 2, 3, 4, 5, 6, 7, 8],
                                   "event": [1, 1, 0, 1, 0, 1, 1, 0],
                                   "group": [0, 0, 0, 0, 1, 1, 1, 1]}}).json()
    assert s["logRankP"] is not None
    assert 0 <= s["logRankP"] <= 1


def test_cross_tab_suppression(client):
    # Every cell count < 5 → all suppressed (BR-RES-004).
    pairs = [{"rowValue": "M", "colValue": "A"}, {"rowValue": "F", "colValue": "B"}]
    j = client.post("/internal/cross-tab",
                    json={"rowField": "sex", "colField": "dx", "data": {"pairs": pairs}}).json()
    for row_cells in j["cells"]:
        for cell in row_cells:
            assert cell["suppressed"] is True or cell["count"] >= 5


def test_graceful_error_envelope(client):
    # Invalid input → 200 with a warning, never 5xx.
    body = {"test": "ttest_independent", "data": {}}
    j = client.post("/internal/stats/inferential", json=body).json()
    assert j["warnings"]
    assert j["warnings"][0]["code"] == "fit_error"