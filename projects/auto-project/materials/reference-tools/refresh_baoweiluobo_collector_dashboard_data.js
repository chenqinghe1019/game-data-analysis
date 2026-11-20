(async () => {
  const token = JSON.parse(localStorage.getItem("ACCESS_TOKEN") || "null");
  if (!token) throw new Error("Not logged in");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const configRes = await fetch('/v1/ta/event/reportsearch?projectId=15&reportId=4945&searchSource=model_search', { headers });
  const configJson = await configRes.json();
  const report = configJson.data || {};
  const parse = (value) => {
    if (typeof value !== 'string') return value || {};
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  };
  const qp = {
    events: parse(report.events),
    eventView: parse(report.eventView),
    visualView: parse(report.visualView),
  };
  const store = window.__DVA_APP_MAP__?.static?._store;
  if (!store) throw new Error('TA store unavailable');
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    store.dispatch({
      type: 'sql/fetchSqlQuery',
      payload: {
        projectId: 15,
        requestId: `codex_collector_dashboard_${Date.now()}`,
        qp: JSON.stringify(qp),
        eventModel: 10,
        querySource: 'dashboard',
        searchSource: 'dashboard_report_search',
      },
      cb: (res) => {
        store.dispatch({ type: 'panel/saveDashbordEventMap', payload: { 4945: res } });
        const rows = res?.data?.rows || [];
        const latest = rows.map((r) => r[0]).sort().slice(-1)[0];
        const metricCounts = {};
        for (const row of rows.filter((r) => r[0] === latest)) metricCounts[row[1]] = (metricCounts[row[1]] || 0) + 1;
        finish({
          isSuccess: res?.data?.isSuccess,
          errorMsg: res?.data?.errorMsg,
          headers: res?.data?.headers,
          rowCount: rows.length,
          latestDate: latest,
          latestMetricRowCounts: metricCounts,
        });
      },
      errorCallback: (err) => finish({ error: String(err?.message || err || 'query failed') }),
    });
    setTimeout(() => finish({ error: 'timeout' }), 30000);
  });
})()
