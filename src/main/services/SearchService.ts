import type { SearchResult } from '@shared/types'

/** Public SearXNG instances (no API key). We try each until one responds. */
const DEFAULT_SEARX_INSTANCES = [
  'https://searx.tiekoetter.com',
  'https://search.bus-hit.me',
  'https://searx.be'
]

export interface SearchConfig {
  /** If set, uses Brave Search API (paid) instead of free providers. */
  braveApiKey?: string
  /** Custom SearXNG base URL (optional). */
  searxInstanceUrl?: string
}

export class SearchService {
  constructor(private getConfig: () => SearchConfig) {}

  async search(query: string): Promise<SearchResult[]> {
    const { braveApiKey, searxInstanceUrl } = this.getConfig()

    if (braveApiKey?.trim()) {
      const brave = await this.searchBrave(query, braveApiKey.trim())
      if (brave.length) return brave
    }

    const instances = searxInstanceUrl?.trim()
      ? [searxInstanceUrl.trim().replace(/\/$/, ''), ...DEFAULT_SEARX_INSTANCES]
      : DEFAULT_SEARX_INSTANCES

    for (const base of instances) {
      const results = await this.searchSearx(query, base)
      if (results.length) return results
    }

    const ddg = await this.searchDuckDuckGo(query)
    if (ddg.length) return ddg

    console.warn('[SlowBurn] All free search providers failed for query:', query)
    return []
  }

  private async searchBrave(query: string, apiKey: string): Promise<SearchResult[]> {
    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search')
      url.searchParams.set('q', query)
      url.searchParams.set('count', '5')

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey
        }
      })

      if (!response.ok) return []

      const data = (await response.json()) as {
        web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
      }

      return this.normalize(
        (data.web?.results ?? []).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.description
        }))
      )
    } catch (err) {
      console.error('[SlowBurn] Brave search error:', err)
      return []
    }
  }

  private async searchSearx(query: string, baseUrl: string): Promise<SearchResult[]> {
    try {
      const url = new URL(`${baseUrl}/search`)
      url.searchParams.set('q', query)
      url.searchParams.set('format', 'json')
      url.searchParams.set('categories', 'general')

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'SlowBurn-Agent/1.0' },
        signal: AbortSignal.timeout(15_000)
      })

      if (!response.ok) return []

      const data = (await response.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string }>
      }

      return this.normalize(
        (data.results ?? []).slice(0, 5).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content
        }))
      )
    } catch {
      return []
    }
  }

  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
      const response = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SlowBurn-Agent/1.0'
        },
        body: new URLSearchParams({ q: query }),
        signal: AbortSignal.timeout(15_000)
      })

      if (!response.ok) return []

      const html = await response.text()
      return this.parseDuckDuckGoHtml(html)
    } catch (err) {
      console.error('[SlowBurn] DuckDuckGo search error:', err)
      return []
    }
  }

  private parseDuckDuckGoHtml(html: string): SearchResult[] {
    const results: SearchResult[] = []
    const blockRegex =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi

    let match: RegExpExecArray | null
    while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
      let url = match[1]
      if (url.startsWith('//')) url = `https:${url}`
      const title = this.stripHtml(match[2])
      const snippet = this.stripHtml(match[3])
      if (title && url && snippet) {
        results.push({ title, url, snippet })
      }
    }

    return results
  }

  private stripHtml(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }

  private normalize(
    items: Array<{ title?: string; url?: string; snippet?: string }>
  ): SearchResult[] {
    return items
      .map((r) => ({
        title: r.title?.trim() || 'Untitled',
        url: r.url?.trim() || '',
        snippet: r.snippet?.trim() || ''
      }))
      .filter((r) => r.title && r.url && r.snippet)
  }
}
