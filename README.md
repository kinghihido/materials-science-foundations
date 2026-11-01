# 材料科学基础 · 课件放映室

北京大学「材料科学基础（上）」2026 秋季学期第 00–03 章课件，逐页高清放映。

- 章节目录：绪论 / 晶体学 / 晶体结构 / 半晶态与非晶态
- 415 页课件，1728px WebP 逐页导出
- 键盘翻页、连续滚动、全文检索、缩略图总览
- 阅读进度保存在浏览器本地
- 50 题章节自测：概念辨析 + 计算，提交后自动批改、给出分数与逐题解析

## 目录

```
index.html              首页
viewer.html             放映器
quiz.html               章节自测
assets/                 样式、脚本、图标
data/slides.json        全部页面图路径与文字（检索用）
data/manifest.json      章节清单
data/quiz.json          50 道单选题库（批改与解析）
slides/<章>/0001.webp   逐页课件图
thumbs/<章>/0001.webp   缩略图
pdf/                    原版 PDF（合并分册）
tools/build_slides.py   从源 PDF 重新导出
tools/build_quiz.py     生成题库 JSON
```

## 重新生成

把课件 PDF 放在 `tools/build_slides.py` 顶部 `SRC` 指向的目录，然后：

```bash
python tools/build_slides.py
```

脚本会重新导出全部 WebP、合并 PDF 并写入 `data/`。

题库在 `tools/build_quiz.py` 中维护，修改后运行：

```bash
python tools/build_quiz.py
```

会校验题号、选项与答案并重新生成 `data/quiz.json`。

## 说明

课件版权归北京大学材料科学与工程学院及授课教师所有，本站仅作个人学习索引。
