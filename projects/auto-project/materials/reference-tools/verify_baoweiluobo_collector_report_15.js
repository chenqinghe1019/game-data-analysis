(async () => {
  const token = JSON.parse(localStorage.getItem("ACCESS_TOKEN") || "null");
  if (!token) throw new Error("Not logged in");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const [reportRes, dashboardRes, deletedRes] = await Promise.all([
    fetch('/v1/ta/event/reportsearch?projectId=15&reportId=4945&searchSource=model_search', { headers }),
    fetch('/v1/ta/dashboard/search-dashboard?dashboardId=250&dashbordId=250&projectId=15&useCache=false&useDashboardFilter=false', { method: 'POST', headers }),
    fetch('/v1/ta/event/reportsearch?projectId=15&reportId=4946&searchSource=model_search', { headers }),
  ]);
  const reportJson = await reportRes.json();
  const dashboardJson = await dashboardRes.json();
  const deletedJson = await deletedRes.json();
  const report = reportJson?.data || {};
  let events = report.events, eventView = report.eventView, conf = report.graphConf?.confMap;
  if (typeof events === 'string') { try { events = JSON.parse(events); } catch {} }
  if (typeof eventView === 'string') { try { eventView = JSON.parse(eventView); } catch {} }
  if (typeof conf === 'string') { try { conf = JSON.parse(conf); } catch {} }
  const dashboard = dashboardJson?.data || {};
  let ui = dashboard.uiConfig;
  if (typeof ui === 'string') { try { ui = JSON.parse(ui); } catch {} }
  return {
    report: {
      code: reportJson?.return_code,
      reportId: report.reportId,
      reportName: report.reportName,
      inDashboards: report.inDashboards?.map((d) => ({ id: d.id, name: d.name })),
      sqlHasCollectorEvent: events?.sql?.includes('collector_goods_bind'),
      sqlHasEventTable15: events?.sql?.includes('v_event_15'),
      sqlHasUserTable15: events?.sql?.includes('v_user_15'),
      sqlHasPrdFilter: events?.sql?.includes('"env" = \'prd\''),
      sqlParams: events?.sqlVoParams,
      viewParams: eventView?.sqlViewParams,
      dimensions: conf?.groupFieds?.flat(2).map((f) => f.name),
      metrics: conf?.quotaFieds?.flat(2).map((f) => f.name),
    },
    dashboard: {
      code: dashboardJson?.return_code,
      dashboardId: dashboard.dashbordId,
      dashboardName: dashboard.dashbordName,
      collectorCards: (dashboard.eventReportList || []).filter((r) => r.reportName.startsWith('收藏家数据')).map((r) => ({ reportId: r.reportId, reportName: r.reportName })),
      layout: ui?.layout || [],
    },
    deletedDuplicate: {
      httpStatus: deletedRes.status,
      code: deletedJson?.return_code,
      name: deletedJson?.data?.reportName,
    },
  };
})()
