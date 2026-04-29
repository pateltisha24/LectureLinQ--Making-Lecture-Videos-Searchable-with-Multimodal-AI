import { VideoUpload } from "@/components/video/VideoUpload";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function UploadPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link href="/videos">
        <Button variant="ghost" size="sm" className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Lectures
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add a Lecture</CardTitle>
          <CardDescription>
            Upload a video file or add a lecture from a URL. Twelve Labs will
            process it to generate summaries, chapters, and enable Q&amp;A.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoUpload />
        </CardContent>
      </Card>
    </div>
  );
}
