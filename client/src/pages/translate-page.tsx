import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, Image, Languages, ArrowLeft, X, Copy, Check, ArrowRightLeft, Type } from "lucide-react";
import { Link } from "wouter";

const LANGUAGES = [
  { code: "english", label: "English" },
  { code: "hindi", label: "Hindi" },
  { code: "sanskrit", label: "Sanskrit" },
  { code: "kannada", label: "Kannada" },
  { code: "telugu", label: "Telugu" },
  { code: "tamil", label: "Tamil" },
  { code: "bengali", label: "Bengali" },
  { code: "marathi", label: "Marathi" },
  { code: "gujarati", label: "Gujarati" },
  { code: "malayalam", label: "Malayalam" },
  { code: "french", label: "French" },
  { code: "german", label: "German" },
  { code: "spanish", label: "Spanish" },
  { code: "arabic", label: "Arabic" },
  { code: "chinese", label: "Chinese" },
  { code: "japanese", label: "Japanese" },
  { code: "korean", label: "Korean" },
  { code: "russian", label: "Russian" },
  { code: "portuguese", label: "Portuguese" },
  { code: "italian", label: "Italian" },
  { code: "thai", label: "Thai" },
  { code: "urdu", label: "Urdu" },
  { code: "persian", label: "Persian" },
  { code: "turkish", label: "Turkish" },
  { code: "vietnamese", label: "Vietnamese" },
  { code: "dutch", label: "Dutch" },
  { code: "polish", label: "Polish" },
  { code: "ukrainian", label: "Ukrainian" },
  { code: "greek", label: "Greek" },
  { code: "hebrew", label: "Hebrew" },
  { code: "swahili", label: "Swahili" },
  { code: "indonesian", label: "Indonesian" },
  { code: "malay", label: "Malay" },
  { code: "burmese", label: "Burmese" },
  { code: "tibetan", label: "Tibetan" },
  { code: "nepali", label: "Nepali" },
  { code: "sinhala", label: "Sinhala" },
  { code: "punjabi", label: "Punjabi" },
  { code: "odia", label: "Odia" },
  { code: "assamese", label: "Assamese" },
];

type InputMode = "text" | "image" | "transliterate";
type ResultTab = "original" | "translation";

interface PdfPageResult {
  page: number;
  originalText: string;
  translatedText: string;
}

interface ImageFileResult {
  type: "image";
  originalText: string;
  translatedText: string;
}

interface PdfFileResult {
  type: "pdf";
  pages: PdfPageResult[];
}

type FileResult = ImageFileResult | PdfFileResult;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} data-testid="button-copy">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function TabBar({ active, onTabChange, labels }: { active: string; onTabChange: (t: string) => void; labels: { key: string; label: string }[] }) {
  return (
    <div className="flex border-b border-border/60 mb-0">
      {labels.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            active === key
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid={`tab-${key}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TextResultView({ original, translated, resultLabel }: { original: string; translated: string; resultLabel?: string }) {
  const [tab, setTab] = useState<ResultTab>("translation");
  const content = tab === "original" ? original : translated;

  return (
    <Card className="overflow-hidden" data-testid="card-text-result">
      <div className="flex items-center justify-between border-b border-border/40 pr-1">
        <TabBar
          active={tab}
          onTabChange={(t) => setTab(t as ResultTab)}
          labels={[
            { key: "original", label: "Original" },
            { key: "translation", label: resultLabel || "Translation" },
          ]}
        />
        <CopyButton text={content} />
      </div>
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-result-content">
          {content}
        </div>
      </div>
    </Card>
  );
}

function FileResultView({ result, imagePreviewUrl }: { result: FileResult; imagePreviewUrl: string | null }) {
  const [tab, setTab] = useState<ResultTab>("translation");
  const [activePage, setActivePage] = useState(1);

  if (result.type === "image") {
    const content = tab === "original" ? result.originalText : result.translatedText;
    return (
      <div className="space-y-4">
        {imagePreviewUrl && (
          <Card className="p-3 flex items-center justify-center">
            <img
              src={imagePreviewUrl}
              alt="Uploaded"
              className="max-h-[200px] rounded-md object-contain"
              data-testid="img-preview"
            />
          </Card>
        )}
        <Card className="overflow-hidden" data-testid="card-image-result">
          <div className="flex items-center justify-between border-b border-border/40 pr-1">
            <TabBar
              active={tab}
              onTabChange={(t) => setTab(t as ResultTab)}
              labels={[
                { key: "original", label: "Extracted Text" },
                { key: "translation", label: "Translation" },
              ]}
            />
            <CopyButton text={content} />
          </div>
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-image-result">
              {content}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const pages = result.pages;
  const currentPage = pages.find((p) => p.page === activePage) || pages[0];
  const content = tab === "original" ? currentPage?.originalText : currentPage?.translatedText;

  return (
    <div className="space-y-3">
      {pages.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap" data-testid="pdf-page-tabs">
          {pages.map((p) => (
            <Button
              key={p.page}
              variant={activePage === p.page ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePage(p.page)}
              data-testid={`button-page-${p.page}`}
            >
              Page {p.page}
            </Button>
          ))}
        </div>
      )}
      <Card className="overflow-hidden" data-testid="card-pdf-result">
        <div className="flex items-center justify-between border-b border-border/40 pr-1">
          <TabBar
            active={tab}
            onTabChange={(t) => setTab(t as ResultTab)}
            labels={[
              { key: "original", label: "Original Text" },
              { key: "translation", label: "Translation" },
            ]}
          />
          <CopyButton text={content || ""} />
        </div>
        {pages.length > 1 && (
          <div className="px-4 pt-3 pb-0">
            <span className="text-xs font-medium text-muted-foreground">
              Page {activePage} of {pages.length}
            </span>
          </div>
        )}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-pdf-result">
            {content || "No text found on this page."}
          </div>
        </div>
      </Card>
    </div>
  );
}

function LanguageSelector({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
  onSwap,
}: {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceChange: (v: string) => void;
  onTargetChange: (v: string) => void;
  onSwap: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
        <Select value={sourceLanguage} onValueChange={onSourceChange}>
          <SelectTrigger className="w-[130px] text-xs" data-testid="select-source-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto" data-testid="option-lang-auto">Auto-detect</SelectItem>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code} data-testid={`option-src-lang-${l.code}`}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSwap}
        title="Swap languages"
        data-testid="button-swap-languages"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </Button>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
        <Select value={targetLanguage} onValueChange={onTargetChange}>
          <SelectTrigger className="w-[130px] text-xs" data-testid="select-target-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code} data-testid={`option-tgt-lang-${l.code}`}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function TranslatePage() {
  const [mode, setMode] = useState<InputMode>("text");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("english");
  const [textContent, setTextContent] = useState("");
  const [textResult, setTextResult] = useState("");
  const [transliterateResult, setTransliterateResult] = useState("");
  const [fileResult, setFileResult] = useState<FileResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const swapLanguages = () => {
    if (sourceLanguage === "auto") return;
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
  };

  const handleTextTranslate = async () => {
    if (!textContent.trim()) return;
    setIsLoading(true);
    setError("");
    setTextResult("");
    try {
      const body: any = { content: textContent, targetLanguage };
      if (sourceLanguage !== "auto") body.sourceLanguage = sourceLanguage;
      const res = await fetch("/api/gemini/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setTextResult(data.translated);
    } catch (err: any) {
      setError(err.message || "Translation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransliterate = async () => {
    if (!textContent.trim()) return;
    setIsLoading(true);
    setError("");
    setTransliterateResult("");
    try {
      const body: any = { content: textContent, targetLanguage };
      if (sourceLanguage !== "auto") body.sourceLanguage = sourceLanguage;
      const res = await fetch("/api/gemini/transliterate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setTransliterateResult(data.transliterated);
    } catch (err: any) {
      setError(err.message || "Transliteration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileTranslate = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setError("");
    setFileResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("targetLanguage", targetLanguage);
      const res = await fetch("/api/gemini/translate-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (data.type === "pdf") {
        setFileResult({ type: "pdf", pages: data.pages });
      } else {
        setFileResult({
          type: "image",
          originalText: data.originalText || "",
          translatedText: data.translatedText || "",
        });
      }
    } catch (err: any) {
      setError(err.message || "File translation failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileResult(null);
      setError("");
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setImagePreviewUrl(url);
      } else {
        setImagePreviewUrl(null);
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFileResult(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={mode === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("text"); setError(""); }}
            className="gap-1.5"
            data-testid="button-mode-text"
          >
            <FileText className="h-3.5 w-3.5" />
            Translate
          </Button>
          <Button
            variant={mode === "transliterate" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("transliterate"); setError(""); }}
            className="gap-1.5"
            data-testid="button-mode-transliterate"
          >
            <Type className="h-3.5 w-3.5" />
            Transliterate
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
        </div>

        <LanguageSelector
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onSourceChange={setSourceLanguage}
          onTargetChange={setTargetLanguage}
          onSwap={swapLanguages}
        />

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-error">
            {error}
          </div>
        )}

        {mode === "text" && (
          <div className="space-y-4">
            <Card className="p-4">
              <Textarea
                placeholder="Paste or type text to translate..."
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
              <TextResultView original={textContent} translated={textResult} />
            )}
          </div>
        )}

        {mode === "transliterate" && (
          <div className="space-y-4">
            <Card className="p-4">
              <Textarea
                placeholder="Paste or type text to transliterate..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="min-h-[150px] resize-y border-0 focus-visible:ring-0 text-sm"
                data-testid="textarea-transliterate-source"
              />
            </Card>
            <div className="flex justify-end">
              <Button
                onClick={handleTransliterate}
                disabled={isLoading || !textContent.trim()}
                className="gap-1.5"
                data-testid="button-transliterate-text"
              >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Transliterate
              </Button>
            </div>
            {transliterateResult && (
              <TextResultView original={textContent} translated={transliterateResult} resultLabel="Transliteration" />
            )}
          </div>
        )}

        {mode === "image" && (
          <div className="space-y-4">
            <Card
              className="p-5 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[140px]"
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
                <div className="flex flex-col items-center gap-2">
                  {imagePreviewUrl && (
                    <img
                      src={imagePreviewUrl}
                      alt="Preview"
                      className="max-h-[120px] rounded-md object-contain"
                      data-testid="img-upload-preview"
                    />
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    {selectedFile.type === "application/pdf" ? (
                      <FileText className="h-4 w-4 text-primary" />
                    ) : (
                      <Image className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      data-testid="button-clear-file"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
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
                onClick={handleFileTranslate}
                disabled={isLoading || !selectedFile}
                className="gap-1.5"
                data-testid="button-translate-file"
              >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Translate
              </Button>
            </div>
            {fileResult && (
              <FileResultView result={fileResult} imagePreviewUrl={imagePreviewUrl} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
