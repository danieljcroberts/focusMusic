#!/bin/sh
# Make a video loop seamlessly: the last FADE seconds are cross-faded into the first FADE seconds,
# so the loop point lands on a frame the viewer has already seen fading in. Output is FADE seconds shorter.
#   scripts/loop-video.sh in.mp4 out.mp4 FADE [filters applied to both parts first, e.g. "scale=1080:1080"]
# Needs ffmpeg and ffprobe. The clips in public/assets/scenes were made with:
#   scripts/loop-video.sh earth-small.mp4 public/assets/scenes/earth-night.mp4 2
#   scripts/loop-video.sh sdo-24hr.mp4 public/assets/scenes/sdo-sun.mp4 2 "scale=1080:1080"
#   scripts/loop-video.sh iss-aurora-1080p.mp4 public/assets/scenes/iss-aurora.mp4 3 "crop=1920:1020:0:0,scale=1280:-2"
set -e
in=$1; out=$2; fade=${3:-2}; pre=${4:-null}
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$in")
offset=$(awk -v d="$dur" -v f="$fade" 'BEGIN { printf "%.3f", d - 2 * f }')
# The head is read as a second input rather than trimmed from the first, so xfade sees two constant-frame-rate streams.
ffmpeg -v error -y -ss "$fade" -i "$in" -t "$fade" -i "$in" -an -filter_complex \
  "[0:v]${pre},fps=30,format=yuv420p[body];[1:v]${pre},fps=30,format=yuv420p[head];[body][head]xfade=transition=fade:duration=${fade}:offset=${offset}[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart "$out"
echo "$out: $dur s -> $(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$out") s, $(wc -c < "$out") bytes"
