# 「下方了」付费率_含代币消耗

核对日期：2026-11-11。依据为 TA 指标的已保存配置及关联事件属性规则。

## 指标怎么计算

`pay_rate_all` 是「数据 → 指标」中用事件分析创建的计算指标。分子是满足以下条件的「付费（`pay_log`）」触发用户数，分母是「登录登出（`in_out_log`）」触发用户数。分母事件项的筛选为空。复现具体报表时另核对报表的分析主体、日期和全局筛选。

- 「支付金额_商品组合（用于代币金额关联）」大于 0，**或**「支付金额_含代币消耗」大于 0。
- **且**「礼包小类_商品ID+昵称」不等于「代金券」。

指标详情页的简式只显示两个事件的触发用户数相除。查看「前往编辑 → 指标口径」中每个事件旁的漏斗图标才能读到完整条件。查完退出编辑。

## 三个字段怎么来

| 条件用到的字段 | 来源和用途 |
| --- | --- |
| 支付金额_商品组合（`#vp@product_concat@payment`） | `#vp@product_concat` 用 `concat(product_type,cast(cast(product_id as bigint) as varchar),product_name)` 生成关联键，从商品组合维度表 `dim_41_0_vprop_sql_1429` 取数值列 `payment`。数据表页展示手工上传的 `product_concat`，用商品组合作为主键。该金额是商品映射值。 |
| 支付金额_含代币消耗（`#vp@payment_all_exclude_coupon`） | 仅关联 `pay_log` 的数值虚拟事件属性。先把非钻石直充归零。其余订单优先用正的 `payment/100`，没有正现金时用正的 `token_payment/100`，其余为 0。 |
| 礼包小类_商品ID+昵称（`#vp@product_id_name@product_type_two`） | `#vp@product_id_name` 用 `concat(cast(cast(product_id as int) as varchar),product_name)` 生成关联键，从 `dim_41_0_vprop_sql_1474` 取 `product_type_two`。指标用该分类排除代金券。 |

实际消费金额虚拟属性的 SQL 规则如下。

```sql
case
    when product_type = '直充' and not regexp_like(product_name, '钻石') then 0
    when "payment" > 0 then "payment" / 100
    when "token_payment" > 0 then "token_payment" / 100
    else 0
end
```

正金额条件是「或」，任一来源为正即可满足金额条件。非钻石直充归零发生在实际消费金额分支，该笔订单仍按整个分子条件判定。指标按触发用户数计算，两个金额来源分别判断是否大于 0。复现为 SQL 前，确认未匹配礼包小类时 TA「不等于」的空值处理及报表实际去重主体。

[TA 指标详情](https://ta-data.feiyu.com/#/data/metric/23_r?currentProjectId=41)
