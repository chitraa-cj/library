import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, Image, Languages, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const LANGUAGES = [
  { code: "english", label: "English" },
  { code: "hindi", label: "Hindi (हिन्दी)" },
  { code: "sanskrit", label: "Sanskrit (संस्कृतम्)" },
  { code: "kannada", label: "Kannada (ಕನ್ನಡ)" },
  { code: "telugu", label: "Telugu (తెలుగు)" },
  { code: "tamil", label: "Tamil (தமிழ்)" },
  { code: "bengali", label: "Bengali (বাংলা)" },
  { code: "marathi", label: "Marathi (मराठी)" },
  { code: "gujarati", label: "Gujarati (ગુજરાતી)" },
  { code: "malayalam", label: "Malayalam (മലയാളം)" },
  { code: "french", label: "French" },
  { code: "german", label: "German" },
  { code: "spanish", label: "Spanish" },
];

type TabMode = "text" | "image";

export default function TranslatePage() {
  const [mode, setMode] = useState<TabMode>("text");
  const [targetLanguage, setTargetLanguage] = useState("english");
  const [textContent, setTextContent] = useState("");
  const [textResult, setTextResult] = useState("");
  const [imageResult, setImageResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextTranslate = async () => {
    if (!textContent.trim()) return;
    setIsLoading(true);
    setError("");
    setTextResult("");
    try {
      const res = await fetch("/api/gemini/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textContent, targetLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTextResult(data.translated);
    } catch (err: any) {
      setError(err.message || "Translation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageTranslate = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setError("");
    setImageResult("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("targetLanguage", targetLanguage);
      const res = await fetch("/api/gemini/translate-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImageResult(data.result);
    } catch (err: any) {
      setError(err.message || "Image translation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImageResult("");
      setError("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Advaita Vaaridhi Translator</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={mode === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("text"); setError(""); }}
            className="gap-1.5"
            data-testid="button-mode-text"
          >
            <FileText className="h-3.5 w-3.5" />
            Text
          </Button>
          <Button
            variant={mode === "image" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("image"); setError(""); }}
            className="gap-1.5"
            data-testid="button-mode-image"
          >
            <Image className="h-3.5 w-3.5" />
            Image / PDF
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Translate to:</span>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger className="w-[160px] text-xs" data-testid="select-target-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.code} value={l.code} data-testid={`option-lang-${l.code}`}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-error">
            {error}
          </div>
        )}

        {mode === "text" && (
          <div className="space-y-4">
            <Card className="p-4">
              <Textarea
                placeholder="Enter text to translate..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="min-h-[150px] resize-y border-0 focus-visible:ring-0 text-sm"
                data-testid="textarea-source"
              />
            </Card>
            <div className="flex justify-end">
              <Button
                onClick={handleTextTranslate}
                disabled={isLoading || !textContent.trim()}
                className="gap-1.5"
                data-testid="button-translate-text"
              >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Translate
              </Button>
            </div>
            {textResult && (
              <Card className="p-4" data-testid="card-text-result">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Translation:</p>
                <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-translation-result">
                  {textResult}
                </div>
              </Card>
            )}
          </div>
        )}

        {mode === "image" && (
          <div className="space-y-4">
            <Card
              className="p-6 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[150px]"
              onClick={() => fileInputRef.current?.click()}
              data-testid="card-file-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file"
              />
              {selectedFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Click to upload an image or PDF (max 10MB)</p>
                  <p className="text-xs text-muted-foreground/60">PNG, JPEG, WebP, GIF, PDF</p>
                </>
              )}
            </Card>
            <div className="flex justify-end">
              <Button
                onClick={handleImageTranslate}
                disabled={isLoading || !selectedFile}
                className="gap-1.5"
                data-testid="button-translate-image"
              >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Translate
              </Button>
            </div>
            {imageResult && (
              <Card className="p-4" data-testid="card-image-result">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Result:</p>
                <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-image-result">
                  {imageResult}
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
