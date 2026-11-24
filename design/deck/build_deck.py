# -*- coding: utf-8 -*-
"""Build the InRole course-project deck with python-pptx."""
from pathlib import Path
from lxml import etree
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.oxml.ns import qn

ROOT = Path(r"C:\Users\27251\Desktop\666\inrole")
ASSETS = ROOT / "design" / "deck" / "assets"
OUT = ROOT / "design" / "deck" / "InRole-课程项目汇报.pptx"

# ---------- palette ----------
INK = RGBColor.from_string("181411")
INK2 = RGBColor.from_string("2A231D")
CREAM = RGBColor.from_string("F6EFE4")
PAPER = RGBColor.from_string("FBF7EF")
WHITE = RGBColor.from_string("FFFFFF")
RED = RGBColor.from_string("C8452F")
RED_DARK = RGBColor.from_string("9E3323")
SAGE = RGBColor.from_string("AEB7A2")
GOLD = RGBColor.from_string("C7A05B")
MUTED = RGBColor.from_string("7C7064")
LINE = RGBColor.from_string("D8CCBC")
SOFT = RGBColor.from_string("EFE6D8")

FONT = "Microsoft YaHei"
SERIF = "Georgia"

W, H = 13.333, 7.5


def rgb(h):
    return RGBColor.from_string(h)


def set_run(run, text, size=12, color=INK, bold=False, italic=False, font=FONT):
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    ea = rPr.find(qn("a:ea"))
    if ea is None:
        ea = etree.SubElement(rPr, qn("a:ea"))
    ea.set("typeface", font)


def add_text(slide, x, y, w, h, text, size=13, color=INK, bold=False,
             font=FONT, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
             line=1.12, space_after=0, italic=False, margins=0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(margins)
    tf.margin_right = Inches(margins)
    tf.margin_top = Inches(margins)
    tf.margin_bottom = Inches(margins)
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = line
    p.space_after = Pt(space_after)
    set_run(p.add_run(), text, size, color, bold, italic, font)
    return box


def add_paragraphs(slide, x, y, w, h, items, margins=0, anchor=MSO_ANCHOR.TOP):
    """items: list of dicts {lead?, text, size?, color?, bold?, space_before?, space_after?, line?, prefix?}"""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(margins)
    tf.margin_right = Inches(margins)
    tf.margin_top = Inches(margins)
    tf.margin_bottom = Inches(margins)
    tf.vertical_anchor = anchor
    first = True
    for item in items:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.alignment = item.get("align", PP_ALIGN.LEFT)
        p.line_spacing = item.get("line", 1.12)
        p.space_before = Pt(item.get("space_before", 0))
        p.space_after = Pt(item.get("space_after", 0))
        if item.get("prefix"):
            set_run(p.add_run(), item["prefix"], item.get("prefix_size", item.get("size", 12)),
                    item.get("prefix_color", RED), item.get("prefix_bold", True), False, FONT)
        if item.get("lead"):
            set_run(p.add_run(), item["lead"], item.get("lead_size", item.get("size", 12)),
                    item.get("lead_color", item.get("color", INK)), True, False, FONT)
        set_run(p.add_run(), item["text"], item.get("size", 12),
                item.get("color", INK), item.get("bold", False), item.get("italic", False),
                item.get("font", FONT))
    return box


def add_rect(slide, x, y, w, h, fill=WHITE, line=None, radius=0.06, line_w=0.6):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.adjustments[0] = radius
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(line_w)
    shp.shadow.inherit = False
    return shp


def add_shape_text(shp, text, size=12, color=INK, bold=False, font=FONT,
                   align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE, margins=0.1,
                   line=1.05):
    tf = shp.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(margins)
    tf.margin_right = Inches(margins)
    tf.margin_top = Inches(margins)
    tf.margin_bottom = Inches(margins)
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = line
    set_run(p.add_run(), text, size, color, bold, False, font)


def add_line(slide, x1, y1, x2, y2, color=LINE, width=0.75):
    conn = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    conn.line.color.rgb = color
    conn.line.width = Pt(width)
    conn.shadow.inherit = False
    return conn


def add_arrow(slide, x, y, w=0.24, h=0.22, color=RED):
    shp = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = color
    shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def add_pill(slide, x, y, w, text, fill=SOFT, color=INK, size=9, bold=False, line=None, h=0.28):
    shp = add_rect(slide, x, y, w, h, fill=fill, line=line, radius=0.5)
    add_shape_text(shp, text, size=size, color=color, bold=bold, align=PP_ALIGN.CENTER, margins=0.04)
    return shp


def content_slide(prs, section, title, subtitle, num, title_size=28):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = PAPER
    add_text(slide, 0.75, 0.30, 8.8, 0.25, section, 8.5, RED, True, FONT)
    add_text(slide, 0.75, 0.62, 12.0, 0.72, title, title_size, INK, True, FONT, line=1.0)
    if subtitle:
        add_text(slide, 0.75, 1.36, 11.8, 0.42, subtitle, 11.5, MUTED, False, FONT, line=1.15)
    add_line(slide, 0.75, 7.02, 12.58, 7.02, LINE, 0.5)
    add_text(slide, 0.75, 7.08, 6.0, 0.22, "InRole / 入戏 · 课程项目", 8, MUTED, False, FONT)
    add_text(slide, 12.10, 7.08, 0.48, 0.22, f"{num:02d}", 8, MUTED, False, SERIF, PP_ALIGN.RIGHT)
    return slide


def add_notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def set_table_style(table, style_id="{2D5ABB26-0587-4C30-8999-92F81FD0307C}"):
    tbl = table._tbl
    tblPr = tbl.tblPr
    for el in tblPr.findall(qn("a:tableStyleId")):
        tblPr.remove(el)
    el = etree.SubElement(tblPr, qn("a:tableStyleId"))
    el.text = style_id


def set_cell(cell, text, size=10, color=INK, bold=False, fill=None,
             align=PP_ALIGN.LEFT, font=FONT):
    cell.margin_left = Inches(0.09)
    cell.margin_right = Inches(0.07)
    cell.margin_top = Inches(0.04)
    cell.margin_bottom = Inches(0.04)
    cell.vertical_anchor = MSO_ANCHOR.MIDDLE
    if fill is not None:
        cell.fill.solid()
        cell.fill.fore_color.rgb = fill
    tf = cell.text_frame
    tf.clear()
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = 1.02
    set_run(p.add_run(), text, size, color, bold, False, font)


def add_table(slide, x, y, w, rows, cols, col_widths, row_heights):
    shape = slide.shapes.add_table(rows, cols, Inches(x), Inches(y), Inches(w), Inches(sum(row_heights)))
    table = shape.table
    set_table_style(table)
    for i, cw in enumerate(col_widths):
        table.columns[i].width = Inches(cw)
    for i, rh in enumerate(row_heights):
        table.rows[i].height = Inches(rh)
    return table


def add_footer_note(slide, text):
    add_text(slide, 0.75, 6.78, 11.8, 0.22, text, 8, MUTED, False, FONT, italic=True)


# =====================================================================
# SLIDE 1 — COVER
# =====================================================================
def slide_cover(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.background.fill
    bg.solid()
    bg.fore_color.rgb = INK

    # large red disc on the right
    disc = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(8.25), Inches(-1.15), Inches(5.9), Inches(5.9))
    disc.fill.solid()
    disc.fill.fore_color.rgb = RED
    disc.line.fill.background()
    disc.shadow.inherit = False

    # thin vertical rule
    add_line(s, 8.08, 0.85, 8.08, 6.7, rgb("5A4A3E"), 0.75)

    add_text(s, 0.85, 0.55, 6.6, 0.28, "COURSE PROJECT / 2026", 9, GOLD, True, SERIF)
    add_text(s, 0.85, 1.65, 7.2, 1.35, "入戏", 96, CREAM, True, FONT, line=0.92)
    add_text(s, 0.85, 2.95, 7.2, 0.5, "I N R O L E", 20, CREAM, False, SERIF)
    add_text(s, 0.85, 3.62, 7.0, 0.4, "一个以名人身份说话的 UGC 剧场", 23, CREAM, False, FONT)
    add_line(s, 0.85, 4.28, 3.3, 4.28, RED, 2.0)
    add_text(s, 0.85, 4.48, 6.7, 0.75,
             "产品设计 × 全栈实现 × 社区冷启动\n让「如果我是 TA」变成公共讨论。",
             12.5, rgb("C9BDAE"), False, FONT, line=1.5)

    # logo
    logo = ASSETS / "inrole-logo-cream.png"
    if logo.exists():
        s.shapes.add_picture(str(logo), Inches(9.45), Inches(1.75), width=Inches(3.15))

    add_text(s, 0.85, 6.05, 7.0, 0.3, "汇报人：〔姓名〕    成员：〔姓名〕 · 〔姓名〕", 10, CREAM, False, FONT)
    add_text(s, 0.85, 6.45, 7.0, 0.3, "课程：〔课程名称〕  /  2026.12", 9.5, rgb("A89886"), False, FONT)
    add_text(s, 9.35, 6.25, 3.25, 0.3, "换个身份，说你的话。", 10, CREAM, False, FONT, PP_ALIGN.RIGHT)

    add_notes(s, "开场 30 秒：先不解释功能，先用一句话让人记住——这是一个用户以公共人物身份发帖、评论、评分、投币的社区。封面上的「入戏」既指进入角色，也指认真对待表达。团队成员姓名请替换为真实姓名。")
    return s


# =====================================================================
# SLIDE 2 — SUMMARY
# =====================================================================
def slide_summary(prs):
    s = content_slide(prs, "01 / 项目摘要", "把「如果我是 TA」变成一座公共舞台",
                      "用户每次发言前选择一个公共人物，以角色身份发帖、评论、评分、投币；人物是公共的，表达是个人的。", 2)
    # left numbers
    rows = [
        ("04", "核心模块", "帖子 / 热搜 / 评分 / 戏币"),
        ("18", "开发任务", "6 个阶段，14 天 beta"),
        ("03", "团队角色", "产品技术 / 内容增长 / 基建法务"),
    ]
    y = 2.0
    for num, label, desc in rows:
        add_text(s, 0.8, y, 1.0, 0.65, num, 38, RED, True, SERIF, line=0.9)
        add_text(s, 1.72, y + 0.02, 3.8, 0.28, label, 11, INK, True, FONT)
        add_text(s, 1.72, y + 0.30, 3.9, 0.28, desc, 9.5, MUTED, False, FONT)
        y += 1.18

    # right blocks
    blocks = [
        ("问题", "追星是单向的，角色扮演散落在群聊，AI 角色聊天缺少公共广场。"),
        ("方案", "公共人物库 + 每次独立选身份 + 轻内容 + 声誉游戏，把「演」变成可发现、可互动的公共内容。"),
        ("交付", "可邀请 5–20 人试用的响应式 Web：真实账号、内容、评分、戏币、热搜与基础管理。"),
    ]
    y = 2.0
    for idx, (label, text) in enumerate(blocks, 1):
        add_text(s, 5.75, y, 0.55, 0.25, f"0{idx}", 9, RED, True, SERIF)
        add_text(s, 6.25, y - 0.02, 6.3, 0.28, label, 11, INK, True, FONT)
        add_text(s, 6.25, y + 0.30, 6.2, 0.85, text, 11.5, MUTED, False, FONT, line=1.35)
        y += 1.33

    add_rect(s, 0.75, 5.95, 11.85, 0.75, CREAM, LINE, 0.08)
    add_text(s, 1.0, 6.12, 11.35, 0.4,
             "不是名人百科，也不是粉丝控评场；是一个可以「演」的公共空间。",
             14, RED_DARK, True, FONT)
    add_notes(s, "这一页给全篇定调：产品不是「看名人」，而是「借名人的名字说话」。四个模块不是并列功能，而是一个循环：发内容—获互动—上榜单—再回来。18 个任务是工程拆解，14 天是可邀请内测的目标，不是公开运营。")
    return s


# =====================================================================
# SLIDE 3 — BACKGROUND MATRIX
# =====================================================================
def slide_background(prs):
    s = content_slide(prs, "02 / 背景", "三种现有形态，留下一个空白",
                      "定性示意，不是市场数据；空白在于「公共讨论 × 角色沉浸」。", 3)
    # matrix frame
    mx, my, mw, mh = 0.95, 1.82, 5.15, 4.42
    add_rect(s, mx, my, mw, mh, CREAM, LINE, 0.02)
    add_line(s, mx + mw / 2, my, mx + mw / 2, my + mh, LINE, 0.75)
    add_line(s, mx, my + mh / 2, mx + mw, my + mh / 2, LINE, 0.75)

    add_text(s, mx + mw - 2.5, my + mh + 0.08, 2.4, 0.22, "角色沉浸强 →", 8, MUTED, True, FONT, PP_ALIGN.RIGHT)

    # quadrant labels
    add_text(s, mx + 0.18, my + 0.18, 2.2, 0.28, "微博超话 / 粉丝社区", 11, INK, True)
    add_text(s, mx + 0.18, my + 0.50, 2.25, 0.75, "公共性强，但单向追星；用户是观众，角色沉浸弱。", 8.5, MUTED, line=1.25)

    add_text(s, mx + 0.18, my + mh / 2 + 0.18, 2.2, 0.28, "传统论坛", 11, INK, True)
    add_text(s, mx + 0.18, my + mh / 2 + 0.50, 2.25, 0.6, "公共讨论有，但缺少角色身份与轻量玩法。", 8.5, MUTED, line=1.25)

    # InRole quadrant
    add_rect(s, mx + mw / 2 + 0.18, my + 0.18, 1.95, 0.32, RED, None, 0.5)
    add_text(s, mx + mw / 2 + 0.18, my + 0.24, 1.95, 0.22, "入戏 InRole", 9.5, WHITE, True, FONT, PP_ALIGN.CENTER)
    add_text(s, mx + mw / 2 + 0.18, my + 0.60, 2.25, 0.9, "公共讨论 + 角色沉浸；可发现、可互动、可评价。", 8.5, RED_DARK, True, line=1.3)
    dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(mx + mw - 0.38), Inches(my + 0.34), Inches(0.12), Inches(0.12))
    dot.fill.solid(); dot.fill.fore_color.rgb = RED; dot.line.fill.background()

    add_text(s, mx + mw / 2 + 0.18, my + mh / 2 + 0.18, 2.2, 0.28, "Character.AI / 语C群", 10.5, INK, True)
    add_text(s, mx + mw / 2 + 0.18, my + mh / 2 + 0.50, 2.25, 0.9, "沉浸强，但多在私聊/群聊；缺公共发现、沉淀和规则。", 8.5, MUTED, line=1.25)

    # right insights
    insights = [
        ("01", "追星是单向的", "超话和粉丝社区以应援、控评为主，用户是观众，不是角色。表达欲被压缩成「转发/打榜」。"),
        ("02", "角色扮演是分散的", "语C、群聊、角色号有旺盛表达，但缺公共发现、内容沉淀和可复用规则。"),
        ("03", "AI 角色缺公共性", "一对一聊天很强，但没有广场、热搜、公共评价与声誉；用户之间无法互相看见。"),
    ]
    y = 1.95
    for num, title, body in insights:
        add_text(s, 6.75, y, 0.42, 0.25, num, 9, RED, True, SERIF)
        add_text(s, 7.18, y - 0.02, 5.0, 0.28, title, 12.5, INK, True)
        add_text(s, 7.18, y + 0.28, 5.0, 0.72, body, 10, MUTED, line=1.35)
        y += 1.32

    add_text(s, 6.75, 6.22, 5.4, 0.45,
             "空白：让角色扮演进入公共讨论，而不是停在私聊。",
             12, RED_DARK, True, FONT)
    add_text(s, 6.75, 6.68, 5.4, 0.22, "定性示意，非市场数据", 8, MUTED, False, FONT, italic=True)
    add_notes(s, "这张 2×2 是定性地图，不是市场调研。横轴是角色沉浸，纵轴是公共社区：超话公共但单向，语C/Character.AI 沉浸但私域，传统论坛公共但缺角色。右上角是我们要占的位置——不是更多名人内容，而是让用户以名人身份参与公共讨论。")
    return s


# =====================================================================
# SLIDE 4 — USERS
# =====================================================================
def slide_users(prs):
    s = content_slide(prs, "03 / 用户", "三类人，同一个动作：借一个名字说话",
                      "不是来追星，是来「演一下」；不是要私域，是要公共反馈。", 4)
    cards = [
        ("01", "表达型二创作者", "18–30 岁", "想写段子/脑洞，但不想经营固定人设。",
         "低门槛、被看见、有反馈。", "用秦始皇的口吻吐槽加班；用李白回一句杜甫。", "用角色口吻发一帖"),
        ("02", "同好型考据党", "16–28 岁", "历史/神话/影视同好，在意角色一致性。",
         "角色可信、讨论氛围、同好识别。", "在「神仙也打工」话题下考据天庭官僚制。", "在话题下回一句"),
        ("03", "轻量型围观者", "18–35 岁", "爱看热搜和神评论，偶尔参与。",
         "低门槛参与、榜单、轻游戏化。", "给人物打分、把每日 10 币投给喜欢的角色。", "评分 / 投币"),
    ]
    x = 0.75
    for num, title, age, desc, need, scene, action in cards:
        add_rect(s, x, 1.88, 3.72, 3.78, WHITE, LINE, 0.05)
        add_text(s, x + 0.22, 2.05, 0.45, 0.22, num, 8.5, RED, True, SERIF)
        add_text(s, x + 0.22, 2.28, 3.2, 0.3, title, 15, INK, True)
        add_text(s, x + 0.22, 2.63, 3.2, 0.22, age, 8.5, MUTED, False, SERIF)
        add_text(s, x + 0.22, 2.98, 3.25, 0.62, desc, 9.5, MUTED, line=1.3)
        add_text(s, x + 0.22, 3.63, 0.5, 0.2, "需求", 7.5, RED, True)
        add_text(s, x + 0.72, 3.61, 2.8, 0.42, need, 9.5, INK, line=1.25)
        add_text(s, x + 0.22, 4.15, 0.5, 0.2, "场景", 7.5, RED, True)
        add_text(s, x + 0.72, 4.13, 2.8, 0.75, scene, 9.5, INK, line=1.3)
        add_line(s, x + 0.22, 4.66, x + 3.48, 4.66, rgb("E8DDCE"), 0.5)
        add_text(s, x + 0.22, 4.78, 3.2, 0.25, "关键动作：" + action, 8.2, RED_DARK, True)
        x += 4.03

    add_line(s, 0.75, 5.92, 12.58, 5.92, LINE, 0.6)
    add_text(s, 0.75, 6.02, 8.0, 0.3,
             "共同点：借一个名字，降低表达门槛；要的是公共反馈，不是私密陪伴。",
             11.5, INK, True)
    add_pill(s, 9.1, 6.05, 1.55, "不做私聊型 AI 伴侣", SOFT, RED_DARK, 8.5, True)
    add_pill(s, 10.75, 6.05, 1.78, "不做控评型追星社区", SOFT, RED_DARK, 8.5, True)
    add_notes(s, "三类用户不是按年龄硬切，而是按动机：表达、同好、围观。共同动作是「借名字」。因此产品不要求用户创建角色、也不做私聊型 AI 伴侣；这两条是非目标，后面会反复出现。")
    return s


# =====================================================================
# SLIDE 5 — GOALS
# =====================================================================
def slide_goals(prs):
    s = content_slide(prs, "04 / 目标", "北极星：每周有效扮演互动",
                      "规模不是课程作业的目标；真实互动和二次回访才是。", 5)
    # north star
    add_rect(s, 0.75, 1.85, 5.55, 1.32, INK, None, 0.05)
    add_text(s, 0.98, 2.0, 4.9, 0.26, "NORTH STAR", 8, GOLD, True, SERIF)
    add_text(s, 0.98, 2.25, 4.9, 0.42, "每周有效扮演互动", 21, CREAM, True)
    add_text(s, 0.98, 2.70, 5.0, 0.32, "带人物身份的帖子/评论，获得 ≥1 次真实互动。", 8.8, rgb("C9BDAE"))

    inputs = [
        ("首发率", "注册 → 第一条\n扮演内容"),
        ("D7 留存", "7 天后仍\n主动回来"),
        ("互动率", "有评论/点赞的\n帖子占比"),
        ("投币参与", "使用每日 10 币\n的用户占比"),
    ]
    positions = [(0.75, 3.38), (3.55, 3.38), (0.75, 4.55), (3.55, 4.55)]
    for (label, desc), (x, y) in zip(inputs, positions):
        add_rect(s, x, y, 2.55, 0.98, WHITE, LINE, 0.06)
        add_text(s, x + 0.16, y + 0.12, 2.2, 0.24, label, 10, RED_DARK, True)
        add_text(s, x + 0.16, y + 0.40, 2.2, 0.45, desc, 9, MUTED, line=1.2)

    # right beta targets
    add_rect(s, 6.78, 1.85, 5.8, 4.95, WHITE, LINE, 0.04)
    add_text(s, 7.02, 2.02, 5.2, 0.28, "BETA 目标（假设，不是结果）", 8.5, RED, True, SERIF)
    targets = [
        ("20–50", "注册用户"),
        ("10–20", "周活跃"),
        ("30%", "注册后首发"),
        ("15–20%", "D7 留存"),
        ("30%", "使用戏币"),
    ]
    y = 2.40
    for val, label in targets:
        add_text(s, 7.02, y, 1.3, 0.35, val, 17, INK, True, SERIF)
        add_text(s, 8.38, y + 0.06, 3.8, 0.25, label, 10, MUTED)
        add_line(s, 7.02, y + 0.46, 12.25, y + 0.46, rgb("E8DDCE"), 0.4)
        y += 0.63

    add_text(s, 7.02, 5.78, 5.2, 0.25, "护栏指标", 9, RED, True)
    add_text(s, 7.02, 6.03, 5.2, 0.62,
             "举报率 < 1% · 异常投票率 < 0.5% · 0 重大名誉事件\n宁可少增长，不拿信任换数字。",
             8.8, MUTED, line=1.3)
    add_notes(s, "北极星不是 DAU，而是「有效扮演互动」：有人用人物身份发内容，并且得到真实回应。Beta 目标是假设，不是承诺；课程作业更看重能不能让真实用户第二次回来。护栏指标是底线：举报率、异常投票、名誉事件。")
    return s


# =====================================================================
# SLIDE 6 — CORE EXPERIENCE
# =====================================================================
def slide_experience(prs):
    s = content_slide(prs, "05 / 产品", "四个模块，一个飞轮",
                      "身份是入口，内容是燃料，榜单是反馈，币是每日回访理由。", 6)
    steps = [
        ("01", "选身份", "发帖/评论前，\n选一个公共人物。", "每次独立", "秦始皇 / 李白 / 孙悟空"),
        ("02", "发内容", "1–500 字，0–3 话题；\n轻、快、可审核。", "帖子 / 评论", "「统一了六国，统一不了作息」"),
        ("03", "获互动", "点赞、评论、@；\n作者与人物分开。", "点赞 / 评论", "128 赞 · 32 评论"),
        ("04", "上榜单", "帖子/话题热搜；\n人物评分与币榜。", "热搜 / 评分 / 币", "#历史人物也要上班#"),
        ("05", "再回来", "个人中心看足迹；\n每日 10 币回访。", "我的", "今日 10 币还没投"),
    ]
    x = 0.75
    for i, (num, title, body, tag, example) in enumerate(steps):
        add_rect(s, x, 2.0, 2.05, 2.72, WHITE, LINE, 0.05)
        add_text(s, x + 0.16, 2.15, 0.4, 0.22, num, 8.5, RED, True, SERIF)
        add_text(s, x + 0.16, 2.40, 1.75, 0.3, title, 14.5, INK, True)
        add_text(s, x + 0.16, 2.82, 1.75, 0.72, body, 8.8, MUTED, line=1.35)
        add_text(s, x + 0.16, 3.48, 1.75, 0.48, example, 8.0, MUTED, False, italic=True, line=1.2)
        add_text(s, x + 0.16, 4.25, 1.75, 0.25, tag, 8, RED_DARK, True)
        if i < 4:
            add_arrow(s, x + 2.10, 3.22, 0.22, 0.2, RED)
        x += 2.32

    add_rect(s, 0.75, 5.15, 11.85, 0.72, CREAM, LINE, 0.08)
    add_text(s, 1.0, 5.33, 11.3, 0.3,
             "飞轮：选身份 → 发内容 → 获互动 → 上榜单 → 得反馈 → 再回来",
             13, INK, True)
    add_text(s, 0.75, 6.15, 11.85, 0.55,
             "四个模块各自解决一件事：帖子降低表达门槛，热搜提供公共曝光，评分沉淀人物口碑，戏币制造每日回访；个人中心把「我演过谁」变成可积累的身份资产。",
             9.5, MUTED, line=1.35)
    add_notes(s, "这是产品的飞轮，不是四个孤立页面。发帖是入口，热搜是曝光，评分是口碑沉淀，戏币是回访理由；个人中心让用户的扮演历史可积累。注意：人物身份是每次发言选的，不是账号绑定的「我的角色」。")
    return s


# =====================================================================
# SLIDE 7 — RULES
# =====================================================================
def slide_rules(prs):
    s = content_slide(prs, "06 / 规则", "四条规则，决定产品能不能成立",
                      "限制不是功能缺失，是刻意设计的边界。", 7)
    cards = [
        ("01", "每次独立选身份", "发帖、评论各自选人物；发布后不能改；旧内容人物不变。",
         "为什么：一人千面，不把用户锁死在一个角色里。"),
        ("02", "人物是公共的", "用户不创建、不拥有；同一人物可被多人使用；展示「人物 · @账号」。",
         "为什么：角色是公共财产，表达是个人作品；避免角色认领争议。"),
        ("03", "轻内容，强边界", "1–500 字；0–3 个管理员话题；一级评论；不做图片/私信/转发。",
         "为什么：降低发布门槛，也让审核与冷启动可控。"),
        ("04", "声誉游戏，不是氪金", "评分 1–5；每天 10 币；投币不改变评分；无充值/提现/转账。",
         "为什么：用游戏化换回访，不用钱买榜；榜单才有可信度。"),
    ]
    positions = [(0.75, 1.88), (6.65, 1.88), (0.75, 4.12), (6.65, 4.12)]
    for (num, title, body, why), (x, y) in zip(cards, positions):
        add_rect(s, x, y, 5.7, 2.02, WHITE, LINE, 0.05)
        add_text(s, x + 0.2, y + 0.14, 0.4, 0.22, num, 8.5, RED, True, SERIF)
        add_text(s, x + 0.2, y + 0.36, 5.0, 0.3, title, 15, INK, True)
        add_text(s, x + 0.2, y + 0.76, 5.15, 0.6, body, 9.2, MUTED, line=1.3)
        add_text(s, x + 0.2, y + 1.48, 5.1, 0.35, why, 8.2, RED_DARK, True, line=1.2)

    add_text(s, 0.75, 6.42, 11.8, 0.3,
             "这些限制让产品「轻」：轻到三个人能在两周内做出可信版本，也轻到审核和社区规则能落地。",
             10.5, MUTED, False, FONT, italic=True)
    add_notes(s, "四条规则对应四个产品判断：不锁角色、不拥有角色、不做重内容、不做氪金。它们既是体验设计，也是成本与合规设计。尤其「人物公共」：如果允许认领，会立刻遇到名人本人、粉丝和冒充的边界问题。")
    return s


# =====================================================================
# SLIDE 8 — MECHANISMS
# =====================================================================
def slide_mechanisms(prs):
    s = content_slide(prs, "07 / 机制", "热度可解释，戏币可审计",
                      "规则透明是社区信任的一部分；不卖榜，不卖币。", 8)
    # left
    add_rect(s, 0.75, 1.8, 5.85, 4.45, WHITE, LINE, 0.04)
    add_text(s, 1.0, 1.98, 5.2, 0.26, "热搜：用独立账号，不用累计次数", 8.5, RED, True)
    add_text(s, 1.0, 2.38, 5.2, 0.7, "H = L + 3C", 30, INK, True, SERIF)
    add_text(s, 1.0, 3.02, 5.2, 0.55, "T = 2A + L + 3C", 24, INK, True, SERIF)
    add_text(s, 1.0, 3.68, 5.3, 0.8,
             "L 有效点赞账号数 · C 独立评论账号数 · A 独立发帖账号数\n24h / 7d 滚动窗口 · 排除作者自互动 · 话题内去重",
             8.8, MUTED, line=1.35)
    add_rect(s, 1.0, 4.36, 5.25, 0.78, CREAM, None, 0.06)
    add_text(s, 1.14, 4.45, 5.0, 0.62,
             "算例：10 个点赞账号 + 3 个评论账号 → H = 10 + 3×3 = 19；\n同一人评论 10 条，仍只算 1 个 C。",
             8.0, RED_DARK, False, line=1.25)
    add_text(s, 1.0, 5.32, 5.25, 0.55,
             "为什么：账号去重抑制刷量；窗口统计让老帖有新互动也能上；公式公开，接受社区监督。",
             8.8, INK, line=1.25)
    add_text(s, 1.0, 5.98, 5.25, 0.25, "不卖热搜位。", 9.0, RED_DARK, True)

    # right
    add_rect(s, 6.85, 1.8, 5.72, 4.45, CREAM, LINE, 0.04)
    add_text(s, 7.1, 1.98, 5.1, 0.26, "戏币：每日预算，账本可核对", 8.5, RED, True)
    steps = [
        ("01", "领取", "每天首次有效登录/访问 +10；北京时间自然日唯一。"),
        ("02", "投币", "1 币 = 1 票，只能投公共人物；正整数、不超余额、不可撤回。"),
        ("03", "对账", "余额 = 领取总额 − 投出总额；每笔变动有流水。"),
    ]
    y = 2.38
    for num, title, body in steps:
        add_text(s, 7.12, y, 0.38, 0.22, num, 8.5, RED, True, SERIF)
        add_text(s, 7.55, y - 0.02, 4.7, 0.25, title, 10.5, INK, True)
        add_text(s, 7.55, y + 0.25, 4.65, 0.55, body, 8.8, MUTED, line=1.25)
        y += 0.92
    add_text(s, 7.1, 5.02, 5.1, 0.28,
             "例：余额 10 投 3 → 7；同日重登不再发。",
             8.2, RED_DARK, True)
    add_text(s, 7.1, 5.38, 5.1, 0.58,
             "事务：扣余额 + 写流水 + 人物收币，同一事务；幂等键防重复；行锁/条件更新防超扣。",
             8.2, INK, line=1.25)
    add_text(s, 7.1, 6.05, 5.1, 0.22, "不充值、不提现、不转账。", 9.0, RED_DARK, True)

    add_text(s, 0.75, 6.55, 11.8, 0.25,
             "公开公式 + 可审计账本 = 社区信任；这比多一个功能更重要。",
             10.5, MUTED, False, FONT, italic=True)
    add_notes(s, "机制页是产品深度的核心。热度用独立账号而不是累计次数，是为了让「一个人刷十条评论」不加分；窗口统计让老帖有新互动也能上。戏币不是积分商城，而是每日预算 + 公共投票 + 可核对账本；不充值、不提现，避免资金池和赌博风险。")
    return s


# =====================================================================
# SLIDE 9 — ARCHITECTURE
# =====================================================================
def slide_architecture(prs):
    s = content_slide(prs, "08 / 工程", "单体优先，服务端可信",
                      "三个人、两周 beta：不引入微服务、Redis、Kubernetes；把复杂度留给业务，不留给运维。", 9)
    # Vercel bar
    add_rect(s, 0.75, 1.78, 11.85, 0.46, INK, None, 0.08)
    add_text(s, 1.0, 1.88, 8.0, 0.24, "Vercel  /  Next.js 16 App Router  /  Node runtime", 9, CREAM, True, SERIF)
    add_text(s, 9.8, 1.88, 2.5, 0.24, "PREVIEW + PROD", 7.5, GOLD, True, SERIF, PP_ALIGN.RIGHT)

    # boxes
    add_rect(s, 0.8, 2.62, 2.7, 1.3, WHITE, LINE, 0.06)
    add_text(s, 0.98, 2.78, 2.35, 0.25, "浏览器 / PWA", 11, INK, True)
    add_text(s, 0.98, 3.08, 2.35, 0.55, "React Server Components\nClient Components", 8.3, MUTED, line=1.3)

    add_rect(s, 4.15, 2.45, 3.65, 1.75, CREAM, RED, 0.04, 1.0)
    add_text(s, 4.35, 2.62, 3.25, 0.25, "Next.js 服务端", 11, RED_DARK, True)
    add_text(s, 4.35, 2.95, 3.25, 0.9, "Route Handlers\nAuth.js 会话\nZod 校验 + 限流", 8.6, INK, line=1.35)

    add_rect(s, 8.65, 2.62, 2.7, 1.3, WHITE, LINE, 0.06)
    add_text(s, 8.83, 2.78, 2.3, 0.25, "Supabase PostgreSQL", 10.5, INK, True)
    add_text(s, 8.83, 3.08, 2.3, 0.55, "Drizzle ORM\n迁移 / 索引 / 备份", 8.3, MUTED, line=1.3)

    add_arrow(s, 3.55, 3.2, 0.45, 0.24, RED)
    add_arrow(s, 7.85, 3.2, 0.45, 0.24, RED)
    add_text(s, 3.48, 3.52, 0.65, 0.2, "HTTPS", 7, MUTED, True, FONT, PP_ALIGN.CENTER)
    add_text(s, 7.75, 3.52, 0.7, 0.2, "SQL", 7, MUTED, True, FONT, PP_ALIGN.CENTER)

    # bottom chips
    chips = [
        ("Auth.js", "ID + 密码 / 会话", 0.8),
        ("Drizzle", "迁移 + 类型", 3.2),
        ("Playwright", "关键流程 E2E", 5.6),
        ("GitHub Actions", "lint / test / build", 8.0),
        ("Cache 5 min", "热搜按需缓存", 10.4),
    ]
    for label, desc, x in chips:
        add_rect(s, x, 5.7, 2.15, 0.72, WHITE, LINE, 0.06)
        add_text(s, x + 0.14, 5.8, 1.9, 0.22, label, 9, RED_DARK, True)
        add_text(s, x + 0.14, 6.04, 1.9, 0.22, desc, 7.5, MUTED)

    add_text(s, 0.8, 4.52, 11.8, 0.9,
             "四条服务端底线：浏览器不直连数据库 · 作者由会话确定 · 币用事务 + 幂等 · 真实模式失败不回退假数据。",
             9.5, INK, True, line=1.3)
    add_text(s, 0.8, 5.02, 11.8, 0.28,
             "数据流：读 RSC → Drizzle → Postgres；写 Route Handler → 事务 → Postgres；热搜 SQL 窗口 + 5 分钟缓存。",
             8.2, MUTED, False, line=1.2)
    add_text(s, 0.8, 6.62, 11.8, 0.25,
             "单体不是妥协：以三人两周的规模，微服务只会增加部署、观测和调试成本。",
             8.5, MUTED, False, italic=True)
    add_notes(s, "技术选型的核心是「服务端可信」：浏览器不直连数据库，作者由会话确定，币用事务和幂等，真实模式失败不能回退假数据。热搜用 SQL 窗口统计 + 5 分钟按需缓存，避免依赖付费 cron。三个人两周，单体是理性选择。")
    return s


# =====================================================================
# SLIDE 10 — CURRENT PROGRESS
# =====================================================================
def slide_progress(prs):
    s = content_slide(prs, "09 / 进展", "从可点击原型，走向真实数据",
                      "截至 2026-11-22：S01–S03 完成；真实账号与数据库尚未接入。", 10)
    # progress bar
    add_text(s, 0.75, 1.83, 2.2, 0.25, "总进度 3 / 18", 9, INK, True, SERIF)
    add_rect(s, 0.75, 2.12, 4.95, 0.12, SOFT, None, 0.5)
    add_rect(s, 0.75, 2.12, 4.95 * 3 / 18, 0.12, RED, None, 0.5)

    items = [
        ("已完成", "响应式壳、帖子首页、人物/话题卡、登录/注册/喜好演示。"),
        ("可验收", "构建、类型、4 项规则测试、360/390/768/1440 宽度检查。"),
        ("当前边界", "6 人物、6 帖子、3 话题；演示账号明确标识，不是真实认证。"),
        ("下一步", "S04 发帖/评论/点赞 → S07 真实数据库与认证 → S10 真实内容。"),
        ("不假装", "未接真实币、未部署正式环境、未邀请真实用户。"),
    ]
    y = 2.55
    for label, body in items:
        add_text(s, 0.75, y, 0.8, 0.22, label, 8, RED, True)
        add_text(s, 1.55, y - 0.02, 4.2, 0.62, body, 9.2, MUTED, line=1.3)
        y += 0.68

    # screenshot
    img = ASSETS / "prototype-home.jpg"
    if img.exists():
        add_rect(s, 6.48, 1.62, 6.12, 4.28, WHITE, LINE, 0.03)
        s.shapes.add_picture(str(img), Inches(6.56), Inches(1.70), width=Inches(5.96))
        add_text(s, 6.56, 5.98, 5.96, 0.22, "1440px 桌面原型 / 演示数据 / 2026-11-22", 7.5, MUTED, False, FONT, italic=True)

    add_rect(s, 0.75, 6.38, 11.85, 0.34, CREAM, None, 0.5)
    add_text(s, 0.95, 6.43, 11.4, 0.22,
             "原型能点 ≠ 产品可用：接下来把「演示账号 / 本地数据 / 假币」逐个换成真实服务。",
             8.8, RED_DARK, True)
    add_notes(s, "这一页要诚实：目前只是可点击原型，不是真实产品。已完成响应式首页、帖子卡、登录/注册/喜好的演示流程；演示账号明确标注。下一步不是加更多页面，而是把账号、数据库、币逐个换成真实服务。")
    return s


# =====================================================================
# SLIDE 11 — 14-DAY PLAN
# =====================================================================
def slide_plan(prs):
    s = content_slide(prs, "10 / 计划", "14 天，五个阶段，每天一个可验收增量",
                      "按任务日排，不按在线小时承诺；每天一个可检查结果。", 11)
    left, top = 2.55, 2.55
    day_w = 0.72
    # day ticks
    for d in [1, 3, 5, 7, 9, 11, 13, 14]:
        x = left + (d - 1) * day_w
        add_text(s, x - 0.08, 2.14, 0.45, 0.2, f"D{d}", 7.5, MUTED, True, SERIF, PP_ALIGN.CENTER)
    # grid
    for d in range(0, 15):
        x = left + d * day_w
        add_line(s, x, 2.38, x, 5.18, rgb("E8DDCE"), 0.35)
    add_line(s, left, 2.38, left + 14 * day_w, 2.38, LINE, 0.6)
    add_line(s, left, 5.18, left + 14 * day_w, 5.18, LINE, 0.6)

    phases = [
        ("基线", 1, 1, RED, "D1  工程重建 + Vercel 验证"),
        ("原型", 2, 3, GOLD, "D2–D4  首页/发帖/评论/热搜/人物/钱包"),
        ("账号 / DB", 5, 3, SAGE, "D5–D7  迁移/认证/权限/喜好"),
        ("核心业务", 8, 4, INK2, "D8–D11  内容/评分/币/热搜/管理"),
        ("测试 / 部署 / 内测", 12, 3, RED_DARK, "D12–D14  E2E/正式环境/5 人 beta"),
    ]
    y = top
    for label, start, span, color, desc in phases:
        add_text(s, 0.75, y + 0.02, 1.65, 0.22, label, 8.5, INK, True)
        x = left + (start - 1) * day_w + 0.04
        w = span * day_w - 0.08
        add_rect(s, x, y, w, 0.34, color, None, 0.3)
        bar_text = "D1" if label == "基线" else desc
        add_text(s, x + 0.08, y + 0.075, max(w - 0.12, 0.6), 0.2, bar_text, 6.8, WHITE, True)
        y += 0.55

    # today marker
    tx = left + 0.02
    add_line(s, tx, 2.38, tx, 5.18, RED, 1.4)
    add_text(s, left + 0.12, 5.24, 3.1, 0.2, "D1 = 工程重建 + Vercel 验证", 7.2, RED, True)

    # gates
    gates = [
        ("每天", "lint / typecheck / test / build", 0.75),
        ("每阶段", "真实操作验收 + 记录 + Git 提交", 4.55),
        ("上线前", "备份可恢复 + 权限矩阵 + 手机真机", 8.35),
    ]
    for label, body, x in gates:
        add_rect(s, x, 5.62, 3.65, 0.82, WHITE, LINE, 0.06)
        add_text(s, x + 0.16, 5.72, 0.7, 0.22, label, 8, RED, True)
        add_text(s, x + 0.82, 5.70, 2.7, 0.42, body, 8.2, MUTED, line=1.2)

    add_text(s, 0.75, 6.62, 11.8, 0.25,
             "延期先砍：推荐 V1 → 管理后台 UI → 搜索 → 自定义域名；不砍认证、权限、币事务、备份。",
             8.5, MUTED, False, italic=True)
    add_notes(s, "14 天分成五段：1 天基线、3 天原型、3 天账号/DB、4 天核心业务、3 天测试部署内测。每天都必须有可验收增量。延期时砍推荐、后台 UI、搜索、自定义域名，绝不砍认证、权限、币事务和备份。")
    return s


# =====================================================================
# SLIDE 12 — AI WORKFLOW
# =====================================================================
def slide_ai(prs):
    s = content_slide(prs, "11 / 我的分工", "AI 不是「代写」，是可验收的开发流水线",
                      "我负责 AI 全流程：需求拆解、实现、测试、文档与提交；关键判断仍由人做。", 12)
    steps = [
        ("01", "需求拆解", "从 V0.2 规则拆\n任务与验收标准", "任务清单"),
        ("02", "任务契约", "范围、非目标、\n测试与证据", "范围/证据"),
        ("03", "实现", "页面 / API /\n迁移 / 测试", "代码/迁移"),
        ("04", "自测", "lint / typecheck /\ntest / build", "检查结果"),
        ("05", "人工验收", "你在手机/浏览器\n按步骤操作", "问题清单"),
        ("06", "提交复盘", "Git + 进度 +\n验证记录", "Git/记录"),
    ]
    x = 0.75
    for num, title, body, output in steps:
        add_rect(s, x, 2.0, 1.85, 1.95, WHITE, LINE, 0.05)
        add_text(s, x + 0.14, 2.12, 0.4, 0.2, num, 8, RED, True, SERIF)
        add_text(s, x + 0.14, 2.34, 1.55, 0.25, title, 11, INK, True)
        add_text(s, x + 0.14, 2.68, 1.55, 0.75, body, 7.8, MUTED, line=1.3)
        add_text(s, x + 0.14, 3.56, 1.58, 0.2, "产出：" + output, 6.8, RED, True)
        if x < 10.5:
            add_arrow(s, x + 1.88, 2.86, 0.15, 0.16, RED)
        x += 1.98

    # AI vs human
    add_rect(s, 0.75, 4.22, 5.7, 1.85, CREAM, LINE, 0.05)
    add_text(s, 0.98, 4.36, 2.0, 0.24, "AI 做", 9, RED, True)
    add_text(s, 0.98, 4.64, 5.2, 0.9,
             "写代码、迁移、测试、文档、调试；\n把一个任务做到可运行、可检查。",
             9.2, INK, line=1.35)
    add_text(s, 0.98, 5.42, 5.2, 0.42,
             "不替你做：产品取舍、云账号登录、真机验收。",
             8.2, RED_DARK, True, line=1.2)

    add_rect(s, 6.85, 4.22, 5.7, 1.85, INK, None, 0.05)
    add_text(s, 7.08, 4.36, 2.0, 0.24, "人做", 9, GOLD, True)
    add_text(s, 7.08, 4.64, 5.2, 0.9,
             "产品取舍、云控制台登录、真机验收、\n法律与名誉判断；对结果签字。",
             9.2, CREAM, line=1.35)
    add_text(s, 7.08, 5.42, 5.2, 0.42,
             "你签字：能不能上线、名人投诉怎么处理。",
             8.2, GOLD, True, line=1.2)

    add_text(s, 0.75, 6.2, 11.8, 0.25,
             "四条护栏：一次只做一个任务 · 不并行改同一份代码 · 不用假成功/删数据过关 · 未运行就写未运行。",
             8.8, RED_DARK, True)
    add_notes(s, "我的角色不是「让 AI 写点代码」，而是把开发变成可验收流水线：需求拆解、任务契约、实现、自测、人工验收、提交复盘。AI 能做代码、迁移、测试和文档；人必须做产品取舍、控制台授权、真机验收和法律判断。护栏是防止 AI 用假成功掩盖问题。")
    return s


# =====================================================================
# SLIDE 13 — TEAM
# =====================================================================
def slide_team(prs):
    s = content_slide(prs, "12 / 团队", "三个人，三条主线，一个发布节奏",
                      "不是「各做一块」，而是围绕同一份验收标准互相交接。", 13)
    rows = [
        ("我 / 组长", "产品与技术", "PRD、架构、全栈开发、AI 流水线、测试、部署", "与 B 定内容字段与审核；与 C 定环境与发布清单", "60%"),
        ("成员 B", "内容与增长", "人物库、种子/测试内容、话题运营、邀请内测、数据复盘", "与 C 过内容合规；与我对齐埋点与推荐规则", "25%"),
        ("成员 C", "基础设施与法务", "域名、云、备案、监控、备份、协议、商标、投诉通道", "与 B 定审核 SOP；与我定上线门槛", "15%"),
    ]
    table = add_table(s, 0.75, 1.78, 11.85, 4, 5,
                      [1.65, 2.15, 4.05, 3.05, 0.95],
                      [0.5, 0.78, 0.78, 0.78])
    headers = ["角色", "负责", "关键交付", "协作接口", "投入"]
    for j, h in enumerate(headers):
        set_cell(table.cell(0, j), h, 8.8, CREAM, True, INK, PP_ALIGN.LEFT if j != 4 else PP_ALIGN.CENTER)
    for i, row in enumerate(rows, 1):
        fill = WHITE if i % 2 else CREAM
        for j, val in enumerate(row):
            set_cell(table.cell(i, j), val, 9.0 if j != 4 else 9.5, INK, j == 0, fill,
                     PP_ALIGN.LEFT if j != 4 else PP_ALIGN.CENTER)

    # RACI strip
    raci = [
        ("产品规则", "A/R  我", "B/C 咨询"),
        ("内容供给", "A/R  B", "我/C 咨询"),
        ("基础设施/法务", "A/R  C", "我/B 咨询"),
        ("发布", "三人共同签字", "无一票通过"),
    ]
    x = 0.75
    for title, owner, note in raci:
        add_rect(s, x, 4.98, 2.82, 0.92, CREAM, LINE, 0.06)
        add_text(s, x + 0.14, 5.08, 2.5, 0.22, title, 8, RED, True)
        add_text(s, x + 0.14, 5.33, 2.5, 0.22, owner, 9.5, INK, True)
        add_text(s, x + 0.14, 5.58, 2.5, 0.2, note, 7.2, MUTED)
        x += 2.98

    add_text(s, 0.75, 6.18, 11.8, 0.5,
             "每周节奏：周一计划 → 周三 demo → 周五验收/复盘 → 周日发布；所有交接以「可运行结果 + 验收记录」为准。",
             9.5, MUTED, line=1.3)
    add_notes(s, "三个人不是各做各的：我负责产品与技术闭环；B 负责内容供给和真实用户冷启动；C 负责域名、服务器、备案、法务。RACI 里产品我 A/R，内容 B A/R，基础设施/法务 C A/R，发布必须三人签字。每周三 demo、周五验收，避免最后一周才发现接口对不上。")
    return s


# =====================================================================
# SLIDE 14 — COLD START
# =====================================================================
def slide_growth(prs):
    s = content_slide(prs, "13 / 增长", "冷启动不是刷量，是让第一批真实互动发生",
                      "内容供给、真实邀请、反馈闭环；合成数据只用于开发与演示。", 14)
    cols = [
        ("01", "内容供给", "30–50 位公共人物\n8–12 个常设话题\n200 条种子内容", "团队官方号明确标识；AI 辅助起草，人工审校；不伪装真人。", "本周：建 30 人物库，写 50 条"),
        ("02", "用户获取", "20–50 位邀请制种子用户\n历史/神话/影视社群\n每日话题 + 角色房间", "先给价值再拉人：可玩的话题、可引用的角色、可见的反馈。", "本周：邀 10 人，开 2 个话题"),
        ("03", "反馈闭环", "激活率 / 首发率 / D7\n举报率 / 互动率", "每周只看 Top 3 问题；不拿机器互动冒充增长。", "本周：访谈 5 人，只看 3 个指标"),
    ]
    x = 0.75
    for num, title, body, note, action in cols:
        add_rect(s, x, 1.9, 3.78, 3.35, WHITE, LINE, 0.05)
        add_text(s, x + 0.18, 2.04, 0.4, 0.2, num, 8, RED, True, SERIF)
        add_text(s, x + 0.18, 2.26, 3.3, 0.28, title, 14, INK, True)
        add_text(s, x + 0.18, 2.68, 3.35, 1.05, body, 9.4, INK, line=1.45)
        add_text(s, x + 0.18, 3.80, 3.35, 1.0, note, 8.1, MUTED, line=1.28)
        add_text(s, x + 0.18, 4.82, 3.38, 0.25, action, 7.8, RED_DARK, True)
        x += 4.03

    add_rect(s, 0.75, 5.48, 11.85, 0.92, RED, None, 0.05)
    add_text(s, 0.98, 5.60, 11.35, 0.68,
             "红线：B 产出的合成用户/帖子只用于开发测试，必须标注 demo，不能进入真实推荐或榜单；\n不得伪造真人账号、刷赞、刷评、刷榜——这是欺骗，也可能违反个人信息保护与反不正当竞争规则。",
             8.8, WHITE, True, line=1.3)

    metrics = [("激活率", "注册 → 首发"), ("首发率", "首条内容"), ("D7", "主动回访"), ("举报率", "< 1%")]
    x = 0.75
    for val, label in metrics:
        add_text(s, x, 6.55, 1.0, 0.25, val, 8, RED, True)
        add_text(s, x + 0.75, 6.56, 2.2, 0.22, label, 7.5, MUTED)
        x += 2.95
    add_notes(s, "这一页把「引流」拆成合规的三件事：内容供给、真实邀请、反馈闭环。合成数据只能用于开发测试，必须标注 demo，不能进入真实推荐或榜单。伪造账号、刷赞刷评刷榜不是增长，是欺骗，也有个人信息保护和反不正当竞争风险。")
    return s


# =====================================================================
# SLIDE 15 — INFRA / LEGAL
# =====================================================================
def slide_infra(prs):
    s = content_slide(prs, "14 / 基建与合规", "先把「能上线」和「敢上线」分开",
                      "内测可以用 Vercel 域名；公开运营不要跳过备案与内容审核。", 15)
    # infra
    add_rect(s, 0.75, 1.82, 5.7, 3.5, WHITE, LINE, 0.04)
    add_text(s, 1.0, 1.98, 5.0, 0.25, "基础设施 / C 负责", 8.5, RED, True)
    infra = [
        "域名、DNS、HTTPS、Vercel 预览/正式环境",
        "Supabase 开发库与正式库隔离；连接串只进服务端",
        "备份与恢复演练；上一版代码可回退",
        "日志脱敏、错误监控、限流/WAF",
        "监控：错误率、延迟、数据库连接数",
    ]
    y = 2.35
    for item in infra:
        add_text(s, 1.0, y, 0.18, 0.2, "·", 12, RED, True)
        add_text(s, 1.22, y - 0.01, 4.95, 0.42, item, 8.8, MUTED, line=1.25)
        y += 0.54

    # legal
    add_rect(s, 6.9, 1.82, 5.7, 3.5, CREAM, LINE, 0.04)
    add_text(s, 7.15, 1.98, 5.0, 0.25, "法务与合规 / C 负责", 8.5, RED, True)
    legal = [
        "ICP 备案、公安备案（如面向国内）",
        "商标 9/41/42/45 类；域名实名",
        "用户协议、隐私政策、社区公约、免责声明",
        "名人姓名/肖像/名誉；投诉下架与本人认领通道",
        "内容审核 SOP：机审 + 人审 + 申诉",
    ]
    y = 2.35
    for item in legal:
        add_text(s, 7.15, y, 0.18, 0.2, "·", 12, RED, True)
        add_text(s, 7.37, y - 0.01, 4.95, 0.42, item, 8.8, MUTED, line=1.25)
        y += 0.54

    # timeline
    add_text(s, 0.75, 5.48, 1.0, 0.22, "时间线", 8, RED, True)
    add_text(s, 1.55, 5.45, 10.9, 0.3,
             "D1 验证 Vercel  →  D5 Supabase 开发库  →  D13 正式环境  →  备案立即启动（长周期，别等上线）",
             9.2, INK, True)

    # public launch checklist
    add_text(s, 0.75, 5.95, 3.0, 0.22, "公开运营前必须完成", 8, RED, True)
    pills = ["备案", "内容审核", "账号找回", "法务文本", "备份恢复", "监控告警"]
    x = 2.9
    for p in pills:
        add_pill(s, x, 5.90, 1.35, p, WHITE, RED_DARK, 8, True, LINE, 0.3)
        x += 1.48
    add_text(s, 0.75, 6.55, 11.8, 0.25,
             "课程 beta 可以先跑；公开运营是一个单独门槛，不能用「先上线再说」跨过去。",
             8.5, MUTED, False, italic=True)
    add_notes(s, "基础设施和法务是两条线：域名/云/备份/监控，以及备案/商标/协议/名人权利。ICP 备案是长周期，必须第一天就启动，不能等开发完。内测可以用 Vercel 域名，但公开运营前必须完成备案、内容审核、账号找回、法务文本、备份和监控。")
    return s


# =====================================================================
# SLIDE 16 — RISK MATRIX
# =====================================================================
def slide_risk(prs):
    s = content_slide(prs, "15 / 风险", "最大的风险不是技术，是名誉与信任",
                      "每条风险都有负责人和可执行的缓解动作。", 16)
    rows = [
        ("名人姓名 / 肖像 / 名誉", "高", "高", "全站「非本人」标识；默认插画头像；禁止私生活/造谣/代言；投诉下架通道；律师审阅", "C"),
        ("伪造账号 / 刷量", "中", "高", "只做真实邀请；合成数据隔离并标注；异常检测；不卖榜", "B"),
        ("内容审核", "高", "高", "机审 + 人审 + 举报；敏感词；新号加严；应急下架", "B/C"),
        ("币并发 / 作弊", "中", "中", "事务 + 幂等 + 唯一约束 + 限频；每日对账", "我"),
        ("排期 / 范围蔓延", "高", "中", "范围冻结；每天验收；先砍推荐，不砍账本", "我"),
        ("部署 / 供应商", "中", "中", "D1 验证 Vercel；备份；可回退；替代托管预案", "C"),
    ]
    table = add_table(s, 0.75, 1.72, 11.85, 7, 5,
                      [2.95, 0.85, 0.85, 5.95, 1.25],
                      [0.42] + [0.55] * 6)
    headers = ["风险", "概率", "影响", "缓解动作", "负责人"]
    for j, h in enumerate(headers):
        set_cell(table.cell(0, j), h, 8.5, CREAM, True, INK, PP_ALIGN.CENTER if j in (1, 2, 4) else PP_ALIGN.LEFT)
    for i, row in enumerate(rows, 1):
        fill = WHITE if i % 2 else CREAM
        for j, val in enumerate(row):
            if j in (1, 2):
                color = RED if val == "高" else (GOLD if val == "中" else SAGE)
                set_cell(table.cell(i, j), val, 8.5, WHITE if val == "高" else INK, True, color, PP_ALIGN.CENTER)
            elif j == 4:
                set_cell(table.cell(i, j), val, 8.5, INK, True, fill, PP_ALIGN.CENTER)
            else:
                set_cell(table.cell(i, j), val, 8.5, INK, j == 0, fill)
    add_text(s, 0.75, 5.72, 11.8, 0.28,
             "高 / 中 / 低为团队内部判断；红色格需要在发布前有明确证据关闭。",
             8, MUTED, False, italic=True)
    add_rect(s, 0.75, 6.05, 11.85, 0.58, RED, None, 0.05)
    add_text(s, 0.98, 6.15, 11.4, 0.36,
             "任何一条名人投诉，48 小时内响应；宁可先下架，不赌声誉。",
             11, WHITE, True)
    add_notes(s, "风险矩阵里，名誉风险是最高优先级：真实名人的姓名、肖像、名誉，不是「免责声明」能完全解决的。缓解手段包括全站非本人标识、默认插画头像、禁止私生活/造谣/代言、投诉下架通道和律师审阅。第二是伪造账号/刷量，直接伤害社区信任。每条风险都有负责人。")
    return s


# =====================================================================
# SLIDE 17 — QUALITY
# =====================================================================
def slide_quality(prs):
    s = content_slide(prs, "16 / 质量", "质量不是「看起来能点」，是失败时也不出错",
                      "关键规则用测试锁住；关键流程用两个账号和真机验收。", 17)
    # pyramid
    add_text(s, 0.75, 1.85, 2.0, 0.22, "测试金字塔", 8, RED, True)
    layers = [
        ("E2E", "游客 → 注册 → 发帖 → 评论 → 评分 → 投币 → 流水", 1.85, 2.25, 2.45),
        ("Integration", "权限 / 两账号隔离 / 幂等 / 限流", 1.35, 3.25, 3.45),
        ("Unit", "ID / 长度 / 评分 / 热度 / 币计算", 0.8, 4.25, 4.55),
    ]
    colors = [RED, GOLD, SAGE]
    for i, (label, desc, x, y, w) in enumerate(layers):
        h = 0.82
        add_rect(s, x, y, w, h, colors[i], None, 0.04)
        add_text(s, x + 0.16, y + 0.10, w - 0.3, 0.25, label, 10.5, WHITE if i < 2 else INK, True)
        add_text(s, x + 0.16, y + 0.38, w - 0.3, 0.35, desc, 7.2, WHITE if i < 2 else INK, line=1.2)

    # checks
    checks = [
        ("01", "A 发 B 见；B 不能删 A；换人物不多赞。"),
        ("02", "余额 10，两次并发投 8：最多一次成功。"),
        ("03", "热搜用手算样本核对，同一人十条评论只计一次。"),
        ("04", "隐藏内容从直链、榜单、推荐全部消失。"),
        ("05", "备份可恢复；360/390 手机键盘可用。"),
    ]
    add_text(s, 6.25, 1.85, 2.0, 0.22, "五个必过检查", 8, RED, True)
    y = 2.2
    for num, text in checks:
        add_text(s, 6.25, y, 0.4, 0.22, num, 8, RED, True, SERIF)
        add_text(s, 6.7, y - 0.02, 5.7, 0.55, text, 9.5, INK, line=1.3)
        y += 0.63

    add_text(s, 6.25, 5.55, 5.8, 0.45,
             "Beta 退出标准：5 人独立完成，4/5 成功；阻断问题 0；重复发币 0。",
             10.5, RED_DARK, True, line=1.3)
    add_text(s, 0.75, 6.15, 5.6, 0.55,
             "交付物：站点 / 代码与迁移 / 测试记录 / 验收截图 / 部署与恢复说明。",
             8.5, MUTED, line=1.3)
    add_text(s, 0.75, 6.62, 11.8, 0.25,
             "不用「我觉得可以」验收；用两个账号、并发请求、手算样本和真机操作验收。",
             8.2, MUTED, False, italic=True)
    add_notes(s, "质量页给课程展示一个「工程感」：单测锁规则，集成测试锁权限和幂等，E2E 锁关键流程；再加五个必过检查——两账号、并发投币、手算热度、隐藏内容、备份恢复。Beta 退出标准是 5 人独立完成，4/5 成功，阻断问题 0，重复发币 0。")
    return s


# =====================================================================
# SLIDE 18 — CLOSING
# =====================================================================
def slide_closing(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.background.fill
    bg.solid()
    bg.fore_color.rgb = INK

    # red disc bottom right
    disc = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(9.2), Inches(4.0), Inches(5.0), Inches(5.0))
    disc.fill.solid(); disc.fill.fore_color.rgb = RED; disc.line.fill.background(); disc.shadow.inherit = False

    add_text(s, 0.9, 0.7, 7.0, 0.25, "INROLE / THE PUBLIC STAGE", 9, GOLD, True, SERIF)
    add_text(s, 0.9, 1.55, 7.5, 1.2, "换个身份，\n说你的话。", 48, CREAM, True, FONT, line=1.08)
    add_line(s, 0.9, 3.55, 3.6, 3.55, RED, 2.0)
    add_text(s, 0.9, 3.78, 6.8, 0.65,
             "入戏 InRole  ·  名人扮演社区\n课程项目汇报 / 2026.12",
             13, rgb("C9BDAE"), False, FONT, line=1.5)
    add_text(s, 0.9, 6.15, 7.0, 0.3,
             "汇报人：〔姓名〕    成员：〔姓名〕 · 〔姓名〕",
             9.5, CREAM, False, FONT)
    add_text(s, 0.9, 6.55, 7.0, 0.3, "谢谢  /  Q & A", 12, GOLD, True, SERIF)

    add_text(s, 8.9, 5.85, 3.8, 0.3, "让角色进入公共讨论。", 9, CREAM, False, FONT, PP_ALIGN.RIGHT)
    add_notes(s, "收尾 30 秒：回到一句话——让角色进入公共讨论，而不是停在私聊。感谢评委，进入 Q&A。可准备三个问题的答案：为什么不做私聊型 AI？如何防止刷榜？名人投诉怎么处理？")
    return s


def main():
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    prs.core_properties.title = "入戏 InRole · 名人扮演社区"
    prs.core_properties.subject = "课程项目汇报：产品目标、背景、实现过程与三人分工"
    prs.core_properties.author = "InRole Team"
    prs.core_properties.comments = "Generated with python-pptx; editable text, tables and shapes."

    slide_cover(prs)
    slide_summary(prs)
    slide_background(prs)
    slide_users(prs)
    slide_goals(prs)
    slide_experience(prs)
    slide_rules(prs)
    slide_mechanisms(prs)
    slide_architecture(prs)
    slide_progress(prs)
    slide_plan(prs)
    slide_ai(prs)
    slide_team(prs)
    slide_growth(prs)
    slide_infra(prs)
    slide_risk(prs)
    slide_quality(prs)
    slide_closing(prs)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUT))
    print(f"saved: {OUT}  slides={len(prs.slides)}")


if __name__ == "__main__":
    main()
