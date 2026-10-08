# 支付统一政策

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

## 核心原则
1. 先确认项目 payment 原始单位，再计算金额。
2. 首日付费只取注册/创角当天真实 pay_log。
3. 累计付费按明确的截止日或历史范围累计。
4. 首日分层与累计分层不得混用。
5. 付费人数和流水必须使用同一有效订单口径。
6. order_id 若可能重复，应先核查重复，再决定是否去重。

## 现金与代币
当项目存在 payment / token_payment：
- 不允许无脑相加，避免同单重复。
- 若专题明确“现金优先，现金为0再用代币”，则按该规则。
- 代金券、直充、钻石等是否排除必须按项目专题确认。

## 商品维表
product_id + product_name 关联失败时，应先做 unmatched 核查，不直接把未匹配商品归到错误分类。

## 项目单位
- 下方了 v41：pay_log.payment 单位分，金额 /100 转元。
- 暴弹飞射 v42：pay_log.payment 单位元，禁止 /100。
- 弯月勇者 v44：单位未被当前专题明确验证时，不自行假设 /100。
- 步步 v22：按项目已验证 SQL/专题规则，不跨项目套用单位。

## 下方了现金+代币常用规则
在“排除代金券、保留钻石、现金+代币实际消费”专题：
- 先按已确认 product_type/product_type_two 排除代金券。
- payment>0 取 payment/100。
- payment=0 或空且 token_payment>0 时取 token_payment/100。
- 不同时累加 payment 与 token_payment。
