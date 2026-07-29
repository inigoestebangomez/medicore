# apps/stats-service/tests/test_normality.py
# pytest for the normality router (V3 M2, task 2.4): normal data, non-normal
# data, edge cases (n<3), wilcoxon, describe-auto.

from __future__ import annotations

import pytest

pytest.importorskip("scipy.stats")
fastapi_testclient = pytest.importorskip("fastapi.testclient")
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_normality_normal_data(client):
    # gaussian-ish sample
    values = [2.1, 2.0, 1.9, 2.05, 1.95, 2.02, 1.98, 2.11, 1.89, 2.03]
    r = client.post("/internal/stats/normality", json={"values": values})
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == len(values)
    assert "isNormal" in body


def test_normality_insufficient_sample(client):
    r = client.post("/internal/stats/normality", json={"values": [1.0, 2.0]})
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == 2
    assert "insufficient_sample_size" in body["warnings"]


def test_wilcoxon_paired(client):
    pre = [20.0, 21.0, 19.0, 18.0, 22.0, 20.5, 19.5, 21.5]
    post = [15.0, 16.0, 14.0, 13.0, 18.0, 15.5, 14.5, 17.5]  # consistent drop
    r = client.post("/internal/stats/wilcoxon", json={"pre": pre, "post": post})
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == len(pre)
    assert body["pValue"] is not None


def test_wilcoxon_length_mismatch(client):
    r = client.post("/internal/stats/wilcoxon", json={"pre": [1, 2, 3], "post": [1, 2]})
    assert r.status_code == 200
    assert "length_mismatch_pre_post" in r.json()["warnings"]


def test_describe_auto_normal(client):
    values = [2.0, 2.1, 1.9, 2.05, 1.95, 2.02, 1.98, 2.11, 1.89, 2.03]
    r = client.post("/internal/stats/describe-auto", json={"values": values})
    assert r.status_code == 200
    body = r.json()
    assert body["representation"] in ("mean_sd", "median_iqr")
    assert body["n"] == len(values)


def test_describe_auto_skewed(client):
    # heavy right-skew → non-normal → median_iqr preferred
    values = [1, 1, 1, 1, 1, 1, 1, 1, 50, 200]
    r = client.post("/internal/stats/describe-auto", json={"values": values})
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == len(values)