# 极速冲刺埋点知识（2026-10-16）
状态：用户上传《极速冲刺-埋点说明文档.xlsx》文档确认，非线上执行验证。
原SQL对应 ta.v_event_39 / ta.v_user_39（按用户最初SQL识别，项目归属尚待线上确认）。
文档表「事件数据」包含83个正式事件，另有「用户属性」「公共事件属性」「引导节点」「增补埋点」。
主体：#account_id为角色ID，nb_open_id为星云聚合ID，region_id为区服，domain=release为正式服。文档的create_role_time标注及历史SQL时间戳转换存在类型歧义，必须实际typeof确认。

## 事件清单
系统/基础：ta_app_install,ta_app_start,ta_app_end,ta_app_crash,active_log,register,account_login,create_role,in_out_log,online_log,guide_log,ad_log,click,pay_log。
任务招募邮件：quest_log,quest_reward,gacha_log,mail_send,mail_reward。
战斗玩法：battle_star,battle_result,battle_event_start,battle_event_end,battle_turn_start,battle_turn_end,rougue_skill_show,rougue_skill,boss_battle_result,daily_dungeon_log,pvp_log,compose_refresh,compose,battle_auto,battle_btnclick,coop_battle_invite,coop_battle_invite_result,coop_battle_start,coop_battle_result,mine_occupy_log。
成长装备：role_level_log,force_change_log,slot_uplev_log,slot_upgrade_log,hero_settle_log,hero_unsettle_log,hero_get_log,hero_cost_log,equip_put_on_log,equip_take_off_log,equip_log,equip_forge_log,equip_rarity_up_log。
神器戒指：divine_weapon_active_log,divine_weapon_starup_log,artifact_log,ring_put_log,ring_put_off_log,ring_log,ring_compose_log,ring_decompose_log,ring_purify_log,ring_purify_ok_log。
圣物战车：role_relic_active_log,role_relic_stage_up_log,role_relic_star_up_log,chariot_levelup_log,chariot_stageup_log,chariot_skin_star_up_log。
社交：rank_reward_log,rank_event,camp_log,camp_lib_talent_help_log,clan_log,clan_red_packet_log,clan_tech_log,clan_discount_log。
资产：voucher_log,money_log,item_log,hero_item_log,gift_log,pieces_log,pay_coupon_log。

## 对暴弹飞射（ta.v_event_42；依据 baodanfeshe_tracking.yaml）的区别
- 文档缺同名、且没有确认等价功能：battle_event_start/end、battle_turn_start/end、coop_battle_invite/invite_result/start/result、pvp_log、daily_dungeon_log、battle_btnclick、slot_uplev_log、slot_upgrade_log、hero_settle_log、hero_unsettle_log、chariot_levelup_log、chariot_stageup_log、chariot_skin_star_up_log、click 等。
- 名称不同的候选对应（语义可能有差别）：battle_star→battle_start；battle_auto→auto_battle；quest_log→mission_finish_log；quest_reward→mission_reward_log；gacha_log→recruit_log；force_change_log→change_power_log；equip_forge_log→role_equip_forge_log；camp_log→camp_build_log；camp_lib_talent_help_log→camp_academy_help_log；mine_occupy_log→mining_log；clan_red_packet_log→guild_red_envelope_log；clan_discount_log→guild_bargain_log。
- 极速冲刺的 artifact_log（神器）不等价于暴弹 role_relic_*（圣物）；不能把 relic_id/relic_name 冒充 artifact_id/artifact_name。
- 极速冲刺 click 上报 ui_name/title/entrance；暴弹 tracking 无该事件，因此相应字段缺少确认来源。
- 极速冲刺 slot_id 来自 slot_uplev_log、slot_upgrade_log、hero_settle_log、hero_unsettle_log；暴弹没有已确认同义槽位事件。
- 极速冲刺 rougue_skill_show/rougue_skill 含 battle_time、hp_percent；暴弹同名事件 tracking 里没有确认这两个属性。因此原SQL rougue_battle_time、hp_percent 不能直接得到。
- 极速冲刺原SQL power 是事件公共属性 power（行为时战力）；暴弹 change_power_log.result 是战力变化后的数值，当前用户要求采用当天最后一次变化值，但不能把两者称为相同口径。
- 极速冲刺装备 equip_id/equip_name/level_before/level_after/star_before/star_after 与暴弹的 eid/eid_name、olv/nlv、ostar/nstar 可按具体事件映射；任务 task_id/task_name 可由暴弹 mission_* 映射。
- 暴弹数组类型实测 battle_array=array(varchar)，skill_options与skill_chosen=array(row(...))，展示使用 json_format(cast(x as json))，不可 cast(array as varchar)；battle_uid 为 double；battle_result 实际包含 True/False。
注意：「埋点文档没有」不等于线上绝对不存在；此比较只说明当前文档映射状况。
