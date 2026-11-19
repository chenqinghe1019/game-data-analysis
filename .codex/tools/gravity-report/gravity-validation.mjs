const additiveMetrics = ['ap_cost','standard_activate_cnt','standard_1day_pay_uv','standard_1day_pay_amount'];
const ratios = [
  ['standard_activate_cost','ap_cost','standard_activate_cnt'],
  ['standard_1day_pay_cost','ap_cost','standard_1day_pay_uv'],
  ['standard_1day_pay_amount_roi','standard_1day_pay_amount','ap_cost'],
];

export function canValidateProjectRollups(query) {
  return [...additiveMetrics,...ratios.map(([field])=>field)].every(field=>query?.metrics_list?.includes(field));
}

function tolerance(field,count=1) {
  return field.endsWith('_cnt') || field.endsWith('_uv') ? 0 : 0.01+0.0001*count;
}

export function validateGravityRollup(detail,total,label) {
  if (!Array.isArray(detail) || !detail.length || !total) throw new Error(label+'汇总缺少明细');
  for (const field of additiveMetrics) {
    if (!Number.isFinite(total[field]) || detail.some(row=>!Number.isFinite(row[field]))) {
      throw new Error(label+'汇总缺少指标 '+field);
    }
    const sum=detail.reduce((value,row)=>value+row[field],0);
    if (Math.abs(sum-total[field])>tolerance(field,detail.length)) {
      throw new Error(label+'汇总与明细不一致：'+field);
    }
  }
  for (const [ratio,numerator,denominator] of ratios) {
    const value=total[ratio];
    if (!Number.isFinite(value) || value<0) throw new Error(label+'汇总指标无效：'+ratio);
    const expected=total[denominator]>0 ? total[numerator]/total[denominator] : 0;
    if (Math.abs(value-expected)>0.000051) throw new Error(label+'汇总的成本或 ROI 与基础指标不一致：'+ratio);
  }
}

export function parseProjectRollups(query,result,date) {
  const groups=query?.data_list;
  const totals=result?.data?.list;
  if (result?.code!==0 || query?.data_dims?.[0]!=='app_id' ||
      !Array.isArray(query.date_list) || query.date_list.length!==2 || query.date_list.some(day=>day!==date) ||
      !Array.isArray(groups) || groups.length<2 || !Array.isArray(totals) || totals.length!==groups.length) {
    throw new Error('引力项目汇总的日期、维度或记录数不完整');
  }
  const apps=new Map();
  const allIds=new Set(groups[0].map(row=>String(row.app_id)));
  validateGravityRollup(groups[0],totals[0],'全盘');
  for (let index=1;index<groups.length;index++) {
    const group=groups[index];
    const id=String(group?.[0]?.app_id);
    const keys=new Set(group?.map(row=>row.parentId?.split('-')[0]));
    if (!/^\d+$/.test(id) || !group.length || apps.has(id) || !allIds.has(id) ||
        group.some(row=>String(row.app_id)!==id || row.field!=='operator_id') ||
        keys.size!==1 || !/^\d+$/.test([...keys][0] ?? '')) {
      throw new Error('引力项目汇总无法唯一对应 APPID '+id);
    }
    validateGravityRollup(group,totals[index],'APPID '+id);
    apps.set(id,{key:[...keys][0],metrics:totals[index]});
  }
  if (apps.size!==allIds.size) throw new Error('引力项目汇总缺少或重复 APPID');
  validateGravityRollup([...apps.values()].map(app=>app.metrics),totals[0],'全盘项目');
  return {kind:'hierarchy',total:totals[0],apps};
}

export function applyVerifiedGravityMetrics(metrics,source,report,standardMetrics,defaultFields,label) {
  if (!metrics || !source || Math.abs(metrics.spend-source.ap_cost)>0.015) {
    throw new Error(label+'的网页消耗与本次汇总不一致');
  }
  for (const [field,key] of Object.entries(standardMetrics)) {
    if (!report.fields[field] || report.fields[field]!==defaultFields[field]) continue;
    if (!Number.isFinite(source[key])) throw new Error(label+'缺少已校验指标：'+report.fields[field]);
    metrics[field]=source[key];
  }
}
