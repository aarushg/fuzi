from html import escape
from pathlib import Path

import openpyxl
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "Fuzi Staff Name & Mobile No..xlsx"
SVG_OUT = ROOT / "fuzi_org_chart.svg"
HTML_OUT = ROOT / "fuzi_org_chart.html"
PNG_OUT = ROOT / "fuzi_org_chart.png"


def normalize_manager(value):
    if not value:
        return ""
    text = str(value).strip()
    corrections = {
        "Own": "",
        "Ashwani Kumar Saini": "Ashwani Kumar",
        "Bhawar Choudhary": "Bhanwar Choudhary",
    }
    return corrections.get(text, text)


def normalize_dept(value):
    if not value:
        return ""
    text = str(value).strip().lower()
    corrections = {
        "break down": "Breakdown",
        "commissioing": "Commissioning",
        "installation": "Installation",
        "sales": "Sales",
        "service": "Service",
        "gad": "GAD",
        "accounts": "Accounts",
        "tender": "Tender",
        "factory": "Factory",
        "backoffice": "Back Office",
    }
    return corrections.get(text, str(value).strip().title())


def fmt_phone(value):
    if value in (None, ""):
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text


def read_people():
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    ws = wb.active
    people = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        _, dept, name, phone, designation, manager = row
        if not name:
            continue
        name = str(name).strip()
        designation = str(designation or "").strip()
        dept = normalize_dept(dept)
        manager = normalize_manager(manager)

        # The source repeats Atul Singhal as Sales Head. Keep one executive node
        # and represent Sales as a department below him.
        if name == "Atul Singhal" and designation.lower() == "sales head":
            continue

        people.append(
            {
                "name": name,
                "dept": dept,
                "designation": designation,
                "phone": fmt_phone(phone),
                "manager": manager,
            }
        )
    return people


def build_groups(people):
    by_name = {p["name"]: p for p in people}
    ceo = by_name["Atul Singhal"]

    groups = [
        ("Sales", ["Anita Boylla", "Pankaj Jangam"], "Atul Singhal"),
        (
            "Installation",
            [
                "Ashwani Kumar",
                "Ankush Sharma",
                "Bhawani Shankar Kumawat",
                "Rajesh Kumawat",
                "Shiv Dayal Yadav",
                "Iqbal Khan",
                "Ansar Khan",
                "Shahwaj Mallik",
            ],
            "Atul Singhal",
        ),
        (
            "Breakdown",
            [
                "Bhanwar Choudhary",
                "Deepak Sharma",
                "Krishna Kumar Sharma",
                "Shankar Lal Kumawat",
                "Pushpraj Mehra",
                "Prashant Yadav",
                "Mohammad Iqbal",
            ],
            "Atul Singhal",
        ),
        (
            "Service",
            ["Jitendra Choudhary", "Arman Khan", "Sachin Yogi", "Ganpat Yogi", "Arbaz Khan"],
            "Atul Singhal",
        ),
        ("Commissioning", ["Vishram Kumawat", "Dharmendra Kumbhawat", "Kailash Chand Kumawat"], "Atul Singhal"),
        ("Accounts", ["Sandeep Sharma", "Shobhit Mudgal"], "Atul Singhal"),
        ("Factory", ["Roopchand Gurjar", "Rajendra Prasad Dhanaka", "Irfan Khan", "Shahrukh Khan", "Noshyad Khan"], "Ashwani Kumar"),
        ("Back Office", ["Jitendra Singh Hada", "Vinod Kumar", "Raj Kumar", "Aarush Gupta"], "Atul Singhal"),
        ("GAD / Tender", ["Diyanshu Bansal", "Bharat Singh Choudhary"], "Atul Singhal"),
    ]
    return ceo, [(title, [by_name[n] for n in names if n in by_name], lead) for title, names, lead in groups]


def wrap(text, max_len):
    words = str(text).split()
    lines = []
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if len(trial) <= max_len:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines or [""]


def node_svg(x, y, w, person, fill="#ffffff", stroke="#2f5f8f"):
    lines = [person["name"], person["designation"]]
    if person.get("phone"):
        lines.append(person["phone"])

    wrapped = []
    for i, line in enumerate(lines):
        max_len = 22 if i == 0 else 28
        wrapped.extend(wrap(line, max_len))

    h = 48 + 17 * max(0, len(wrapped) - 2)
    parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>']
    ty = y + 18
    for idx, line in enumerate(wrapped):
        cls = "name" if idx == 0 else "detail"
        parts.append(f'<text class="{cls}" x="{x + w / 2}" y="{ty}" text-anchor="middle">{escape(line)}</text>')
        ty += 16
    return "\n".join(parts), h


def generate_svg(ceo, groups):
    col_w = 240
    gap = 24
    left = 40
    top = 26
    group_y = 205
    row_gap = 12
    header_h = 34
    width = left * 2 + len(groups) * col_w + (len(groups) - 1) * gap
    group_heights = []
    for _, members, _ in groups:
        height = header_h + 12
        for member in members:
            line_count = sum(len(wrap(v, 22 if i == 0 else 28)) for i, v in enumerate([member["name"], member["designation"], member["phone"] if member["phone"] else ""]) if v)
            height += 48 + 17 * max(0, line_count - 2) + row_gap
        group_heights.append(height)
    height = group_y + max(group_heights) + 50

    css = """
    .title{font:700 28px Arial, sans-serif;fill:#17324d}
    .subtitle{font:400 13px Arial, sans-serif;fill:#536575}
    .group-title{font:700 14px Arial, sans-serif;fill:#ffffff;letter-spacing:.4px}
    .name{font:700 13px Arial, sans-serif;fill:#17324d}
    .detail{font:400 11px Arial, sans-serif;fill:#415466}
    .line{stroke:#8ba3b9;stroke-width:1.4;fill:none}
    """
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        "<style>" + css + "</style>",
        '<rect width="100%" height="100%" fill="#f6f8fb"/>',
        f'<text class="title" x="{width / 2}" y="{top + 4}" text-anchor="middle">Fuzi Organization Chart</text>',
        f'<text class="subtitle" x="{width / 2}" y="{top + 25}" text-anchor="middle">Based on Fuzi Staff Name &amp; Mobile No.</text>',
    ]

    ceo_w = 280
    ceo_x = width / 2 - ceo_w / 2
    ceo_y = 76
    svg, ceo_h = node_svg(ceo_x, ceo_y, ceo_w, ceo, fill="#e9f2ff", stroke="#1f5c99")
    parts.append(svg)

    mid_y = ceo_y + ceo_h + 35
    parts.append(f'<path class="line" d="M {width / 2} {ceo_y + ceo_h} V {mid_y}"/>')
    parts.append(f'<path class="line" d="M {left + col_w / 2} {mid_y} H {width - left - col_w / 2}"/>')

    palette = ["#1f5c99", "#357960", "#8a5a1f", "#7b4d8d", "#3b6f7f", "#6c654a", "#596a9b", "#8b4d5b", "#4f6b46"]
    for idx, (title, members, lead) in enumerate(groups):
        x = left + idx * (col_w + gap)
        parts.append(f'<path class="line" d="M {x + col_w / 2} {mid_y} V {group_y - 9}"/>')
        parts.append(f'<rect x="{x}" y="{group_y}" width="{col_w}" height="{header_h}" rx="8" fill="{palette[idx % len(palette)]}"/>')
        parts.append(f'<text class="group-title" x="{x + col_w / 2}" y="{group_y + 22}" text-anchor="middle">{escape(title)}</text>')
        y = group_y + header_h + 12
        for m_idx, member in enumerate(members):
            fill = "#fffaf0" if member["name"] == lead and lead != "Atul Singhal" else "#ffffff"
            svg, h = node_svg(x, y, col_w, member, fill=fill)
            parts.append(svg)
            if m_idx > 0:
                parts.append(f'<path class="line" d="M {x + col_w / 2} {y - row_gap} V {y}"/>')
            y += h + row_gap

    parts.append("</svg>")
    return "\n".join(parts)


def generate_html(svg):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fuzi Organization Chart</title>
  <style>
    body {{ margin: 0; background: #eef2f6; font-family: Arial, sans-serif; }}
    main {{ padding: 24px; overflow: auto; }}
    .sheet {{ display: inline-block; background: white; box-shadow: 0 10px 30px rgba(32,47,68,.18); }}
    @media print {{ body {{ background: white; }} main {{ padding: 0; }} .sheet {{ box-shadow: none; }} }}
  </style>
</head>
<body>
  <main><div class="sheet">{svg}</div></main>
</body>
</html>
"""


def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    path = Path("C:/Windows/Fonts") / name
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


def draw_round_rect(draw, box, radius, fill, outline, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_centered(draw, text, x, y, fnt, fill):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    draw.text((x - (bbox[2] - bbox[0]) / 2, y), text, font=fnt, fill=fill)


def draw_node(draw, x, y, w, person, fill="#ffffff", stroke="#2f5f8f"):
    name_font = font(13, True)
    detail_font = font(11)
    lines = [person["name"], person["designation"]]
    if person.get("phone"):
        lines.append(person["phone"])

    wrapped = []
    for i, line in enumerate(lines):
        max_len = 22 if i == 0 else 28
        wrapped.extend(wrap(line, max_len))

    h = 48 + 17 * max(0, len(wrapped) - 2)
    draw_round_rect(draw, (x, y, x + w, y + h), 8, fill, stroke, 2)
    ty = y + 7
    for idx, line in enumerate(wrapped):
        draw_centered(draw, line, x + w / 2, ty, name_font if idx == 0 else detail_font, "#17324d" if idx == 0 else "#415466")
        ty += 16
    return h


def generate_png(ceo, groups):
    col_w = 240
    gap = 24
    left = 40
    top = 26
    group_y = 205
    row_gap = 12
    header_h = 34
    width = left * 2 + len(groups) * col_w + (len(groups) - 1) * gap
    group_heights = []
    for _, members, _ in groups:
        height = header_h + 12
        for member in members:
            line_count = sum(len(wrap(v, 22 if i == 0 else 28)) for i, v in enumerate([member["name"], member["designation"], member["phone"] if member["phone"] else ""]) if v)
            height += 48 + 17 * max(0, line_count - 2) + row_gap
        group_heights.append(height)
    height = group_y + max(group_heights) + 50

    image = Image.new("RGB", (int(width), int(height)), "#f6f8fb")
    draw = ImageDraw.Draw(image)
    draw_centered(draw, "Fuzi Organization Chart", width / 2, top - 10, font(28, True), "#17324d")
    draw_centered(draw, "Based on Fuzi Staff Name & Mobile No.", width / 2, top + 24, font(13), "#536575")

    ceo_w = 280
    ceo_x = width / 2 - ceo_w / 2
    ceo_y = 76
    ceo_h = draw_node(draw, ceo_x, ceo_y, ceo_w, ceo, fill="#e9f2ff", stroke="#1f5c99")
    mid_y = ceo_y + ceo_h + 35
    line = "#8ba3b9"
    draw.line((width / 2, ceo_y + ceo_h, width / 2, mid_y), fill=line, width=2)
    draw.line((left + col_w / 2, mid_y, width - left - col_w / 2, mid_y), fill=line, width=2)

    palette = ["#1f5c99", "#357960", "#8a5a1f", "#7b4d8d", "#3b6f7f", "#6c654a", "#596a9b", "#8b4d5b", "#4f6b46"]
    title_font = font(14, True)
    for idx, (title, members, lead) in enumerate(groups):
        x = left + idx * (col_w + gap)
        draw.line((x + col_w / 2, mid_y, x + col_w / 2, group_y - 9), fill=line, width=2)
        draw_round_rect(draw, (x, group_y, x + col_w, group_y + header_h), 8, palette[idx % len(palette)], palette[idx % len(palette)], 1)
        draw_centered(draw, title, x + col_w / 2, group_y + 9, title_font, "#ffffff")
        y = group_y + header_h + 12
        for m_idx, member in enumerate(members):
            fill = "#fffaf0" if member["name"] == lead and lead != "Atul Singhal" else "#ffffff"
            h = draw_node(draw, x, y, col_w, member, fill=fill)
            if m_idx > 0:
                draw.line((x + col_w / 2, y - row_gap, x + col_w / 2, y), fill=line, width=2)
            y += h + row_gap

    image.save(PNG_OUT)


def main():
    people = read_people()
    ceo, groups = build_groups(people)
    svg = generate_svg(ceo, groups)
    SVG_OUT.write_text(svg, encoding="utf-8")
    HTML_OUT.write_text(generate_html(svg), encoding="utf-8")
    generate_png(ceo, groups)
    print(SVG_OUT)
    print(HTML_OUT)
    print(PNG_OUT)


if __name__ == "__main__":
    main()
