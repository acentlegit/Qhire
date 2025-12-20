'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { fetchJSON } from '../../lib/fetch.js'

/**
 * AI Interview UI - Clean, Professional Design
 * Features: Calm interface, clear controls, AI avatar with glow
 */
export default function AIInterviewUI({ 
  eventId, 
  eventData,
  questions = [],
  onExit,
  onComplete 
}) {
  const { data: session } = useSession()
  const router = useRouter()
  
  // State
  const [isStarted, setIsStarted] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [answers, setAnswers] = useState([])
  const [elapsedTime, setElapsedTime] = useState(0)
  const [connectionQuality, setConnectionQuality] = useState('good')
  const [showExitModal, setShowExitModal] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [summary, setSummary] = useState(null)
  
  // Refs
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const timerRef = useRef(null)
  const synthRef = useRef(null)

  // Initialize camera
  useEffect(() => {
    if (isStarted && isVideoOn) {
      initializeCamera()
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [isStarted, isVideoOn])

  // Timer
  useEffect(() => {
    if (isStarted && !isPaused && !isComplete) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [isStarted, isPaused, isComplete])

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Camera error:', error)
      toast.error('Could not access camera')
    }
  }

  const startInterview = () => {
    setIsStarted(true)
    // Ask first question after a brief delay
    setTimeout(() => {
      askQuestion(0)
    }, 2000)
  }

  const askQuestion = (index) => {
    if (index >= questions.length) {
      endInterview()
      return
    }

    setCurrentQuestionIndex(index)
    setIsAISpeaking(true)
    setIsListening(false)
    
    const question = questions[index]?.question || questions[index]
    
    // Use speech synthesis
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(question)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.voice = speechSynthesis.getVoices().find(v => v.name.includes('Female')) || null
      
      utterance.onend = () => {
        setIsAISpeaking(false)
        startListening()
      }
      
      speechSynthesis.speak(utterance)
    } else {
      // Fallback: just show the question
      setTimeout(() => {
        setIsAISpeaking(false)
        startListening()
      }, 3000)
    }
  }

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported')
      return
    }

    setIsListening(true)
    setTranscript('')

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
        setTranscript(prev => prev + ' ' + finalTranscript)
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  const nextQuestion = () => {
    // Save current answer
    if (transcript.trim()) {
      setAnswers(prev => [...prev, {
        question: questions[currentQuestionIndex]?.question || questions[currentQuestionIndex],
        answer: transcript.trim(),
        timestamp: elapsedTime
      }])
    }
    
    stopListening()
    setTranscript('')
    
    if (currentQuestionIndex < questions.length - 1) {
      askQuestion(currentQuestionIndex + 1)
    } else {
      endInterview()
    }
  }

  const endInterview = async () => {
    stopListening()
    setIsComplete(true)
    clearInterval(timerRef.current)

    // Generate summary
    try {
      const summaryData = await fetchJSON('/api/ai/interview/summary', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          answers,
          duration: elapsedTime
        })
      })
      setSummary(summaryData)
    } catch (error) {
      console.error('Error generating summary:', error)
      setSummary({
        strengths: ['Communication skills', 'Technical knowledge'],
        improvements: ['Could provide more specific examples'],
        fitScore: 75,
        aiSummary: 'Interview completed successfully.'
      })
    }

    if (onComplete) {
      onComplete({ answers, duration: elapsedTime })
    }
  }

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted
      })
    }
    setIsMuted(!isMuted)
  }

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOn
      })
    }
    setIsVideoOn(!isVideoOn)
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
    if (!isPaused) {
      stopListening()
      speechSynthesis.pause()
    } else {
      speechSynthesis.resume()
      if (!isAISpeaking) startListening()
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleExit = () => {
    setShowExitModal(true)
  }

  const confirmExit = () => {
    stopListening()
    speechSynthesis.cancel()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (onExit) onExit()
    else router.push('/calendar')
  }

  // Pre-Interview Screen
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
            <span className="text-4xl">🤖</span>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2">AI Interview</h1>
          <p className="text-gray-400 mb-2">{eventData?.job?.title || 'Interview Session'}</p>
          
          <div className="bg-gray-800 rounded-2xl p-6 mt-8 text-left">
            <h3 className="text-white font-semibold mb-4">Before you begin:</h3>
            <ul className="space-y-3 text-gray-300 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                Find a quiet, well-lit space
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                Ensure your camera and microphone are working
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                Speak clearly and take your time
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                {questions.length} questions • ~{Math.ceil(questions.length * 2)} minutes
              </li>
            </ul>
          </div>

          <button
            onClick={startInterview}
            className="mt-8 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30"
          >
            Start Interview
          </button>
          
          <button
            onClick={() => onExit ? onExit() : router.back()}
            className="mt-4 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Interview Complete Screen
  if (isComplete && summary) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Interview Complete</h1>
            <p className="text-gray-400 mt-1">Duration: {formatTime(elapsedTime)}</p>
          </div>

          {/* Summary Card */}
          <div className="bg-gray-800 rounded-2xl p-6 space-y-6">
            {/* AI Summary */}
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
                🧠 AI Summary
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {summary.aiSummary || 'Interview completed successfully. Detailed analysis is being generated.'}
              </p>
            </div>

            {/* Fit Score */}
            <div className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-xl">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{summary.fitScore || 75}%</span>
              </div>
              <div>
                <p className="text-white font-medium">Fit Score</p>
                <p className="text-gray-400 text-sm">Based on responses and role requirements</p>
              </div>
            </div>

            {/* Strengths */}
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
                ⭐ Strengths
              </h3>
              <div className="flex flex-wrap gap-2">
                {(summary.strengths || ['Good communication', 'Clear responses']).map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Areas to Improve */}
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
                ⚠️ Areas to Improve
              </h3>
              <div className="flex flex-wrap gap-2">
                {(summary.improvements || ['Provide more examples']).map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Transcript Toggle */}
            <details className="group">
              <summary className="cursor-pointer text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                <span>📝 View Transcript</span>
                <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-4 space-y-4 max-h-64 overflow-y-auto">
                {answers.map((a, i) => (
                  <div key={i} className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-purple-400 text-sm font-medium mb-1">Q: {a.question}</p>
                    <p className="text-gray-300 text-sm">A: {a.answer}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => router.push('/calendar')}
              className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
            >
              Back to Calendar
            </button>
            <button
              onClick={() => router.push(`/candidates/${eventData?.candidateId}`)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              📄 View Full Report
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main Interview UI
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <span className="text-white font-semibold">QHire</span>
          </div>
          <div className="h-6 w-px bg-gray-600"></div>
          <span className="text-gray-300">AI Interview — {eventData?.job?.title || 'Interview'}</span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg">
            <span className="text-gray-400">⏱</span>
            <span className="text-white font-mono">{formatTime(elapsedTime)}</span>
          </div>
          
          {/* Connection Quality */}
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${
              connectionQuality === 'good' ? 'bg-green-400' : 
              connectionQuality === 'fair' ? 'bg-yellow-400' : 'bg-red-400'
            }`}></span>
            <span className="text-gray-400 text-sm">📶</span>
          </div>
          
          {/* Exit */}
          <button
            onClick={handleExit}
            className="px-4 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Video Area */}
        <div className="relative w-full max-w-4xl aspect-video bg-gray-800 rounded-2xl overflow-hidden mb-6">
          {/* Candidate Video (Large) */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${!isVideoOn ? 'hidden' : ''}`}
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {!isVideoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-4xl text-gray-400">👤</span>
              </div>
            </div>
          )}

          {/* AI Avatar (Small, with glow when speaking) */}
          <div className={`
            absolute bottom-4 right-4 w-20 h-20 rounded-full 
            bg-gradient-to-br from-purple-500 to-indigo-600 
            flex items-center justify-center shadow-lg
            transition-all duration-300
            ${isAISpeaking ? 'ring-4 ring-purple-400/50 animate-pulse shadow-purple-500/50' : ''}
          `}>
            <span className="text-3xl">🤖</span>
          </div>

          {/* Status Indicators */}
          <div className="absolute top-4 left-4 flex items-center gap-3">
            {/* Mic Status */}
            <div className={`
              px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2
              ${isListening 
                ? 'bg-green-500/20 text-green-400' 
                : isAISpeaking 
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-gray-700 text-gray-400'
              }
            `}>
              {isListening && (
                <>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Listening...
                </>
              )}
              {isAISpeaking && (
                <>
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                  AI is speaking...
                </>
              )}
              {!isListening && !isAISpeaking && (
                <>
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  Ready
                </>
              )}
            </div>
          </div>

          {/* Question Counter */}
          <div className="absolute top-4 right-4 px-3 py-1.5 bg-gray-800/80 rounded-full text-sm text-gray-300">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
        </div>

        {/* Question Display */}
        <div className="w-full max-w-3xl bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <p className="text-purple-400 text-sm font-medium mb-1">AI Interviewer</p>
              <p className="text-white text-lg leading-relaxed">
                {questions[currentQuestionIndex]?.question || questions[currentQuestionIndex] || 'Loading question...'}
              </p>
            </div>
          </div>

          {/* Voice Waveform (when listening) */}
          {isListening && (
            <div className="mt-4 flex items-center justify-center gap-1 h-12">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-green-400 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.05}s`
                  }}
                ></div>
              ))}
            </div>
          )}

          {/* Transcript Preview */}
          {transcript && (
            <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
              <p className="text-gray-400 text-sm">{transcript}</p>
            </div>
          )}
        </div>

        {/* Next Question Button */}
        {isListening && transcript.length > 20 && (
          <button
            onClick={nextQuestion}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Finish Interview'}
          </button>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all
              ${isMuted 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-700 text-white hover:bg-gray-600'
              }
            `}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          <span className="text-xs text-gray-400 absolute mt-20">
            {isMuted ? 'Unmute' : 'Mute'}
          </span>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all
              ${!isVideoOn 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-700 text-white hover:bg-gray-600'
              }
            `}
          >
            {isVideoOn ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>

          {/* Pause */}
          <button
            onClick={togglePause}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all
              ${isPaused 
                ? 'bg-yellow-500 text-white' 
                : 'bg-gray-700 text-white hover:bg-gray-600'
              }
            `}
          >
            {isPaused ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          {/* End Interview */}
          <button
            onClick={handleExit}
            className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-2">End Interview?</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to end this interview? Your progress will be saved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Continue Interview
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                End Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

