import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

function getModel() {
  return getGenAI().getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      maxOutputTokens: 8192,
    },
  });
}

export async function translateText(content: string, targetLanguage: string): Promise<string> {
  const model = getModel();

  const prompt = `Translate the following text completely to ${targetLanguage}. You MUST translate the ENTIRE text without skipping, truncating, or summarizing any part. Return ONLY the translated text, nothing else.\n\nText:\n${content}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

export async function translateTextChunked(content: string, targetLanguage: string): Promise<string> {
  const CHUNK_SIZE = 3000;
  if (content.length <= CHUNK_SIZE) {
    return translateText(content, targetLanguage);
  }

  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  const results: string[] = [];
  for (const chunk of chunks) {
    const translated = await translateText(chunk, targetLanguage);
    results.push(translated);
  }

  return results.join("\n\n");
}

export interface ImageTranslationResult {
  originalText: string;
  translatedText: string;
}

export async function translateImage(
  imageBuffer: Buffer,
  mimeType: string,
  targetLanguage: string
): Promise<ImageTranslationResult> {
  const model = getModel();

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType: mimeType,
    },
  };

  const prompt = `This image contains text content. Please:
1. Extract ALL the text from this image completely - do NOT skip or truncate any part
2. Translate ALL the extracted text to ${targetLanguage} completely

You MUST return a valid JSON object in this exact format (no markdown, no code blocks, just raw JSON):
{"originalText": "the complete extracted text here", "translatedText": "the complete translated text here"}`;

  const result = await model.generateContent([prompt, imagePart]);
  const response = result.response;
  const text = response.text().trim();

  try {
    const cleaned = text.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    const origMatch = text.match(/---\s*ORIGINAL\s*TEXT\s*---\s*([\s\S]*?)---\s*TRANSLATED/i);
    const transMatch = text.match(/---\s*TRANSLATED\s*TEXT[^-]*---\s*([\s\S]*?)$/i);
    return {
      originalText: origMatch?.[1]?.trim() || text,
      translatedText: transMatch?.[1]?.trim() || text,
    };
  }
}

export interface PdfPageResult {
  page: number;
  originalText: string;
  translatedText: string;
}

export async function translatePdf(
  pdfBuffer: Buffer,
  targetLanguage: string
): Promise<PdfPageResult[]> {
  const model = getModel();

  const pdfPart = {
    inlineData: {
      data: pdfBuffer.toString("base64"),
      mimeType: "application/pdf",
    },
  };

  const prompt = `This is a PDF document. Please:
1. Extract ALL text from EVERY page completely - do NOT skip or truncate any content
2. Translate ALL the extracted text to ${targetLanguage} completely

You MUST return a valid JSON array where each element represents one page. Format (no markdown, no code blocks, just raw JSON):
[{"page": 1, "originalText": "complete text from page 1", "translatedText": "complete translation of page 1"}, {"page": 2, "originalText": "complete text from page 2", "translatedText": "complete translation of page 2"}]

If the PDF has only one page, still return an array with one element. Extract and translate ALL content completely.`;

  const result = await model.generateContent([prompt, pdfPart]);
  const response = result.response;
  const text = response.text().trim();

  try {
    const cleaned = text.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((p: any, i: number) => ({
        page: p.page || i + 1,
        originalText: p.originalText || "",
        translatedText: p.translatedText || "",
      }));
    }
    return [{ page: 1, originalText: parsed.originalText || text, translatedText: parsed.translatedText || text }];
  } catch {
    return [{ page: 1, originalText: text, translatedText: text }];
  }
}
