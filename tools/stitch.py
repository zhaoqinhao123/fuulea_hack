#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「屏幕转印」录屏拼回原图。

用法：
    python3 stitch.py rec.mp4 --cols 2 --rows 2 -o out.png
    python3 stitch.py rec.mp4 --cols 3 --rows 2 --tile 1920x1200 -o out.png
    python3 stitch.py rec.mp4 --cols 2 --rows 2 --crop 0:0:1920:1200 -o out.png

只依赖 ffmpeg / ffprobe 与标准库，不需要 Pillow。
分块顺序与播放器一致：从左到右、从上到下（行优先）。
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

PROBE_FPS = 4          # 分段用的采样帧率
PROBE_W, PROBE_H = 32, 20   # 分段用的缩略尺寸
DIFF_TH = 8.0          # 相邻帧平均灰度差阈值（0-255）
MIN_SEG = 0.45         # 片段最短时长（秒），短于此视为过渡
BLACK_MEAN = 12.0      # 平均亮度低于此视为黑场


def run(cmd, **kw):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw)


def probe(path):
    r = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height,r_frame_rate:format=duration",
             "-of", "default=noprint_wrappers=1", path])
    if r.returncode != 0:
        raise SystemExit("ffprobe 失败：" + r.stderr.decode("utf-8", "ignore")[:400])
    info = {}
    for line in r.stdout.decode().splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            info[k.strip()] = v.strip()
    return info


def gray_frames(path):
    """按 PROBE_FPS 抽缩略灰度帧，返回 [(t, bytes)]"""
    size = PROBE_W * PROBE_H
    r = run(["ffmpeg", "-v", "error", "-i", path,
             "-vf", f"fps={PROBE_FPS},scale={PROBE_W}:{PROBE_H}:flags=area,format=gray",
             "-f", "rawvideo", "-"])
    if r.returncode != 0:
        raise SystemExit("抽帧失败：" + r.stderr.decode("utf-8", "ignore")[:400])
    data = r.stdout
    out = []
    n = len(data) // size
    for i in range(n):
        out.append((i / PROBE_FPS, data[i * size:(i + 1) * size]))
    return out


def mean_abs(a, b):
    if len(a) != len(b):
        return 255.0
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def brightness(buf):
    return sum(buf) / len(buf)


def segments(frames):
    """按相邻帧差异切段 -> [(t0, t1, buf)]"""
    if not frames:
        return []
    segs = []
    start = frames[0][0]
    ref = frames[0][1]
    last_t = frames[0][0]
    for t, buf in frames[1:]:
        if mean_abs(buf, ref) > DIFF_TH:
            segs.append((start, last_t, ref))
            start = t
            ref = buf
        last_t = t
    segs.append((start, last_t + 1.0 / PROBE_FPS, ref))
    return [s for s in segs if (s[1] - s[0]) >= MIN_SEG]


def grab_frame(path, t, out, crop=None):
    vf = ["-vf", f"crop={crop}"] if crop else []
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{max(0, t):.3f}", "-i", path,
           "-frames:v", "1", "-y", *vf, out]
    r = run(cmd)
    if r.returncode != 0 or not os.path.exists(out):
        raise SystemExit("抽帧失败：" + r.stderr.decode("utf-8", "ignore")[:400])
    return out


def stitch(frames, cols, rows, out, tile=None):
    inputs = []
    for f in frames:
        inputs += ["-i", f]
    parts = []
    idx = 0
    row_labels = []
    for r in range(rows):
        labels = []
        for c in range(cols):
            lab = f"v{idx}"
            parts.append(f"[{idx}:v]scale={tile[0]}:{tile[1]}[{lab}]" if tile else f"[{idx}:v]null[{lab}]")
            labels.append(f"[{lab}]")
            idx += 1
        if cols == 1:
            row_labels.append(labels[0])
        else:
            row = f"r{r}"
            parts.append("".join(labels) + f"hstack=inputs={cols}[{row}]")
            row_labels.append(f"[{row}]")
    if rows == 1:
        parts.append(f"{row_labels[0]}null[out]")
    else:
        parts.append("".join(row_labels) + f"vstack=inputs={rows}[out]")

    cmd = ["ffmpeg", "-v", "error", *inputs,
           "-filter_complex", ";".join(parts), "-map", "[out]", "-frames:v", "1", "-y", out]
    r = run(cmd)
    if r.returncode != 0 or not os.path.exists(out):
        raise SystemExit("拼接失败：" + r.stderr.decode("utf-8", "ignore")[:800])


def main():
    ap = argparse.ArgumentParser(description="把屏幕转印录屏拼回原图")
    ap.add_argument("video")
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--tile", help="记录时的设备像素块尺寸，如 1920x1200（可选，用于对齐）")
    ap.add_argument("--crop", help="先裁掉录屏边缘，格式 x:y:w:h")
    ap.add_argument("-o", "--out", default="stitched.png")
    ap.add_argument("--keep", action="store_true", help="保留中间帧")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        raise SystemExit("找不到文件：" + args.video)
    need = args.cols * args.rows
    info = probe(args.video)
    print(f"视频 {info.get('width')}x{info.get('height')}  时长 {float(info.get('duration', 0)):.1f}s  需要 {need} 块")

    frames = gray_frames(args.video)
    segs = segments(frames)
    print(f"检测到 {len(segs)} 个稳定片段")

    tiles = [s for s in segs if brightness(s[2]) > BLACK_MEAN]
    if len(tiles) != need:
        print(f"警告：非黑片段 {len(tiles)} 个，期望 {need} 个；取最长的 {need} 个")
        tiles = sorted(tiles, key=lambda s: s[1] - s[0], reverse=True)[:need]
        tiles = sorted(tiles, key=lambda s: s[0])
    if len(tiles) < need:
        raise SystemExit(f"片段不够：只有 {len(tiles)} 个，需要 {need} 个。是不是录屏没覆盖全程？")

    tile = None
    if args.tile:
        w, h = args.tile.lower().split("x")
        tile = (int(w), int(h))

    tmp = tempfile.mkdtemp(prefix="stitch_")
    try:
        files = []
        for i, (t0, t1, _) in enumerate(tiles):
            mid = (t0 + t1) / 2
            p = os.path.join(tmp, f"f{i:02d}.png")
            grab_frame(args.video, mid, p, args.crop)
            files.append(p)
            print(f"  块 {i + 1}: t={mid:.2f}s")

        stitch(files, args.cols, args.rows, args.out, tile)
        print("已写出：" + args.out)
        if args.keep:
            print("中间帧保留在：" + tmp)
        else:
            shutil.rmtree(tmp, ignore_errors=True)
    except Exception:
        if args.keep:
            print("中间帧：" + tmp)
        raise


if __name__ == "__main__":
    main()
