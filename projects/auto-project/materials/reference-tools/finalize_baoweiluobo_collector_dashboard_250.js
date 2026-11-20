(async () => {
  const token = JSON.parse(localStorage.getItem("ACCESS_TOKEN") || "null");
  if (!token) throw new Error("Not logged in");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const readRes = await fetch('/v1/ta/dashboard/search-dashboard?dashboardId=250&dashbordId=250&projectId=15&useCache=false&useDashboardFilter=false', { method: 'POST', headers });
  const readJson = await readRes.json();
  if (readJson?.return_code !== 0) throw new Error(readJson?.return_message || 'dashboard read failed');
  const data = readJson.data;
  const reports = (data.eventReportList || []).map((r) => Number(r.reportId) === 4945 ? { ...r, reportWidth: 1 } : r);
  if (!reports.some((r) => Number(r.reportId) === 4945)) throw new Error('report 4945 is not mapped to dashboard 250');
  let ui = {};
  try { ui = typeof data.uiConfig === 'string' ? JSON.parse(data.uiConfig) : (data.uiConfig || {}); } catch {}
  const layout = (ui.layout || []).filter((item) => String(item.i) !== '4945');
  const nextY = layout.reduce((max, item) => Math.max(max, Number(item.y || 0) + Number(item.h || 0)), 0);
  layout.push({ i: '4945', x: 0, y: nextY, w: 20, h: 10 });
  ui.layout = layout;
  ui.version = ui.version || '4.3.0';
  const updateRes = await fetch('/v1/ta/dashboard/update-dashboard?projectId=15', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({ dashboardId: 250, reportsVersion: data.reportsVersion, reports, uiConfig: JSON.stringify(ui) }),
  });
  const updateJson = await updateRes.json();
  if (updateJson?.return_code !== 0) throw new Error(updateJson?.return_message || 'dashboard update failed');
  const version = updateJson?.data?.reportsVersion ?? data.reportsVersion;
  const editQs = new URLSearchParams({
    projectId: '15', dashbordId: '250', dashboardId: '250', reportId: '4945',
    reportWidth: '1', reportGraphShape: 'L19', reportsVersion: String(version),
  });
  const editRes = await fetch(`/v1/ta/dashbord/editDashboardReport?${editQs}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: '',
  });
  const editJson = await editRes.json();
  if (editJson?.return_code !== 0) throw new Error(editJson?.return_message || 'dashboard report refresh failed');
  return { code: updateJson.return_code, editCode: editJson.return_code, reportsVersion: editJson?.data?.reportsVersion ?? version, layout: layout.find((item) => item.i === '4945') };
})()
