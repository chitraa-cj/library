const STRAPI_URL = process.env.STRAPI_URL || 'https://giving-friendship-116a69f561.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

interface StrapiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

interface StrapiBook {
  id: number;
  attributes: {
    title: string;
    author: string;
    description: string;
    category: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  };
}

interface StrapiVerse {
  id: number;
  attributes: {
    verseNumber: number;
    sectionNumber: number;
    sectionTitle: string;
    originalText: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  };
}

interface StrapiTranslation {
  id: number;
  attributes: {
    content: string;
    languageCode: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  };
}

interface StrapiExplanation {
  id: number;
  attributes: {
    scholarName: string;
    scholarTitle: string;
    content: string;
    languageCode: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  };
}

async function strapiRequest<T>(endpoint: string): Promise<T | null> {
  if (!STRAPI_API_TOKEN) {
    console.warn('STRAPI_API_TOKEN not configured');
    return null;
  }

  try {
    const response = await fetch(`${STRAPI_URL}/api${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Strapi API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Strapi request failed:', error);
    return null;
  }
}

export async function fetchBooksFromStrapi(): Promise<StrapiResponse<StrapiBook[]> | null> {
  return strapiRequest<StrapiResponse<StrapiBook[]>>('/books?populate=*');
}

export async function fetchVersesFromStrapi(bookId?: number): Promise<StrapiResponse<StrapiVerse[]> | null> {
  const filter = bookId ? `&filters[book][id][$eq]=${bookId}` : '';
  return strapiRequest<StrapiResponse<StrapiVerse[]>>(`/verses?populate=*${filter}`);
}

export async function fetchTranslationsFromStrapi(verseId?: number): Promise<StrapiResponse<StrapiTranslation[]> | null> {
  const filter = verseId ? `&filters[verse][id][$eq]=${verseId}` : '';
  return strapiRequest<StrapiResponse<StrapiTranslation[]>>(`/translations?populate=*${filter}`);
}

export async function fetchExplanationsFromStrapi(verseId?: number): Promise<StrapiResponse<StrapiExplanation[]> | null> {
  const filter = verseId ? `&filters[verse][id][$eq]=${verseId}` : '';
  return strapiRequest<StrapiResponse<StrapiExplanation[]>>(`/explanations?populate=*${filter}`);
}

export async function testStrapiConnection(): Promise<{ connected: boolean; message: string }> {
  if (!STRAPI_API_TOKEN) {
    return { connected: false, message: 'STRAPI_API_TOKEN not configured' };
  }

  try {
    const response = await fetch(`${STRAPI_URL}/api`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
      },
    });

    if (response.ok) {
      return { connected: true, message: 'Successfully connected to Strapi' };
    } else {
      return { connected: false, message: `Strapi returned status ${response.status}` };
    }
  } catch (error) {
    return { connected: false, message: `Connection failed: ${error}` };
  }
}

export { STRAPI_URL };
