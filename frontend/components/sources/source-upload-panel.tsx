"use client";

import { useRef, useState } from "react";
import { FileUp, Link2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function SourceUploadPanel({
  onAddPdf,
  onAddUrl,
  onAddText,
}: {
  onAddPdf?: (file: File) => void;
  onAddUrl?: (url: string) => void;
  onAddText?: (text: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submitUrl = () => {
    const value = url.trim();

    if (!value) {
      return;
    }

    onAddUrl?.(value);
    setUrl("");
  };

  const submitText = () => {
    const value = text.trim();

    if (!value) {
      return;
    }

    onAddText?.(value);
    setText("");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onAddPdf?.(file);
    event.target.value = "";
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900 dark:text-slate-100">Add Source</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pdf" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pdf">PDF</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf">
            <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <FileUp className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-medium text-slate-900">Upload PDF</p>
              <p className="mt-1 text-sm text-slate-500">
                Drag and drop or browse to add lecture notes, handouts, or readings.
              </p>
              <Button
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-3">
            <div className="relative">
              <Link2 className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="pl-9"
              />
            </div>
            <Button onClick={submitUrl} disabled={!url.trim()}>
              Add URL Source
            </Button>
          </TabsContent>

          <TabsContent value="text" className="space-y-3">
            <div className="relative">
              <FileText className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your lecture notes or study material here"
                className="min-h-[180px] pl-9"
              />
            </div>
            <Button onClick={submitText} disabled={!text.trim()}>
              Add Text Source
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}