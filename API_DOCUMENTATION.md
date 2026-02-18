# Advaita Vaaridhi - API Documentation

**Base URL:** `https://dev.ekatmdhamlibrary.xoidlabs.com`

**Content Type:** All JSON endpoints accept and return `application/json` unless otherwise noted.

---

## Table of Contents

1. [Translation APIs (Gemini)](#1-translation-apis-gemini)
2. [Books](#2-books)
3. [Verses](#3-verses)
4. [Word Meanings & Translation](#4-word-meanings--translation)
5. [Commentary & Languages](#5-commentary--languages)
6. [Notes (Authenticated)](#6-notes-authenticated)
7. [User Preferences (Authenticated)](#7-user-preferences-authenticated)
8. [Authentication](#8-authentication)
9. [Error Handling](#9-error-handling)

---

## 1. Translation APIs (Gemini)

These endpoints use Google Gemini AI for translation. No authentication required.

### 1.1 Translate Text

Translates plain text from any language to a target language.

**Endpoint:** `POST /api/gemini/translate-text`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
| Field          | Type   | Required | Description                              |
|----------------|--------|----------|------------------------------------------|
| content        | string | Yes      | Text to translate (max 50,000 characters)|
| sourceLanguage | string | No       | Source language (e.g. "sanskrit", "hindi", "japanese"). Auto-detected if omitted. |
| targetLanguage | string | Yes      | Target language (any language worldwide, e.g. "english", "korean", "arabic", etc.) |

**Example Request:**
```json
POST https://dev.ekatmdhamlibrary.xoidlabs.com/api/gemini/translate-text

{
  "content": "धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः",
  "sourceLanguage": "sanskrit",
  "targetLanguage": "english"
}
```

**Success Response (200):**
```json
{
  "translated": "On the holy field of Kurukshetra, assembled and eager to fight"
}
```

**Error Responses:**
- `400` - Missing or invalid fields, or content too long
- `500` - Translation service error

```json
{ "error": "Content too long. Maximum 50,000 characters." }
```

**JavaScript Integration Example:**
```javascript
async function translateText(content, targetLanguage, sourceLanguage = null) {
  const body = { content, targetLanguage };
  if (sourceLanguage) body.sourceLanguage = sourceLanguage;

  const response = await fetch(
    "https://sacred-script-hub.replit.app/api/gemini/translate-text",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  return data.translated;
}

// Usage:
const result = await translateText("Hello World", "hindi", "english");
console.log(result); // "नमस्ते दुनिया"

// Without specifying source language (auto-detect):
const result2 = await translateText("こんにちは世界", "english");
console.log(result2); // "Hello World"
```

---

### 1.2 Transliterate Text

Transliterates text into any target language's script. Unlike translation (which changes the meaning to the target language), transliteration converts the text to be written in the script and phonetics of the target language while preserving the original meaning. Supports any language worldwide.

**Endpoint:** `POST /api/gemini/transliterate-text`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
| Field          | Type   | Required | Description                                         |
|----------------|--------|----------|-----------------------------------------------------|
| content        | string | Yes      | Text to transliterate (max 50,000 characters)       |
| sourceLanguage | string | No       | Source language (e.g. "english", "sanskrit"). Auto-detected if omitted. |
| targetLanguage | string | Yes      | Target language (any language, e.g. "hindi", "japanese", "arabic", "korean", etc.) |

**Example Request:**
```json
POST https://dev.ekatmdhamlibrary.xoidlabs.com/api/gemini/transliterate-text

{
  "content": "Om Namah Shivaya",
  "sourceLanguage": "english",
  "targetLanguage": "hindi"
}
```

**Success Response (200):**
```json
{
  "transliterated": "ॐ नमः शिवाय"
}
```

**Error Responses:**
- `400` - Missing or invalid fields, or content too long
- `500` - Transliteration service error

**JavaScript Integration Example:**
```javascript
async function transliterateText(content, targetLanguage, sourceLanguage = null) {
  const body = { content, targetLanguage };
  if (sourceLanguage) body.sourceLanguage = sourceLanguage;

  const response = await fetch(
    "https://sacred-script-hub.replit.app/api/gemini/transliterate-text",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  return data.transliterated;
}

// Usage:
const result = await transliterateText("Om Namah Shivaya", "hindi", "english");
console.log(result); // "ॐ नमः शिवाय"

// Transliterate Sanskrit to Japanese:
const result2 = await transliterateText("Om Namah Shivaya", "japanese", "english");
console.log(result2); // "オーム ナマハ シヴァーヤ"

// Without specifying source language (auto-detect):
const result3 = await transliterateText("Namaste", "arabic");
console.log(result3); // "ناماستي"
```

---

### 1.3 Translate Image

Extracts text from an image and translates it to the target language.

**Endpoint:** `POST /api/gemini/translate-image`

**Headers:**
```
Content-Type: multipart/form-data
```

**Request Body (FormData):**
| Field          | Type   | Required | Description                                      |
|----------------|--------|----------|--------------------------------------------------|
| file           | File   | Yes      | Image file (max 10MB)                            |
| targetLanguage | string | Yes      | Target language code                             |

**Supported File Types:** PNG, JPEG, WebP, GIF

**Example Request (JavaScript):**
```javascript
const formData = new FormData();
formData.append("file", imageFile);          // File object
formData.append("targetLanguage", "english");

const response = await fetch(
  "https://dev.ekatmdhamlibrary.xoidlabs.com/api/gemini/translate-image",
  { method: "POST", body: formData }
);
const data = await response.json();
```

**Success Response (200):**
```json
{
  "type": "image",
  "originalText": "The extracted text from the image in its original language",
  "translatedText": "The translated version of the extracted text"
}
```

**Error Responses:**
- `400` - Missing file, missing targetLanguage, or unsupported file type
- `500` - Image processing or translation error

---

### 1.4 Translate PDF

Extracts text from a PDF document page-by-page and translates each page.

**Endpoint:** `POST /api/gemini/translate-image`

(Same endpoint as image translation - PDF is detected automatically by file type)

**Headers:**
```
Content-Type: multipart/form-data
```

**Request Body (FormData):**
| Field          | Type   | Required | Description                                      |
|----------------|--------|----------|--------------------------------------------------|
| file           | File   | Yes      | PDF file (max 10MB)                              |
| targetLanguage | string | Yes      | Target language code                             |

**Example Request (JavaScript):**
```javascript
const formData = new FormData();
formData.append("file", pdfFile);            // File object (application/pdf)
formData.append("targetLanguage", "hindi");

const response = await fetch(
  "https://dev.ekatmdhamlibrary.xoidlabs.com/api/gemini/translate-image",
  { method: "POST", body: formData }
);
const data = await response.json();
```

**Success Response (200):**
```json
{
  "type": "pdf",
  "pages": [
    {
      "page": 1,
      "originalText": "Complete text from page 1",
      "translatedText": "Complete translation of page 1"
    },
    {
      "page": 2,
      "originalText": "Complete text from page 2",
      "translatedText": "Complete translation of page 2"
    }
  ]
}
```

**Error Responses:**
- `400` - Missing file, missing targetLanguage, or unsupported file type
- `500` - PDF processing or translation error

---

### 1.5 Example: Handling Both Image and PDF Responses

```javascript
async function translateFile(file, targetLanguage) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("targetLanguage", targetLanguage);

  const response = await fetch(
    "https://dev.ekatmdhamlibrary.xoidlabs.com/api/gemini/translate-image",
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();

  if (data.type === "pdf") {
    // PDF: iterate through pages
    data.pages.forEach(page => {
      console.log(`--- Page ${page.page} ---`);
      console.log("Original:", page.originalText);
      console.log("Translated:", page.translatedText);
    });
  } else {
    // Image: single result
    console.log("Original:", data.originalText);
    console.log("Translated:", data.translatedText);
  }

  return data;
}
```

---

## 2. Books

### 2.1 List All Books

Returns all available books in the library.

**Endpoint:** `GET /api/books`

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/books
```

**Success Response (200):**
```json
[
  {
    "id": "1",
    "title": "Isha Upanishad",
    "slug": "isha-upanishad",
    "author": "Shankaracharya",
    "description": "The Isha Upanishad with Shankaracharya Bhashya",
    "category": "Upanishad",
    "verseCount": 19
  }
]
```

---

### 2.2 Get Book by Slug

Retrieve a book using its URL-friendly slug.

**Endpoint:** `GET /api/books/by-slug/:slug`

**Path Parameters:**
| Parameter | Type   | Description           |
|-----------|--------|-----------------------|
| slug      | string | URL slug of the book  |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/books/by-slug/isha-upanishad
```

**Success Response (200):** Book object (same structure as listing)

**Error Response (404):**
```json
{ "error": "Book not found" }
```

---

### 2.3 Get Book with Verse Metadata

Returns a book along with its complete verse list and hierarchical structure.

**Endpoint:** `GET /api/books/:id`

**Path Parameters:**
| Parameter | Type   | Description  |
|-----------|--------|--------------|
| id        | string | Book ID      |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/books/1
```

**Success Response (200):**
```json
{
  "id": "1",
  "title": "Isha Upanishad",
  "slug": "isha-upanishad",
  "author": "Shankaracharya",
  "description": "...",
  "category": "Upanishad",
  "verses": [
    {
      "id": "1",
      "verseNumber": 0,
      "title": "Introduction",
      "adhyayNumber": null,
      "adhyayTitle": null,
      "khandaNumber": null,
      "khandaTitle": null
    }
  ]
}
```

---

### 2.4 Get Chapter Verses

Returns all verses for a specific chapter (adhyay) of a book.

**Endpoint:** `GET /api/books/:id/chapter/:adhyayNumber/verses`

**Path Parameters:**
| Parameter      | Type    | Description           |
|----------------|---------|-----------------------|
| id             | string  | Book ID               |
| adhyayNumber   | integer | Chapter number        |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/books/2/chapter/1/verses
```

**Success Response (200):** Array of verse objects for that chapter.

---

## 3. Verses

### 3.1 Get Verse by ID

Returns a single verse with full details.

**Endpoint:** `GET /api/verses/:id`

**Path Parameters:**
| Parameter | Type   | Description  |
|-----------|--------|--------------|
| id        | string | Verse ID     |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/verses/1
```

**Success Response (200):**
```json
{
  "id": "1",
  "bookId": "1",
  "verseNumber": 0,
  "title": "Introduction",
  "content": "...",
  "adhyayNumber": null,
  "adhyayTitle": null,
  "khandaNumber": null,
  "khandaTitle": null
}
```

---

### 3.2 Get Verse Translations

Returns all available translations for a verse in different languages/scripts.

**Endpoint:** `GET /api/verses/:id/translations`

**Path Parameters:**
| Parameter | Type   | Description  |
|-----------|--------|--------------|
| id        | string | Verse ID     |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/verses/1/translations
```

**Success Response (200):**
```json
[
  {
    "id": "1",
    "verseId": "1",
    "languageId": "1",
    "content": "...",
    "languageCode": "devanagari",
    "languageName": "Sanskrit"
  }
]
```

---

### 3.3 Get Verse Explanations (Commentaries)

Returns scholarly commentaries/explanations for a verse.

**Endpoint:** `GET /api/verses/:id/explanations`

**Path Parameters:**
| Parameter | Type   | Description  |
|-----------|--------|--------------|
| id        | string | Verse ID     |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/verses/1/explanations
```

**Success Response (200):**
```json
[
  {
    "id": "1",
    "verseId": "1",
    "author": "Shankaracharya",
    "languageCode": "devanagari",
    "content": "...",
    "explanationType": "bhashya"
  }
]
```

---

## 4. Word Meanings & Translation

### 4.1 Get Word Meanings for a Verse

Returns pre-scraped word-by-word meanings for a verse (primarily available for Bhagavad Gita).

**Endpoint:** `GET /api/verses/:id/word-meanings`

**Path Parameters:**
| Parameter | Type   | Description  |
|-----------|--------|--------------|
| id        | string | Verse ID     |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/verses/5/word-meanings
```

**Success Response (200):**
```json
[
  {
    "id": "1",
    "verseId": "5",
    "word": "dharma",
    "meaning": "righteousness",
    "position": 1
  }
]
```

---

### 4.2 AI Word Translation

Uses AI (OpenAI GPT-4o) to provide detailed word analysis with context from Shankaracharya's commentary.

**Endpoint:** `POST /api/translate-word`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
| Field             | Type   | Required | Description                                       |
|-------------------|--------|----------|---------------------------------------------------|
| word              | string | Yes      | The word to translate                             |
| sourceLanguage    | string | Yes      | Source language code                              |
| targetLanguage    | string | Yes      | Target language code                              |
| verseContext      | string | No       | The verse text for context                        |
| commentaryContext | string | No       | Commentary text for deeper contextual translation |

**Example Request:**
```json
POST https://dev.ekatmdhamlibrary.xoidlabs.com/api/translate-word

{
  "word": "आत्मा",
  "sourceLanguage": "devanagari",
  "targetLanguage": "english",
  "verseContext": "ईशा वास्यमिदं सर्वं...",
  "commentaryContext": "..."
}
```

**Success Response (200):**
```json
{
  "word": "आत्मा",
  "translation": "The Self / Soul",
  "grammaticalInfo": "Noun, masculine, nominative singular",
  "etymology": "From root 'at' meaning 'to move continuously'",
  "contextualMeaning": "In this context, refers to the Supreme Self...",
  "cached": false
}
```

Note: Results are cached in the database. Subsequent requests for the same word return `"cached": true`.

---

## 5. Commentary & Languages

### 5.1 Get Commentary Options for a Book

Returns available commentary authors and languages for a specific book.

**Endpoint:** `GET /api/books/:id/commentary-options`

**Path Parameters:**
| Parameter | Type   | Description  |
|-----------|--------|--------------|
| id        | string | Book ID      |

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/books/1/commentary-options
```

**Success Response (200):**
```json
{
  "authors": ["Shankaracharya", "Anandagiri"],
  "languages": ["devanagari", "english", "kannada", "telugu", "tamil"]
}
```

---

### 5.2 List All Languages

Returns all language definitions in the system.

**Endpoint:** `GET /api/languages`

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/languages
```

**Success Response (200):**
```json
[
  {
    "id": "1",
    "code": "devanagari",
    "name": "Sanskrit",
    "nativeName": "संस्कृतम्",
    "script": "Devanagari"
  }
]
```

---

### 5.3 List All Authors

Returns all distinct commentary authors.

**Endpoint:** `GET /api/authors`

**Example Request:**
```
GET https://dev.ekatmdhamlibrary.xoidlabs.com/api/authors
```

**Success Response (200):**
```json
["Shankaracharya", "Anandagiri", "Hiriyanna", "Sudarsana"]
```

---

## 6. Notes (Authenticated)

These endpoints require user authentication via session cookie.

### 6.1 Get Notes for a Verse

**Endpoint:** `GET /api/verses/:id/notes`

**Authentication:** Required (session cookie)

**Path Parameters:**
| Parameter | Type   | Description  |
|-----------|--------|--------------|
| id        | string | Verse ID     |

**Success Response (200):** Array of note objects belonging to the authenticated user.

```json
[
  {
    "id": "1",
    "userId": "user123",
    "verseId": "5",
    "content": "Important verse about dharma",
    "selectedText": "dharma-kshetra",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
]
```

---

### 6.2 Create a Note

**Endpoint:** `POST /api/verses/:id/notes`

**Authentication:** Required

**Request Body:**
| Field        | Type   | Required | Description                          |
|--------------|--------|----------|--------------------------------------|
| content      | string | Yes      | Note content (1-5000 characters)     |
| selectedText | string | No       | Highlighted text reference (max 2000)|

**Success Response (201):** Created note object.

---

### 6.3 Update a Note

**Endpoint:** `PATCH /api/notes/:id`

**Authentication:** Required

**Request Body:**
| Field   | Type   | Required | Description                      |
|---------|--------|----------|----------------------------------|
| content | string | Yes      | Updated content (1-5000 chars)   |

**Success Response (200):** Updated note object.

---

### 6.4 Delete a Note

**Endpoint:** `DELETE /api/notes/:id`

**Authentication:** Required

**Success Response (200):**
```json
{ "success": true }
```

---

## 7. User Preferences (Authenticated)

### 7.1 Update User Preferences

**Endpoint:** `PATCH /api/user/preferences`

**Authentication:** Required

**Request Body:**
| Field             | Type   | Required | Description                           |
|-------------------|--------|----------|---------------------------------------|
| preferredLanguage | string | No       | Language code for content display     |
| preferredAuthor   | string | No       | Preferred commentary author           |
| preferredTheme    | string | No       | `"light"` or `"dark"`                 |

**Example Request:**
```json
PATCH https://dev.ekatmdhamlibrary.xoidlabs.com/api/user/preferences

{
  "preferredLanguage": "kannada",
  "preferredAuthor": "Shankaracharya",
  "preferredTheme": "dark"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": { ... }
}
```

---

### 7.2 Update Preferred Language Only

**Endpoint:** `PATCH /api/user/preferred-language`

**Authentication:** Required

**Request Body:**
| Field    | Type   | Required | Description     |
|----------|--------|----------|-----------------|
| language | string | Yes      | Language code   |

**Success Response (200):**
```json
{ "success": true, "language": "kannada" }
```

---

## 8. Authentication

### 8.1 Get Current User

**Endpoint:** `GET /api/auth/user`

Returns the currently authenticated user or `null`.

**Success Response (200):**
```json
{
  "id": "user123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "profileImageUrl": "https://...",
  "preferredLanguage": "english",
  "preferredAuthor": "Shankaracharya",
  "preferredTheme": "light"
}
```

---

### 8.2 Login

**Endpoint:** `GET /api/login`

Initiates the login flow (Replit OIDC or email/password). Redirects the user.

---

### 8.3 Logout

**Endpoint:** `GET /api/logout`

Ends the user session and redirects to home.

---

## 9. Error Handling

All endpoints return errors in a consistent format:

```json
{
  "error": "Description of what went wrong"
}
```

**Common HTTP Status Codes:**
| Code | Meaning                                                     |
|------|-------------------------------------------------------------|
| 200  | Success                                                     |
| 201  | Created (for POST operations)                               |
| 400  | Bad Request - missing/invalid parameters                    |
| 401  | Unauthorized - authentication required                      |
| 404  | Not Found - resource doesn't exist                          |
| 500  | Internal Server Error - something went wrong on the server  |

---

## CORS / Cross-Origin Requests

If calling these APIs from a different domain, ensure your server or proxy handles CORS. For browser-based requests from other websites, you may need to configure CORS headers on the server side.

---

## Rate Limits

- **Text Translation:** Max content size: 50,000 characters per request
- **Text Transliteration:** Max content size: 50,000 characters per request
- **File Upload:** Max file size: 10MB
- **Gemini API:** Subject to Google Gemini rate limits (429 errors may occur during high usage)

---

## Supported Languages (Translation & Transliteration)

Both `/api/gemini/translate-text` and `/api/gemini/transliterate-text` support any language worldwide. Here are commonly used language codes:

| Code         | Language    | Code         | Language    |
|--------------|-------------|--------------|-------------|
| english      | English     | arabic       | Arabic      |
| hindi        | Hindi       | chinese      | Chinese     |
| sanskrit     | Sanskrit    | japanese     | Japanese    |
| kannada      | Kannada     | korean       | Korean      |
| telugu       | Telugu      | russian      | Russian     |
| tamil        | Tamil       | portuguese   | Portuguese  |
| bengali      | Bengali     | italian      | Italian     |
| marathi      | Marathi     | thai         | Thai        |
| gujarati     | Gujarati    | urdu         | Urdu        |
| malayalam    | Malayalam   | persian      | Persian     |
| french       | French      | turkish      | Turkish     |
| german       | German      | vietnamese   | Vietnamese  |
| spanish      | Spanish     | greek        | Greek       |
| dutch        | Dutch       | hebrew       | Hebrew      |
| polish       | Polish      | swahili      | Swahili     |
| ukrainian    | Ukrainian   | indonesian   | Indonesian  |
| nepali       | Nepali      | tibetan      | Tibetan     |
| sinhala      | Sinhala     | punjabi      | Punjabi     |
| odia         | Odia        | assamese     | Assamese    |
| burmese      | Burmese     | malay        | Malay       |

You can also use any other language name not listed here (e.g., "tagalog", "amharic", "yoruba", etc.) — the AI will handle it.

---

*Document Version: 1.1*
*Last Updated: February 2026*
*Base URL: https://sacred-script-hub.replit.app*
