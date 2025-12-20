'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [useStreaming, setUseStreaming] = useState(false) // Disable streaming by default for reliability
  const [debugInfo, setDebugInfo] = useState(null)
  
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)
  const currentUtteranceRef = useRef(null)

  // Initialize speech recognition and synthesis
  useEffect(() => {
    // Check browser support
    if (typeof window !== 'undefined') {
      // Speech Recognition (Speech-to-Text)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          recognitionRef.current = new SpeechRecognition()
          recognitionRef.current.continuous = false
          recognitionRef.current.interimResults = false // Disable interim results to avoid duplication
          recognitionRef.current.lang = 'en-US'
          recognitionRef.current.maxAlternatives = 1

          // Track the last final result to avoid duplicates
          let lastFinalIndex = -1

          recognitionRef.current.onresult = (event) => {
            try {
              // Only process new final results
              let newFinalTranscript = ''
              
              for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal && i > lastFinalIndex) {
                  newFinalTranscript += event.results[i][0].transcript
                  lastFinalIndex = i
                }
              }
              
              if (newFinalTranscript.trim()) {
                console.log('Final speech recognized:', newFinalTranscript)
                setInput(prev => {
                  // Append new final transcript to existing text
                  const baseText = prev.trim()
                  const newText = baseText ? baseText + ' ' + newFinalTranscript.trim() : newFinalTranscript.trim()
                  return newText
                })
              }
            } catch (err) {
              console.error('Error processing speech result:', err)
            }
          }
          
          recognitionRef.current.onstart = () => {
            console.log('Speech recognition started')
            setIsListening(true)
            lastFinalIndex = -1 // Reset on new session
          }

          recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error:', event.error)
            setIsListening(false)
            // Only show errors for critical issues
            if (event.error === 'not-allowed') {
              toast.error('Microphone permission denied. Please click the lock icon in your browser address bar and allow microphone access.', { duration: 6000 })
            } else if (event.error === 'no-speech') {
              // Silent - user may have stopped intentionally
              console.log('No speech detected')
              toast('No speech detected. Please try again.', { duration: 2000, icon: 'ℹ️' })
            } else if (event.error === 'aborted') {
              // Silent - user may have stopped intentionally
              console.log('Speech recognition aborted')
            } else if (event.error === 'network') {
              // Speech Recognition API requires internet connection to Google's servers
              // This can also happen if the service is temporarily unavailable
              console.error('Speech recognition network error:', event)
              toast.error('Voice input requires internet connection. The browser sends audio to Google\'s speech service. Please check your internet connection or try typing instead.', { duration: 6000 })
            } else {
              console.warn('Speech recognition error:', event.error)
              toast.error(`Voice input error: ${event.error}. Please try typing instead.`, { duration: 4000 })
            }
          }

          recognitionRef.current.onend = () => {
            setIsListening(false)
            console.log('Speech recognition ended')
            // Clean up any interim text when recognition ends
            // The final result should already be in the input
          }

          recognitionRef.current.onaudiostart = () => {
            console.log('Audio capture started')
          }

          recognitionRef.current.onaudioend = () => {
            console.log('Audio capture ended')
          }
          
          // Note: onstart is set in the onresult handler section above
        } catch (err) {
          console.error('Failed to initialize speech recognition:', err)
          toast.error('Failed to initialize voice input. Please refresh the page.', { duration: 5000 })
        }
      } else {
        console.warn('Speech recognition not supported in this browser')
      }

      // Speech Synthesis (Text-to-Speech)
      if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis
        
        // Load voices when available
        const loadVoices = () => {
          const voices = synthRef.current.getVoices()
          console.log('Available voices:', voices.length)
          if (voices.length > 0) {
            console.log('Sample voices:', voices.slice(0, 5).map(v => v.name))
          }
        }
        
        // Load voices immediately if available
        loadVoices()
        
        // Also load when voices change
        synthRef.current.onvoiceschanged = loadVoices
      } else {
        console.warn('Speech synthesis not supported in this browser')
      }
    }

    // Load chat history on mount
    loadChatHistory()

    return () => {
      // Cleanup
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (currentUtteranceRef.current) {
        synthRef.current?.cancel()
      }
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChatHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await fetchJSON('/api/ai/chat?limit=50')
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to load chat history:', error)
      toast.error('Failed to load chat history')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Add user message to UI immediately
    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      if (useStreaming) {
        // Try streaming first, fallback to regular API on error
        try {
          await handleStreamingResponse(userMessage, tempUserMessage)
        } catch (streamError) {
          console.warn('Streaming failed, falling back to regular API:', streamError)
          // Fallback to regular API
          await handleRegularResponse(userMessage, tempUserMessage)
        }
      } else {
        // Use regular API
        await handleRegularResponse(userMessage, tempUserMessage)
      }
    } catch (error) {
      console.error('Chat error:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      // Show user-friendly error message
      let errorMessage = error.message || 'Failed to send message'
      
      if (errorMessage.includes('OpenAI API key') || errorMessage.includes('OPENAI_API_KEY')) {
        errorMessage = 'OpenAI API key not configured. Please add OPENAI_API_KEY=sk-your-actual-key to your .env file and restart the server.'
      } else if (errorMessage.includes('401') || errorMessage.includes('UNAUTHORIZED')) {
        errorMessage = 'Authentication failed. Please log in again.'
      } else if (errorMessage.includes('500') || errorMessage.includes('SERVER_ERROR')) {
        errorMessage = 'Server error. Please check your OpenAI API key and try again.'
      }
      
      toast.error(errorMessage, { duration: 5000 })
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
    } finally {
      setLoading(false)
    }
  }

  const handleRegularResponse = async (userMessage, tempUserMessage) => {
    console.log('📤 Sending message to API:', userMessage)
    setDebugInfo({ status: 'sending', message: 'Sending message to server...' })
    
    try {
      const startTime = Date.now()
      const response = await fetchJSON('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage })
      })
      const duration = Date.now() - startTime

      console.log('✅ API Response received:', response)
      console.log(`⏱️ Response time: ${duration}ms`)
      setDebugInfo({ status: 'success', message: `Response received in ${duration}ms` })

      if (!response) {
        throw new Error('No response from server')
      }

      if (!response.message) {
        console.error('❌ Response missing message field:', response)
        setDebugInfo({ status: 'error', message: 'Response missing message field' })
        throw new Error(response.error?.message || 'Invalid response from server. Please check your OpenAI API key configuration.')
      }

      // Replace temp message and add assistant response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id)
        return [
          ...filtered,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage,
            createdAt: new Date().toISOString()
          },
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.message,
            createdAt: new Date().toISOString()
          }
        ]
      })

      setDebugInfo(null) // Clear debug info on success

      // Auto-speak the response if voice is enabled
      if (isSpeaking && response.message) {
        speakText(response.message)
      }
    } catch (error) {
      console.error('❌ Error in handleRegularResponse:', error)
      setDebugInfo({ status: 'error', message: error.message })
      
      // Re-throw with more context
      if (error.message.includes('OpenAI API key') || error.message.includes('OPENAI_API_KEY')) {
        throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY=sk-your-key to your .env file and restart the server.')
      }
      if (error.message.includes('401') || error.message.includes('UNAUTHORIZED')) {
        throw new Error('Authentication failed. Please log in again.')
      }
      throw error
    }
  }

  const handleStreamingResponse = async (userMessage, tempUserMessage) => {
    const userMsgId = `user-${Date.now()}`
    const assistantMsgId = `assistant-${Date.now()}`
    let fullResponse = ''

    try {
      // Replace temp user message with real one
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id)
        return [
          ...filtered,
          {
            id: userMsgId,
            role: 'user',
            content: userMessage,
            createdAt: new Date().toISOString()
          },
          {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString()
          }
        ]
      })

      // Use fetch with streaming instead of EventSource (better for auth)
      const params = new URLSearchParams({ message: userMessage })
      const response = await fetch(`/api/ai/chat/stream?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to get response' }))
        throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.error) {
                throw new Error(data.error)
              }

              if (data.content) {
                fullResponse += data.content
                // Update assistant message in real-time
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMsgId
                    ? { ...msg, content: fullResponse }
                    : msg
                ))
              }

              if (data.done) {
                // Auto-speak the response if voice is enabled
                if (isSpeaking && fullResponse) {
                  speakText(fullResponse)
                }
                if (!fullResponse) {
                  throw new Error('Received empty response from AI. Please try again.')
                }
                return // Successfully completed
              }
            } catch (error) {
              console.error('Error parsing stream data:', error)
              // Continue processing other lines
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error)
      // Remove messages on error and show error message
      setMessages(prev => prev.filter(m => 
        m.id !== userMsgId && m.id !== assistantMsgId
      ))
      throw error
    }
  }

  const handleVoiceInput = async () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition not supported. Please use Chrome, Edge, or Safari.', { duration: 4000 })
      return
    }

    // Check internet connection before starting (Speech Recognition API requires internet)
    if (!navigator.onLine) {
      toast.error('No internet connection. Voice input requires internet to process speech. Please check your connection.', { duration: 5000 })
      return
    }

    if (isListening) {
      try {
        recognitionRef.current.stop()
        setIsListening(false)
        console.log('Stopped listening')
        toast('Stopped listening', { duration: 1500, icon: 'ℹ️' })
      } catch (err) {
        console.error('Error stopping recognition:', err)
        setIsListening(false)
      }
    } else {
      // Check microphone permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Permission granted, stop the stream and start recognition
        stream.getTracks().forEach(track => track.stop())
        
        try {
          // Clear input before starting to avoid duplication
          setInput('')
          recognitionRef.current.start()
          console.log('Started listening')
          toast.success('🎤 Listening... Speak clearly', { duration: 2500, icon: '🎤' })
        } catch (error) {
          console.error('Failed to start recognition:', error)
          setIsListening(false)
          if (error.name === 'InvalidStateError') {
            // Already listening or starting
            console.log('Recognition already active')
            toast('Already listening', { duration: 2000, icon: 'ℹ️' })
          } else {
            toast.error(`Failed to start voice input: ${error.message || 'Unknown error'}. Please try again.`, { duration: 4000 })
          }
        }
      } catch (permissionError) {
        console.error('Microphone permission error:', permissionError)
        setIsListening(false)
        if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
          toast.error('Microphone permission denied. Please click the lock icon in your browser address bar and allow microphone access, then try again.', { duration: 6000 })
        } else if (permissionError.name === 'NotFoundError') {
          toast.error('No microphone found. Please connect a microphone and try again.', { duration: 4000 })
        } else {
          toast.error('Cannot access microphone. Please check your browser settings and try again.', { duration: 4000 })
        }
      }
    }
  }

  const speakText = (text) => {
    if (!synthRef.current) {
      toast.error('Text-to-speech not supported in your browser')
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    // Clean text - remove markdown, extra spaces, etc.
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\n{2,}/g, '. ') // Replace multiple newlines with period
      .replace(/\n/g, '. ') // Replace single newlines with period
      .trim()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    // Friendly, warm tone settings (not professional)
    utterance.rate = 0.95 // Natural, friendly pace
    utterance.pitch = 1.15 // Higher pitch for friendlier, warmer tone
    utterance.volume = 1.0 // Full volume
    utterance.lang = 'en-US'

    // Prioritize Alex voice specifically (friendly, warm voice)
    const voices = synthRef.current.getVoices()
    if (voices.length > 0) {
      // First priority: Alex voice (friendly, warm male voice)
      let preferredVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('alex')
      )
      
      // If Alex not found, try other friendly voices
      if (!preferredVoice) {
        preferredVoice = voices.find(voice => 
          voice.name.includes('Samantha') || // Friendly female
          voice.name.includes('Karen') || // Friendly female
          voice.name.toLowerCase().includes('daniel') // Friendly male
        )
      }
      
      // Fallback to any English voice
      if (!preferredVoice) {
        preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.localService === false
        ) || voices.find(voice => voice.lang.startsWith('en'))
      }
      
      if (preferredVoice) {
        utterance.voice = preferredVoice
        const isAlex = preferredVoice.name.toLowerCase().includes('alex')
        console.log('Using voice:', preferredVoice.name, 'Rate:', utterance.rate, 'Pitch:', utterance.pitch, isAlex ? '(Alex - Friendly)' : '(Friendly)')
      } else {
        console.warn('No suitable voice found, using default')
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true)
      console.log('Started speaking')
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      currentUtteranceRef.current = null
      console.log('Finished speaking')
    }

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error)
      setIsSpeaking(false)
      currentUtteranceRef.current = null
      if (event.error !== 'interrupted') {
        toast.error('Speech error: ' + event.error, { duration: 3000 })
      }
    }

    currentUtteranceRef.current = utterance
    
    // Wait for voices to load if needed
    if (synthRef.current.getVoices().length === 0) {
      synthRef.current.onvoiceschanged = () => {
        synthRef.current.speak(utterance)
      }
    } else {
      synthRef.current.speak(utterance)
    }
  }

  const handleSpeak = (text) => {
    if (isSpeaking) {
      synthRef.current?.cancel()
      setIsSpeaking(false)
    } else {
      speakText(text)
    }
  }

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear all chat history?')) return

    try {
      await fetchJSON('/api/ai/chat', { method: 'DELETE' })
      setMessages([])
      toast.success('Chat history cleared')
    } catch (error) {
      console.error('Failed to clear chat:', error)
      toast.error('Failed to clear chat history')
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
            <p className="text-sm text-gray-500 mt-1">
              Ask me anything about candidates, jobs, or recruitment
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Streaming Toggle */}
            <button
              onClick={() => setUseStreaming(!useStreaming)}
              className={`p-2 rounded-lg transition-colors ${
                useStreaming
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={useStreaming ? 'Streaming enabled' : 'Enable streaming'}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </button>
            {/* Voice Toggle */}
            <button
              onClick={() => setIsSpeaking(!isSpeaking)}
              className={`p-2 rounded-lg transition-colors ${
                isSpeaking
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={isSpeaking ? 'Voice output enabled' : 'Enable voice output'}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
            {/* Clear Chat */}
            <button
              onClick={handleClearChat}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              title="Clear chat history"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading chat history...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-blue-100 rounded-full p-4 mb-4">
              <svg
                className="w-12 h-12 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Start a conversation
            </h3>
            <p className="text-gray-500 max-w-md mb-4">
              Ask me about candidates, help with job descriptions, get insights on your pipeline, or ask for recruitment best practices.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-md text-left">
              <p className="text-sm text-yellow-800">
                <strong>💡 Tip:</strong> If messages aren't getting responses, check:
              </p>
              <ul className="text-xs text-yellow-700 mt-2 list-disc list-inside space-y-1">
                <li>OpenAI API key is set in <code className="bg-yellow-100 px-1 rounded">.env</code></li>
                <li>Server was restarted after adding API key</li>
                <li>Check browser console (F12) for errors</li>
              </ul>
              <button
                onClick={async () => {
                  try {
                    setDebugInfo({ status: 'sending', message: 'Testing API connection...' })
                    const testResponse = await fetchJSON('/api/ai/chat', {
                      method: 'POST',
                      body: JSON.stringify({ message: 'Hello, this is a test' })
                    })
                    setDebugInfo({ status: 'success', message: '✅ API is working! Response: ' + (testResponse.message?.substring(0, 50) || 'OK') })
                    toast.success('API test successful!', { duration: 3000 })
                  } catch (error) {
                    setDebugInfo({ status: 'error', message: '❌ ' + error.message })
                    toast.error('API test failed: ' + error.message, { duration: 5000 })
                    console.error('API test error:', error)
                  }
                }}
                className="mt-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                🧪 Test API Connection
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                'Show me top candidates',
                'Help write a job description',
                'What are best practices for interviews?',
                'Analyze my pipeline'
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                    <div
                      className={`text-xs mt-2 ${
                        message.role === 'user'
                          ? 'text-blue-100'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.createdAt)}
                    </div>
                  </div>
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => handleSpeak(message.content)}
                      className={`flex-shrink-0 p-1 rounded transition-colors ${
                        isSpeaking
                          ? 'text-blue-600'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Read aloud"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm text-gray-500">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSend} className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              placeholder="Type your message or use voice input..."
              rows={1}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {isListening && (
            <span className="flex items-center gap-1 text-red-600">
              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
              Listening...
            </span>
          )}
          {debugInfo && (
            <span className={`flex items-center gap-1 ${
              debugInfo.status === 'error' ? 'text-red-600' :
              debugInfo.status === 'success' ? 'text-green-600' :
              'text-blue-600'
            }`}>
              {debugInfo.status === 'error' && '❌'}
              {debugInfo.status === 'success' && '✅'}
              {debugInfo.status === 'sending' && '⏳'}
              {debugInfo.message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
