/**
 * AI Provider Abstraction Layer
 * Supports both OpenAI and LLM Core Services (LLaMA/self-hosted)
 */

// Determine which provider to use
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai' // 'openai' or 'llm-core'

// LLM Core Services configuration
const LLM_CORE_URL = process.env.LLM_CORE_URL || 'http://localhost:8000'
const LLM_CORE_API_KEY = process.env.LLM_CORE_API_KEY || ''
const LLM_CORE_MODEL = process.env.LLM_CORE_MODEL || 'llama-3-8b'

/**
 * Unified AI Provider Interface
 */
class AIProvider {
  constructor() {
    this.provider = AI_PROVIDER
    this.client = this._initializeClient()
  }

  _initializeClient() {
    if (this.provider === 'llm-core') {
      return new LLMCoreClient()
    } else {
      return new OpenAIClient()
    }
  }

  /**
   * Chat completion (non-streaming)
   * @param {Object} params
   * @param {Array} params.messages - Array of {role, content}
   * @param {string} [params.model] - Model name
   * @param {number} [params.temperature] - Temperature (0-2)
   * @param {number} [params.max_tokens] - Max tokens
   * @returns {Promise<Object>} {content, usage: {total_tokens, prompt_tokens, completion_tokens}}
   */
  async chatCompletion({ messages, model, temperature = 0.7, max_tokens = 1000 }) {
    return this.client.chatCompletion({ messages, model, temperature, max_tokens })
  }

  /**
   * Chat completion (streaming)
   * @param {Object} params
   * @returns {AsyncGenerator} Yields {content, done}
   */
  async *chatCompletionStream({ messages, model, temperature = 0.7, max_tokens = 1000 }) {
    yield* this.client.chatCompletionStream({ messages, model, temperature, max_tokens })
  }

  /**
   * Generate embeddings for text
   * @param {Object} params
   * @param {string} params.input - Text to embed (string or array of strings)
   * @param {string} [params.model] - Embedding model name
   * @param {number} [params.dimensions] - Embedding dimensions
   * @returns {Promise<Object>} {data: [{embedding: number[]}], usage: {total_tokens}}
   */
  async generateEmbedding({ input, model, dimensions }) {
    return this.client.generateEmbedding({ input, model, dimensions })
  }

  /**
   * Get provider name
   */
  getProviderName() {
    return this.provider
  }
}

/**
 * OpenAI Client Implementation
 */
class OpenAIClient {
  constructor() {
    // Initialize OpenAI client synchronously
    if (process.env.OPENAI_API_KEY) {
      // Use dynamic import at module level
      this._initPromise = this._initClient()
    } else {
      this.client = null
      this._initPromise = Promise.resolve(null)
    }
  }

  async _initClient() {
    try {
      const OpenAI = (await import('openai')).default
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      return this.client
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error)
      this.client = null
      return null
    }
  }

  async _ensureClient() {
    if (!this.client && process.env.OPENAI_API_KEY) {
      await this._initPromise
    }
    return this.client
  }

  async chatCompletion({ messages, model, temperature, max_tokens }) {
    const client = await this._ensureClient()
    if (!client) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env')
    }

    const response = await client.chat.completions.create({
      model: model || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages,
      temperature,
      max_tokens
    })

    return {
      content: response.choices[0]?.message?.content || '',
      usage: {
        total_tokens: response.usage?.total_tokens || 0,
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0
      }
    }
  }

  async *chatCompletionStream({ messages, model, temperature, max_tokens }) {
    const client = await this._ensureClient()
    if (!client) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env')
    }

    const completion = await client.chat.completions.create({
      model: model || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages,
      temperature,
      max_tokens,
      stream: true
    })

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        yield { content, done: false }
      }
    }
    yield { content: '', done: true }
  }

  async generateEmbedding({ input, model, dimensions }) {
    const client = await this._ensureClient()
    if (!client) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env')
    }

    const response = await client.embeddings.create({
      model: model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: typeof input === 'string' ? input : input,
      dimensions: dimensions || 1536
    })

    return {
      data: response.data.map(item => ({ embedding: item.embedding })),
      usage: {
        total_tokens: response.usage?.total_tokens || 0
      }
    }
  }
}

/**
 * LLM Core Services Client Implementation
 * Assumes OpenAI-compatible API endpoint
 */
class LLMCoreClient {
  constructor() {
    this.baseUrl = LLM_CORE_URL
    this.apiKey = LLM_CORE_API_KEY
    this.defaultModel = LLM_CORE_MODEL
  }

  async _makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    console.log(`[LLM Core] Making request to: ${url}`)
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      ...options.headers
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'POST',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      })

      if (!response.ok) {
        let errorText = 'Unknown error'
        try {
          errorText = await response.text()
        } catch (e) {
          errorText = `HTTP ${response.status} ${response.statusText}`
        }
        throw new Error(`LLM Core Services error: ${response.status} ${errorText}`)
      }

      return response.json()
    } catch (error) {
      // Handle network errors (fetch failed, connection refused, etc.)
      if (error.message.includes('fetch failed') || 
          error.message.includes('ECONNREFUSED') || 
          error.message.includes('ENOTFOUND') ||
          error.message.includes('Failed to fetch') ||
          error.cause?.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to LLM Core Services at ${this.baseUrl}.\n\n` +
          `Please check:\n` +
          `1. LLM_CORE_URL is correct in .env (currently: ${this.baseUrl})\n` +
          `2. LLM Core Services is running and accessible\n` +
          `3. Network connectivity is available\n\n` +
          `If you want to use OpenAI instead, set:\n` +
          `AI_PROVIDER=openai\n` +
          `OPENAI_API_KEY=sk-your-key-here`
        )
      }
      // Re-throw other errors
      throw error
    }
  }

  async chatCompletion({ messages, model, temperature, max_tokens }) {
    // Determine endpoint based on baseUrl
    // Groq URL is: https://api.groq.com/openai/v1 (already has /v1)
    // So we use: /chat/completions (not /v1/chat/completions)
    let endpoint
    if (this.baseUrl.includes('/openai/v1')) {
      // Already has /openai/v1, just add /chat/completions
      endpoint = '/chat/completions'
    } else if (this.baseUrl.includes('/v1')) {
      // Has /v1 but not /openai/v1, just add /chat/completions
      endpoint = '/chat/completions'
    } else {
      // No /v1, add /v1/chat/completions
      endpoint = '/v1/chat/completions'
    }
    
    try {
      // Try OpenAI-compatible endpoint first
      const response = await this._makeRequest(endpoint, {
        body: {
          model: model || this.defaultModel,
          messages,
          temperature,
          max_tokens
        }
      })

      return {
        content: response.choices?.[0]?.message?.content || '',
        usage: {
          total_tokens: response.usage?.total_tokens || 0,
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0
        }
      }
    } catch (error) {
      // Don't fallback to custom endpoint for Groq/OpenAI-compatible services
      // The error is likely a real API error, not a format issue
      if (this.baseUrl.includes('groq.com') || this.baseUrl.includes('openai.com') || this.baseUrl.includes('api.together.xyz')) {
        throw error // Re-throw for known OpenAI-compatible services
      }
      
      // Only try custom endpoint for self-hosted services
      console.warn('OpenAI-compatible endpoint failed, trying custom endpoint:', error.message)
      return this._chatCompletionCustom({ messages, model, temperature, max_tokens })
    }
  }

  async _chatCompletionCustom({ messages, model, temperature, max_tokens }) {
    // Custom LLM Core Services endpoint format
    const response = await this._makeRequest('/api/chat', {
      body: {
        model: model || this.defaultModel,
        messages,
        temperature,
        max_tokens
      }
    })

    // Adapt response format
    return {
      content: response.text || response.content || response.response || '',
      usage: {
        total_tokens: response.tokens_used || response.usage?.total_tokens || 0,
        prompt_tokens: response.input_tokens || response.usage?.prompt_tokens || 0,
        completion_tokens: response.output_tokens || response.usage?.completion_tokens || 0
      }
    }
  }

  async *chatCompletionStream({ messages, model, temperature, max_tokens }) {
    try {
      // Determine endpoint based on baseUrl
      const endpoint = this.baseUrl.includes('/v1') || this.baseUrl.includes('/openai/v1')
        ? '/chat/completions' 
        : '/v1/chat/completions'
      
      // Try OpenAI-compatible streaming endpoint
      const url = `${this.baseUrl}${endpoint}`
      const headers = {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model || this.defaultModel,
          messages,
          temperature,
          max_tokens,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`LLM Core Services error: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              yield { content: '', done: true }
              return
            }
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                yield { content, done: false }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      yield { content: '', done: true }
    } catch (error) {
      // Fallback: make non-streaming request and simulate streaming
      console.warn('Streaming not supported, falling back to non-streaming:', error.message)
      const result = await this.chatCompletion({ messages, model, temperature, max_tokens })
      // Simulate streaming by yielding chunks
      const chunkSize = 10
      for (let i = 0; i < result.content.length; i += chunkSize) {
        yield { content: result.content.slice(i, i + chunkSize), done: false }
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      yield { content: '', done: true }
    }
  }

  async generateEmbedding({ input, model, dimensions }) {
    try {
      // Determine endpoint based on baseUrl
      const endpoint = this.baseUrl.includes('/v1') || this.baseUrl.includes('/openai/v1')
        ? '/embeddings' 
        : '/v1/embeddings'
      
      // Try OpenAI-compatible embeddings endpoint first
      const response = await this._makeRequest(endpoint, {
        body: {
          model: model || this.defaultModel,
          input: typeof input === 'string' ? input : input,
          dimensions: dimensions || 1536
        }
      })

      // Adapt response format
      return {
        data: response.data?.map(item => ({ 
          embedding: item.embedding || item.vector || item 
        })) || [{ embedding: response.embedding || response.vector || [] }],
        usage: {
          total_tokens: response.usage?.total_tokens || response.tokens_used || 0
        }
      }
    } catch (error) {
      // Fallback to custom endpoint if OpenAI-compatible fails
      console.warn('OpenAI-compatible embeddings endpoint failed, trying custom endpoint:', error.message)
      return this._generateEmbeddingCustom({ input, model, dimensions })
    }
  }

  async _generateEmbeddingCustom({ input, model, dimensions }) {
    // Custom LLM Core Services embeddings endpoint format
    const response = await this._makeRequest('/api/embeddings', {
      body: {
        model: model || this.defaultModel,
        text: typeof input === 'string' ? input : input[0], // Handle single string or array
        dimensions: dimensions || 1536
      }
    })

    // Adapt response format
    return {
      data: [{
        embedding: response.embedding || response.vector || response.data || []
      }],
      usage: {
        total_tokens: response.tokens_used || response.usage?.total_tokens || 0
      }
    }
  }
}

// Export singleton instance
const aiProvider = new AIProvider()

export default aiProvider

// Export for direct use
export { AIProvider, OpenAIClient, LLMCoreClient }

