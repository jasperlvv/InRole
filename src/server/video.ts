import "server-only";
import { spawn } from "node:child_process";
import ffprobe from "@ffprobe-installer/ffprobe";
import { ApiProblem } from "./errors";

export async function inspectVideo(bytes: Buffer, mime: string): Promise<{ width: number; height: number; durationMs: number }> {
  if (mime === "video/mp4" ? bytes.toString("ascii", 4, 8) !== "ftyp" : bytes.subarray(0, 4).toString("hex") !== "1a45dfa3") throw new ApiProblem(415, "UNSUPPORTED_MEDIA_TYPE", "视频容器与类型不匹配。");
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFPROBE_PATH || ffprobe.path, ["-protocol_whitelist", "pipe", "-v", "error", "-show_streams", "-show_format", "-of", "json", "pipe:0"], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    let output = "";
    const timeout = setTimeout(() => { child.kill(); reject(new ApiProblem(415, "UNSUPPORTED_MEDIA_TYPE", "视频无法在限定时间内解析。")); }, 8000);
    child.stdout.on("data", chunk => { output += chunk; if (output.length > 1024 * 1024) child.kill(); });
    child.stdin.on("error", () => {});
    child.on("error", () => { clearTimeout(timeout); reject(new ApiProblem(503, "SERVICE_UNAVAILABLE", "视频处理服务暂不可用。")); });
    child.on("close", code => {
      clearTimeout(timeout);
      try {
        if (code || output.length > 1024 * 1024) throw new Error();
        const metadata = JSON.parse(output), streams = metadata.streams as { codec_type: string; codec_name: string; width?: number; height?: number; duration?: string }[];
        const video = streams.filter(item => item.codec_type === "video"), duration = Number(metadata.format?.duration || video[0]?.duration);
        if (video.length !== 1 || !["h264", "vp8", "vp9", "av1"].includes(video[0].codec_name) || streams.some(item => !["video", "audio"].includes(item.codec_type)) || !video[0].width || !video[0].height || video[0].width * video[0].height > 16000000 || !Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error();
        if (mime === "video/webm" && !String(metadata.format?.format_name).includes("webm")) throw new Error();
        if (mime === "video/mp4" && !String(metadata.format?.format_name).includes("mp4")) throw new Error();
        resolve({ width: video[0].width, height: video[0].height, durationMs: Math.ceil(duration * 1000) });
      } catch { reject(new ApiProblem(415, "UNSUPPORTED_MEDIA_TYPE", "请使用10分钟以内的有效MP4或WebM视频（H.264、VP8、VP9或AV1）。")); }
    });
    child.stdin.end(bytes);
  });
}
