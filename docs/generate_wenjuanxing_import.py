# -*- coding: utf-8 -*-
"""Build Wenjuanxing (问卷星) bulk-import text for the FPL manager survey (ZH)."""
from pathlib import Path

OUT = Path(__file__).resolve().parent / "wenjuanxing-import-zh.txt"

# Each item: (qtype, title, options or None)
# qtype: single | multi | open | rank | scale
# For multi with max: put limit in title

QUESTIONS = [
    (
        "single",
        "S1. 你目前是否在玩官方 Fantasy Premier League（FPL）？",
        ["是，本赛季", "是，但本赛季还没开始", "以前玩过", "否"],
    ),
    (
        "single",
        "S2. 你主要居住地？",
        [
            "中国大陆",
            "港澳台",
            "新马",
            "英国",
            "欧洲其他",
            "北美",
            "印度南亚",
            "中东非洲",
            "其他",
        ],
    ),
    (
        "single",
        "S3. 你更希望用哪种语言看 FPL 内容？",
        ["仅英文", "仅中文", "中英双语", "其他"],
    ),
    (
        "single",
        "Q1. 你完整打过几个 FPL 赛季？",
        ["首季", "2–3", "4–6", "7+"],
    ),
    (
        "single",
        "Q2. 你的大致排名带？（最佳成绩或目前感觉）",
        ["前1万", "前10万", "前100万", "100万以外", "不愿说"],
    ),
    (
        "multi",
        "Q3. 你玩 FPL 的主要动机是？（最多选2项）【多选题】",
        ["打败朋友小联赛", "冲总榜", "看内容社区", "学球", "随便玩玩"],
    ),
    (
        "single",
        "Q4. 一个典型 Gameweek，你大约投入多少时间？",
        ["<1小时", "1–3小时", "3–5小时", "5小时以上"],
    ),
    (
        "multi",
        "Q5. 你常用来做 FPL 决定的信息源类型有哪些？（可多选，请勿只凭品牌印象；按类型选择）【多选题】",
        [
            "官方FPL",
            "海外FPL网站或会员工具",
            "海外FPL内容创作者（YouTube、播客、X等）",
            "中文FPL创作者·公众号·KOL",
            "把海外内容翻译或改写成中文的本地帖（小红书/微信/抖音/B站等）",
            "微信群·朋友圈",
            "小红书",
            "抖音·B站等短视频",
            "Reddit·Discord·Telegram",
            "只问朋友",
            "AI聊天工具",
            "其他",
        ],
    ),
    (
        "multi",
        "Q6. 从上一题的信息源类型中，选出对你最重要的前3个（请选3项；若系统允许排序请按重要性排序）【多选题】",
        [
            "官方FPL",
            "海外FPL网站或会员工具",
            "海外FPL内容创作者（YouTube、播客、X等）",
            "中文FPL创作者·公众号·KOL",
            "把海外内容翻译或改写成中文的本地帖（小红书/微信/抖音/B站等）",
            "微信群·朋友圈",
            "小红书",
            "抖音·B站等短视频",
            "Reddit·Discord·Telegram",
            "只问朋友",
            "AI聊天工具",
            "其他",
        ],
    ),
    (
        "open",
        "Q7. （开放题，可不填）请写出你最信任的最多3个 FPL 网站/工具/创作者名称（无需提示，想到什么写什么）【填空题】",
        None,
    ),
    (
        "multi",
        "Q8. 你通常如何使用海外 FPL 内容？（可多选）【多选题】",
        [
            "直接看英文原文",
            "自己用翻译工具",
            "依赖中文创作者或翻译转载帖",
            "朋友帮忙总结",
            "很少用海外内容",
        ],
    ),
    (
        "single",
        "Q9. （若你偏中文）你对英文 FPL 分析的依赖程度？",
        ["重度依赖", "需要翻译摘要才用", "语言障碍很少用", "不用", "我主要看英文，跳过此题"],
    ),
    (
        "multi",
        "Q10. 每个 Gameweek 你觉得最难的决定是？（最多选3项）【多选题】",
        ["队长", "转会", "冷门", "板凳", "Chip", "涨跌价", "赛程", "定位球与出场时间"],
    ),
    (
        "multi",
        "Q11. 哪些工具类型你愿意付费？（可多选）【多选题】",
        [
            "xP投影",
            "预测首发",
            "转会规划",
            "赛程FDR",
            "涨跌价预测",
            "冷门与拥有率",
            "阵容评分",
            "绑定我阵容的AI分析",
            "中文每日简报",
            "只用免费",
        ],
    ),
    (
        "single",
        "Q12. 你可接受的优质 FPL 工具/会员月费是多少？（人民币）",
        [
            "不愿付",
            "¥20以下/月",
            "¥20–40/月",
            "¥40–70/月",
            "¥70–100/月",
            "¥100+/月",
            "更想买年费",
        ],
    ),
    (
        "single",
        "Q13. 你主要用什么设备做 FPL 研究？",
        ["手机", "电脑", "都用"],
    ),
    (
        "multi",
        "Q14. 你平时在哪聊或刷 FPL？（可多选）【多选题】",
        [
            "微信群",
            "朋友圈",
            "公众号",
            "小程序",
            "QQ",
            "小红书",
            "抖音B站",
            "英文平台",
            "线下朋友",
            "不聊",
        ],
    ),
    (
        "single",
        "Q15. 近一个月，你看到「明显来自海外 FPL 建议/分析、被翻译或改写」的中文帖频率？",
        ["几乎每天", "一周几次", "偶尔", "很少或没有", "不确定"],
    ),
    (
        "single",
        "Q16. 看到这类翻译/改写帖时，你通常？",
        [
            "当作主要依据",
            "当作参考之一",
            "有机会会去核对原文",
            "基本忽略",
            "没见过这类内容",
        ],
    ),
    (
        "multi",
        "Q17. 你最想要的中文 FPL 内容形态是？（最多选2项）【多选题】",
        ["短日报卡片", "长文分析", "短视频", "直播问答", "互动数据表", "AI问答"],
    ),
    (
        "single",
        "Q18. 你直接使用海外 FPL 站点/工具的最大障碍是？",
        ["语言", "付费墙", "网络访问", "不知道好的", "更信本地创作者或翻译帖", "无障碍"],
    ),
    (
        "single",
        "Q19. 你对「可信的中文 FPL 中心（海外级分析质量+工具，且标明来源）」的兴趣？",
        ["很感兴趣", "有点兴趣", "一般", "不感兴趣"],
    ),
    (
        "single",
        "Q20. 你是否用过 faleague-ai.com / FALEAGUE AI？",
        ["经常", "一两回", "听说过", "没有"],
    ),
    (
        "multi",
        "Q21. （若用过）对你最有用的部分是？（可多选；未用过可选「未用过」）【多选题】",
        [
            "AI聊天",
            "Insights位置精选",
            "季前信号",
            "规划转会",
            "赛程",
            "微信日报",
            "世界杯",
            "Mini5",
            "新闻",
            "未用过",
        ],
    ),
    (
        "scale",
        "Q22. （若用过）你向玩 FPL 的朋友推荐 FALEAGUE 的意愿？（0=完全不会，10=一定会）【量表题】",
        [str(i) for i in range(0, 11)],
    ),
    (
        "open",
        "Q23. （若用过，可不填）缺什么会让你每周回来？【填空题】",
        None,
    ),
    (
        "single",
        "Q24. 若某家知名海外 FPL 研究品牌通过中国合作伙伴提供中文内容/工具，你会？",
        ["关注订阅", "考虑付费会员", "只用免费", "不感兴趣", "先看质量"],
    ),
    (
        "multi",
        "Q25. 怎样才显得可信？（可多选）【多选题】",
        [
            "明确原文署名",
            "高质量翻译",
            "分析深度不输海外原文",
            "本地社群管理",
            "合理中国定价",
            "无博彩包装",
            "稳定的每周更新",
        ],
    ),
    (
        "open",
        "Q26. 一句话：最能提升你本赛季 FPL 体验的是？【填空题】",
        None,
    ),
    (
        "single",
        "D1. 年龄段（可选）",
        ["<18", "18–24", "25–34", "35–44", "45+", "不愿说"],
    ),
    (
        "single",
        "D2. 性别（可选）",
        ["男", "女", "其他/不愿说"],
    ),
    (
        "open",
        "D3. 抽奖用邮箱/微信（可选，仅用于奖品联络）【填空题】",
        None,
    ),
]


def format_block(idx: int, qtype: str, title: str, options) -> str:
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    lines = [f"{idx}.{title}"]
    if qtype in ("single", "multi", "scale") and options:
        for i, opt in enumerate(options):
            lines.append(f"{letters[i]}.{opt}")
    elif qtype == "open":
        # Wenjuanxing often recognizes fill-in when no options / explicit tag in title
        pass
    lines.append("")  # blank line between questions
    return "\n".join(lines)


def main():
    header = (
        "FPL经理调研（约8分钟）\n"
        "本问卷用于了解 FPL 玩家如何获取信息、使用工具与中文社区习惯。\n"
        "不采集敏感身份信息出售；开放题仅用于汇总分析。\n"
        "请按真实习惯作答。感谢支持！\n\n"
    )
    blocks = []
    n = 1
    for qtype, title, options in QUESTIONS:
        blocks.append(format_block(n, qtype, title, options))
        n += 1
    text = header + "\n".join(blocks)
    OUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUT} ({len(QUESTIONS)} questions)")


if __name__ == "__main__":
    main()
