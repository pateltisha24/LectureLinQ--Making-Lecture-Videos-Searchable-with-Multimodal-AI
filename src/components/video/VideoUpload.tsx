"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Link as LinkIcon,
  Loader2,
  Film,
  AlertCircle,
  Info,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateVideo } from "@/hooks/useVideos";
import { toast } from "sonner";
import axios from "axios";

export function VideoUpload() {
  const router = useRouter();
  const { mutateAsync: createVideo } = useCreateVideo();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Direct URL state
  const [directUrl, setDirectUrl] = useState("");
  const [directUrlError, setDirectUrlError] = useState("");

  // ── File upload ─────────────────────────────────────────────────────────────

  async function handleFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !file) return;
    setLoading(true);
    try {
      const video = await createVideo({ title, description, sourceType: "upload" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("videoId", video.id);
      await axios.post("/api/videos/upload", formData);
      toast.success("Uploading! Processing will begin shortly.");
      router.push(`/videos/${video.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      console.error("[upload] error:", err);
      toast.error(msg ?? "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type.startsWith("video/")) {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    }
  }

  // ── Direct URL ──────────────────────────────────────────────────────────────

  function validateDirectUrl(input: string) {
    try {
      const host = new URL(input).hostname.replace("www.", "");
      if (host === "youtube.com" || host === "youtu.be")
        return "YouTube URLs aren't supported. Download the video first with `npm run download <url>` then use the Upload File tab.";
      if (host === "vimeo.com") return "Vimeo page URLs are not direct video files.";
    } catch { /* ignore */ }
    return "";
  }

  async function handleDirectUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateDirectUrl(directUrl);
    if (err) { setDirectUrlError(err); return; }
    if (!title.trim() || !directUrl.trim()) return;
    setLoading(true);
    try {
      const video = await createVideo({
        title, description, url: directUrl, sourceType: "url",
      });
      toast.success("Lecture added! Processing will begin shortly.");
      router.push(`/videos/${video.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Failed to add lecture.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Tabs defaultValue="file">
      <TabsList className="mb-6 grid w-full grid-cols-2">
        <TabsTrigger value="file" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload File
        </TabsTrigger>
        <TabsTrigger value="url" className="gap-2">
          <LinkIcon className="h-4 w-4" />
          From URL
        </TabsTrigger>
      </TabsList>

      {/* Shared title / description fields */}
      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">
            Lecture Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. Neural Networks — Chapter 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The name shown in your lecture library.
          </p>
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="Brief description of the lecture..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5"
            rows={2}
          />
        </div>
      </div>

      {/* ── File Upload Tab ── */}
      <TabsContent value="file">
        <form onSubmit={handleFileSubmit} className="space-y-4">
          {/* YouTube tip */}
          <div className="flex gap-2 rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300">
            <Terminal className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Long YouTube lecture? Use the downloader.</p>
              <p className="mt-0.5 opacity-80">
                Run{" "}
                <code className="rounded bg-purple-100 px-1 dark:bg-purple-900">
                  npm run download &quot;youtube-url&quot;
                </code>{" "}
                — it downloads, compresses, and auto-splits videos &gt; 50 min into
                parts. Upload each part here.
              </p>
            </div>
          </div>

          <div>
            <Label>
              Video File <span className="text-destructive">*</span>
            </Label>
            <div
              className={`mt-1.5 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : file
                    ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                    : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    if (!title)
                      setTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
                  }
                }}
              />
              <Film className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              {file ? (
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">Drop your lecture video here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    MP4, MOV, AVI, MKV up to 2 GB
                  </p>
                </div>
              )}
            </div>
          </div>
          <Button type="submit" disabled={loading || !title.trim() || !file} className="w-full">
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" />Upload Lecture</>
            )}
          </Button>
        </form>
      </TabsContent>

      {/* ── Direct URL Tab ── */}
      <TabsContent value="url">
        <form onSubmit={handleDirectUrlSubmit} className="space-y-4">
          <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Direct .mp4 file URLs only</p>
              <p className="mt-0.5 text-xs opacity-80">
                <strong>Google Drive:</strong> Share → change <code>/view</code> to{" "}
                <code>/uc?export=download</code> ·{" "}
                <strong>Dropbox:</strong> change <code>dl=0</code> to <code>dl=1</code>
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="direct-url">
              Video URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="direct-url"
              type="url"
              placeholder="https://example.com/lecture.mp4"
              value={directUrl}
              onChange={(e) => { setDirectUrl(e.target.value); setDirectUrlError(validateDirectUrl(e.target.value)); }}
              className={`mt-1.5 ${directUrlError ? "border-destructive" : ""}`}
            />
            {directUrlError && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                {directUrlError}
              </div>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading || !title.trim() || !directUrl.trim() || !!directUrlError}
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
            ) : (
              <><LinkIcon className="mr-2 h-4 w-4" />Add from URL</>
            )}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
