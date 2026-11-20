(async () => {
  const projectId = 15;
  const dashboardId = 250;
  const reportName = "收藏家数据";
  const token = JSON.parse(localStorage.getItem("ACCESS_TOKEN") || "null");
  if (!token) throw new Error("Not logged in");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const requestJson = async (path, options = {}) => {
    const res = await fetch(path, { headers, ...options });
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 1000)}`);
    const json = text ? JSON.parse(text) : {};
    if (json.return_code !== undefined && json.return_code !== 0) {
      throw new Error(`${path} return_code ${json.return_code}: ${json.return_message || text.slice(0, 1000)}`);
    }
    return json;
  };

  const postForm = (path, data) => {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) body.set(key, String(value));
    }
    return requestJson(path, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    });
  };

  const postJson = (path, data) => requestJson(path, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json;charset=UTF-8" },
    body: JSON.stringify(data),
  });

  const sql = `
WITH user_base AS (
    SELECT
        "#user_id",
        NULLIF(trim(CAST("#account_id" AS varchar)), '') AS account_id,
        CAST("user_source" AS integer) AS user_source,
        COALESCE(date("reg_time"), date("#reg_time"), date("#active_time")) AS new_date
    FROM ta.v_user_15
    WHERE CAST("user_source" AS integer) IN (7, 8, 9)
),

event_base AS (
    SELECT
        CAST("$part_date" AS date) AS report_date,
        "#user_id",
        COALESCE(CAST("goods_id" AS varchar), '未知') AS goods_id,
        CAST("goods_name" AS varchar) AS goods_name,
        CAST("goods_series_name" AS varchar) AS goods_series_name
    FROM ta.v_event_15
    WHERE "$part_event" = 'collector_goods_bind'
      AND "env" = 'prd'
      AND "$part_date" >= '2023-10-01'
),

date_spine AS (
    SELECT report_date
    FROM UNNEST(sequence(date '2023-10-01', current_date, interval '1' day)) AS t(report_date)
),

event_labeled AS (
    SELECT e.*, u.user_source
    FROM event_base e
    LEFT JOIN user_base u ON e."#user_id" = u."#user_id"
),

event_by_abo AS (
    SELECT
        report_date,
        goods_id,
        max(goods_name) AS goods_name,
        max(goods_series_name) AS goods_series_name,
        count(*) AS new_bind_count,
        count_if(user_source IN (8, 9)) AS scan_new_bind_count
    FROM event_labeled
    GROUP BY report_date, goods_id
),

daily_binding AS (
    SELECT
        report_date,
        count(*) AS new_bind_count,
        count_if(user_source IN (8, 9)) AS scan_new_bind_count
    FROM event_labeled
    GROUP BY report_date
),

daily_user AS (
    SELECT
        new_date AS report_date,
        count(DISTINCT IF(user_source IN (8, 9), "#user_id", NULL)) AS scan_new_user_count,
        count(DISTINCT IF(user_source IN (8, 9), account_id, NULL)) AS scan_new_account_count
    FROM user_base
    WHERE new_date IS NOT NULL
    GROUP BY new_date
),

cumulative_user AS (
    SELECT
        d.report_date,
        count(DISTINCT u."#user_id") AS collector_user_count,
        count(DISTINCT u.account_id) AS collector_account_count
    FROM date_spine d
    LEFT JOIN user_base u ON u.new_date <= d.report_date
    GROUP BY d.report_date
),

fixed_metric_rows AS (
    SELECT d.report_date AS "日期", '新增绑定数量' AS "指标", '全部' AS "ABO（商品ID）",
           CAST(NULL AS varchar) AS "商品名称", CAST(NULL AS varchar) AS "ABO系列名",
           COALESCE(b.new_bind_count, 0) AS "数值"
    FROM date_spine d LEFT JOIN daily_binding b ON d.report_date = b.report_date
    UNION ALL
    SELECT d.report_date, '通过扫码新增的萝卜社用户数（游客+账号）', '全部', NULL, NULL,
           COALESCE(n.scan_new_user_count, 0)
    FROM date_spine d LEFT JOIN daily_user n ON d.report_date = n.report_date
    UNION ALL
    SELECT d.report_date, '通过扫码新增的萝卜社账号', '全部', NULL, NULL,
           COALESCE(n.scan_new_account_count, 0)
    FROM date_spine d LEFT JOIN daily_user n ON d.report_date = n.report_date
    UNION ALL
    SELECT d.report_date, '收藏家累计用户数（游客+账号）', '全部', NULL, NULL,
           COALESCE(c.collector_user_count, 0)
    FROM date_spine d LEFT JOIN cumulative_user c ON d.report_date = c.report_date
    UNION ALL
    SELECT d.report_date, '收藏家累计账号数', '全部', NULL, NULL,
           COALESCE(c.collector_account_count, 0)
    FROM date_spine d LEFT JOIN cumulative_user c ON d.report_date = c.report_date
),

product_metric_rows AS (
    SELECT report_date AS "日期", '各ABO（商品ID）新增绑定数量' AS "指标", goods_id AS "ABO（商品ID）",
           goods_name AS "商品名称", goods_series_name AS "ABO系列名", new_bind_count AS "数值"
    FROM event_by_abo
    UNION ALL
    SELECT report_date, '各ABO（商品ID）新增扫码绑定数量', goods_id,
           goods_name, goods_series_name, scan_new_bind_count
    FROM event_by_abo
),

report_rows AS (
    SELECT * FROM fixed_metric_rows
    UNION ALL
    SELECT * FROM product_metric_rows
)

SELECT
    "日期" AS "日期",
    "指标" AS "指标",
    "ABO（商品ID）" AS "ABO（商品ID）",
    "商品名称" AS "商品名称",
    "ABO系列名" AS "ABO系列名",
    "数值" AS "数值"
FROM report_rows
WHERE "日期" \${Time:time1}
ORDER BY
    "日期" DESC,
    CASE "指标"
        WHEN '新增绑定数量' THEN 1
        WHEN '通过扫码新增的萝卜社用户数（游客+账号）' THEN 2
        WHEN '通过扫码新增的萝卜社账号' THEN 3
        WHEN '收藏家累计用户数（游客+账号）' THEN 4
        WHEN '收藏家累计账号数' THEN 5
        WHEN '各ABO（商品ID）新增绑定数量' THEN 6
        WHEN '各ABO（商品ID）新增扫码绑定数量' THEN 7
        ELSE 99
    END,
    "ABO（商品ID）"
`;

  const today = new Date();
  const end = new Date(today.getTime() + 86400000);
  const start = new Date(today.getTime() - 29 * 86400000);
  const fmt = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;
  };

  const sqlVoParams = [{
    paramType: "Time",
    paramDisplay: "日期区间",
    paramRemark: "",
    paramName: "time1",
    useTimezone: 0,
  }];
  const sqlViewParams = [{
    paramType: "Time",
    quota: "C060",
    recentDay: "0-30",
    startToNow: -1,
    startTime: fmt(start),
    endTime: fmt(end),
    startToYesterday: -1,
    paramName: "time1",
  }];

  const allHeaders = [
    "日期",
    "指标",
    "ABO（商品ID）",
    "商品名称",
    "ABO系列名",
    "数值",
  ];
  const dimensionHeaders = allHeaders.slice(0, 5);
  const quotaHeaders = allHeaders.slice(5);

  const makeQp = () => ({
    events: { sqlVoParams, sql },
    eventView: { sqlViewParams, requireReferredProjectPrivilege: true, requiredEvents: [] },
    visualView: {
      groupBys: dimensionHeaders.map((name) => ({
        columnType: name === "日期" ? "datetime" : "string",
        columnDesc: name,
        columnName: name,
      })),
      aggregates: quotaHeaders.map((name, index) => ({
        columnType: "number",
        index,
        analysis: "A103",
        columnDesc: name,
        columnName: name,
      })),
      filters: [], aggregateFilters: [], orderBys: [],
    },
  });

  const validate = () => new Promise((resolve) => {
    const store = window.__DVA_APP_MAP__?.static?._store;
    if (!store) return resolve({ error: "TA store unavailable" });
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    store.dispatch({
      type: "sql/fetchSqlQuery",
      payload: {
        projectId,
        requestId: `codex_collector_${Date.now()}`,
        qp: JSON.stringify(makeQp()),
        eventModel: 10,
        querySource: "sql_ide",
        searchSource: "model_search",
      },
      cb: (res) => {
        window.__collectorValidationResponse = res;
        const panelStore = window.__DVA_APP_MAP__?.static?._store;
        if (panelStore) panelStore.dispatch({ type: "panel/saveDashbordEventMap", payload: { 4945: res } });
        finish({
          isSuccess: res?.data?.isSuccess,
          errorMsg: res?.data?.errorMsg,
          headers: res?.data?.headers,
          rowCount: res?.data?.rows?.length,
          sampleRows: res?.data?.rows?.slice(0, 6),
          queryId: res?.data?.queryId,
        });
      },
      errorCallback: (err) => finish({ error: String(err?.message || err || "query failed") }),
    });
    setTimeout(() => finish({ error: "timeout" }), 30000);
  });

  const idFor = (name) => {
    let hash = 2166136261;
    for (let i = 0; i < name.length; i += 1) {
      hash ^= name.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `f_${(hash >>> 0).toString(16)}_${name.length}`;
  };

  const makeGraphPayload = (reportId) => {
    const dims = dimensionHeaders.map((name) => ({
      id: idFor(name), name,
      dataType: name === "日期" ? "datetime" : "string",
      value: `${name}@~@1`, isQuota: false, isQuotaFilter: false, chosen: false, selected: false,
    }));
    const quotas = quotaHeaders.map((name) => ({
      id: idFor(name), name, dataType: "number", value: `${name}@~@1`, isQuota: true, isQuotaFilter: false,
    }));
    const opr = {}, chartType = {}, selectedQuotaConfig = {};
    for (const quota of quotas) {
      opr[quota.value] = "sum";
      chartType[quota.value] = "LINE";
      selectedQuotaConfig[quota.value] = { isShowLabel: false, selectedQuota: quota.value, isShowMaxAndMin: false, selectedAxio: 0 };
    }
    const confMap = {
      graphType: "CROSS_TABLE",
      styleForm: {
        axisStyle: { 0: { isShowTickName: true, tickName: { type: -1 } }, 1: { isShowTickName: true, isAdaption: false, min: "", max: "" } },
        quotaStyle: { isShowLabel: false, isShowColorScale: true, isShowColTotal: false, isShowRowTotal: false, isShowMaxAndMin: false },
        dataStyle: {}, chartStyle: { xGroups: 20000 },
      },
      filterFieds: [], quotaFieds: [quotas], groupFieds: [dims, []],
      fieldOprObj: {
        nameBak: {},
        order: { "日期@~@1": { orderName: "日期@~@1", orderType: "desc", type: "order", sorted: true, isTotal: false } },
        quotaOrder: {}, format: {}, chartType, opr, normalFilter: {}, quotaFilter: {},
      },
      isClickChangeXAndY: false, selectedQuotaConfig, dataZoomStartEnd: "", isCheckedFullCalc: false,
    };
    const requisiteColumns = allHeaders.map((name, index) => ({
      alias: false, catalog: "", dimAttr: false, id: idFor(name), schema: "", table: "", fieldName: name,
      fieldOriginalType: index === 0 ? "date" : (index < 5 ? "varchar" : "bigint"),
      fieldType: index === 0 ? "datetime" : (index < 5 ? "string" : "number"),
    }));
    return { projectId, reportId, graphType: "CROSS_TABLE", confMap: JSON.stringify(confMap), requisiteColumns: JSON.stringify(requisiteColumns) };
  };

  const validation = await validate();
  if (!validation.isSuccess) throw new Error(`SQL validation failed: ${JSON.stringify(validation)}`);

  const reportList = await requestJson(`/v1/ta/event/reportlist?projectId=${projectId}&reportName=${encodeURIComponent(reportName)}&reportModel=10&pageIndex=1&pageSize=50`);
  const reportItems = Array.isArray(reportList?.data) ? reportList.data : (reportList?.data?.reports || []);
  let report = reportItems.find((item) => item.reportName === reportName);
  let created = false;
  let updated = false;
  if (!report) {
    const saved = await postForm('/v1/ta/event/reportsave', {
      projectId,
      reportModel: 10,
      reportName,
      reportDesc: '收藏家绑定、扫码新增及累计用户/账号数据；绑定事件仅统计 prd，新增与扫码来源按用户属性 user_source 判断。',
      cacheSeconds: 0,
      qp: JSON.stringify(makeQp()),
    });
    report = { reportId: Number(saved.data.reportId), reportName };
    created = true;
  } else {
    const current = (await requestJson(`/v1/ta/event/reportsearch?projectId=${projectId}&reportId=${Number(report.reportId)}&searchSource=model_search`)).data;
    await postForm('/v1/ta/event/reportedit', {
      projectId,
      reportId: Number(report.reportId),
      reportModel: current.reportModel || 10,
      reportName: current.reportName || reportName,
      reportDesc: '收藏家绑定、扫码新增及累计用户/账号数据；绑定事件仅统计 prd，新增与扫码来源按用户属性 user_source 判断。',
      cacheSeconds: current.cacheSeconds || 0,
      version: current.version,
      qp: JSON.stringify(makeQp()),
    });
    updated = true;
  }
  const reportId = Number(report.reportId);
  await postJson(`/v1/ta/event/graph/save?projectId=${projectId}&reportId=${reportId}`, makeGraphPayload(reportId));

  const dashboard = await requestJson(`/v1/ta/dashboard/search-dashboard?dashboardId=${dashboardId}&dashbordId=${dashboardId}&projectId=${projectId}&useCache=false&useDashboardFilter=false`, { method: 'POST' });
  const attached = (dashboard?.data?.eventReportList || []).some((item) => Number(item.reportId) === reportId);
  let mapping = { skipped: true, reason: 'already attached' };
  if (!attached) {
    const qs = new URLSearchParams({ projectId: String(projectId), dashboardId: String(dashboardId), reportId: String(reportId) });
    mapping = await requestJson(`/v1/ta/dashboard/create-report-mapping?${qs}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: '',
    });
  }

  return {
    projectId, dashboardId, reportId, reportName, created, updated,
    validation,
    mappingCode: mapping?.return_code,
    mappingSkipped: mapping?.skipped,
    reportUrl: `https://ta-data.feiyu.com/#/tga/ide/${projectId}_${reportId}`,
    dashboardUrl: `https://ta-data.feiyu.com/#/panel/panel/${projectId}_${dashboardId}_0`,
  };
})()
