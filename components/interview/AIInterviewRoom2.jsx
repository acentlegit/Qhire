'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { fetchJSON } from '../../lib/fetch.js'

// Interview States
const InterviewState = {
  INIT: 'INIT',
  AI_SPEAKING: 'AI_SPEAKING',
  LISTENING: 'LISTENING',
  SILENCE_DETECTED: 'SILENCE_DETECTED',
  PROCESSING: 'PROCESSING',
  NEXT_READY: 'NEXT_READY',
  COMPLETE: 'COMPLETE',
  FORCE_END: 'FORCE_END'
}

export default function AIInterviewRoom2({ 
  eventId, 
  eventData,
  questions: preGeneratedQuestions,
  onExit 
}) {
  const router = useRouter()
  
  // Core State
  const [state, setState] = useState(InterviewState.INIT)
  const [questions, setQuestions] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState([])
  const [transcript, setTranscript] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  
  // UI State
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [showExitModal, setShowExitModal] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  
  // Refs
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const timerRef = useRef(null)
  const noSpeechTimerRef = useRef(null)
  const transcriptRef = useRef('')
  const stateRef = useRef(InterviewState.INIT)
  const hasSpokenRef = useRef(false)
  const lastSpeechTimeRef = useRef(null)

  // Load questions on mount
  useEffect(() => {
    if (preGeneratedQuestions && preGeneratedQuestions.length > 0) {
      // Use pre-generated questions
      setQuestions(preGeneratedQuestions)
      initializeCamera()
      setState(InterviewState.AI_SPEAKING)
    } else {
      // Load questions from API
      loadQuestions()
    }
    return () => cleanup()
  }, [preGeneratedQuestions])

  // State machine effect
  useEffect(() => {
    switch (state) {
      case InterviewState.AI_SPEAKING:
        speakQuestion()
        break
      case InterviewState.LISTENING:
        startListening()
        break
      case InterviewState.SILENCE_DETECTED:
        handleSilenceDetected()
        break
      case InterviewState.PROCESSING:
        processAnswer()
        break
      case InterviewState.NEXT_READY:
        // Auto-advance after 2 seconds
        console.log('⏳ NEXT_READY: Auto-advancing in 2 seconds...')
        const nextTimer = setTimeout(() => {
          console.log('➡️ Auto-advancing to next question')
          goToNextQuestion()
        }, 2000)
        return () => clearTimeout(nextTimer)
      case InterviewState.COMPLETE:
        generateReport()
        break
    }
  }, [state, currentQuestion, questions.length])

  // Update refs when state/transcript changes
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Timer
  useEffect(() => {
    if (state !== InterviewState.INIT && state !== InterviewState.COMPLETE) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [state])

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    clearTimeout(silenceTimerRef.current)
    clearTimeout(noSpeechTimerRef.current)
    clearInterval(timerRef.current)
    speechSynthesis.cancel()
  }

  const loadQuestions = async () => {
    try {
      // Try to get questions from API
      const data = await fetchJSON('/api/ai/interview/questions', {
        method: 'POST',
        body: JSON.stringify({
          jobTitle: eventData?.job?.title || 'General',
          jobDescription: eventData?.job?.description || '',
          candidateName: eventData?.candidate?.name || 'Candidate'
        })
      })
      
      const loadedQuestions = data.questions || getDefaultQuestions()
      setQuestions(loadedQuestions)
      
      // Initialize camera
      await initializeCamera()
      
      // Start interview
      setState(InterviewState.AI_SPEAKING)
    } catch (error) {
      console.error('Error loading questions:', error)
      setQuestions(getDefaultQuestions())
      await initializeCamera()
      setState(InterviewState.AI_SPEAKING)
    }
  }

  const getDefaultQuestions = () => [
    { question: "Tell me about yourself and your background.", category: "Introduction" },
    { question: "What interests you about this role?", category: "Motivation" },
    { question: "Describe a challenging project you worked on.", category: "Experience" },
    { question: "How do you handle tight deadlines?", category: "Problem Solving" },
    { question: "Where do you see yourself in 5 years?", category: "Goals" }
  ]

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
      setError('Could not access camera/microphone')
    }
  }

  const speakQuestion = () => {
    if (currentQuestion >= questions.length) {
      setState(InterviewState.COMPLETE)
      return
    }

    const questionText = questions[currentQuestion]?.question || questions[currentQuestion]
    
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(questionText)
      utterance.rate = 0.9
      utterance.pitch = 1
      
      // Try to get a pleasant voice
      const voices = speechSynthesis.getVoices()
      const preferredVoice = voices.find(v => 
        v.name.includes('Samantha') || 
        v.name.includes('Google') || 
        v.name.includes('Female')
      )
      if (preferredVoice) utterance.voice = preferredVoice
      
      utterance.onend = () => {
        setTranscript('')
        setState(InterviewState.LISTENING)
      }
      
      utterance.onerror = () => {
        setTimeout(() => {
          setTranscript('')
          setState(InterviewState.LISTENING)
        }, 2000)
      }
      
      speechSynthesis.speak(utterance)
    } else {
      // Fallback
      setTimeout(() => {
        setTranscript('')
        setState(InterviewState.LISTENING)
      }, 3000)
    }
  }

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported')
      return
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    // Clear any existing timers
    clearTimeout(silenceTimerRef.current)
    clearTimeout(noSpeechTimerRef.current)

    // Reset speech tracking for new question
    hasSpokenRef.current = false
    lastSpeechTimeRef.current = null

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let hasFinal = false
      let hasInterim = false
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' '
          hasFinal = true
        } else {
          hasInterim = true
        }
      }
      
      if (hasFinal && finalTranscript.trim()) {
        if (!hasSpokenRef.current) {
          hasSpokenRef.current = true
          lastSpeechTimeRef.current = Date.now()
          console.log('🎤 User started speaking')
        }
        setTranscript(prev => prev + ' ' + finalTranscript)
        lastSpeechTimeRef.current = Date.now()
        // Reset silence timer after user has spoken
        resetSilenceTimer()
      } else if (hasInterim) {
        // User is speaking (interim results)
        if (!hasSpokenRef.current) {
          hasSpokenRef.current = true
          lastSpeechTimeRef.current = Date.now()
          console.log('🎤 User started speaking (interim)')
        }
        lastSpeechTimeRef.current = Date.now()
        // Reset silence timer after user has spoken
        resetSilenceTimer()
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        // Only treat as silence if user has already spoken
        if (hasSpokenRef.current && transcriptRef.current.trim()) {
          console.log('🔇 No speech detected after user spoke, checking silence...')
          const timeSinceLastSpeech = lastSpeechTimeRef.current 
            ? Date.now() - lastSpeechTimeRef.current 
            : 0
          if (timeSinceLastSpeech > 3000) {
            setTimeout(() => {
              if (stateRef.current === InterviewState.LISTENING && transcriptRef.current.trim()) {
                setState(InterviewState.SILENCE_DETECTED)
              }
            }, 500)
          }
        }
        // If user hasn't spoken yet, just ignore the error and keep listening
      } else if (event.error !== 'aborted' && event.error !== 'network') {
        console.error('Speech recognition error:', event.error)
      }
    }

    recognition.onend = () => {
      // If recognition ended and we're still listening, check what to do
      if (stateRef.current === InterviewState.LISTENING) {
        // Only move to silence if user has spoken and it's been 3+ seconds
        if (hasSpokenRef.current && transcriptRef.current.trim()) {
          const timeSinceLastSpeech = lastSpeechTimeRef.current 
            ? Date.now() - lastSpeechTimeRef.current 
            : 0
          if (timeSinceLastSpeech > 3000) {
            console.log('🔄 Recognition ended with transcript after silence, moving to processing')
            setState(InterviewState.SILENCE_DETECTED)
            return
          }
        }
        
        // Restart recognition if no transcript yet or not enough silence
        setTimeout(() => {
          if (stateRef.current === InterviewState.LISTENING) {
            console.log('🔄 Restarting speech recognition...')
            startListening()
          }
        }, 500)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    console.log('🎤 Speech recognition started, waiting for user to speak...')
    
    // Start no-speech timer (60 seconds - give user more time)
    // Only trigger if user hasn't spoken at all
    noSpeechTimerRef.current = setTimeout(() => {
      if (stateRef.current === InterviewState.LISTENING && !hasSpokenRef.current && !transcriptRef.current.trim()) {
        console.log('⏰ No response detected after 60 seconds')
        toast('No response detected, moving to next question', { icon: 'ℹ️' })
        saveEmptyAnswer()
        goToNextQuestion()
      }
    }, 60000) // Increased to 60 seconds - gives user plenty of time to start speaking
    
    // DON'T start silence timer immediately - only after user speaks
  }

  const resetSilenceTimer = () => {
    clearTimeout(silenceTimerRef.current)
    
    // Only set timer if we're in listening state AND have transcript (user has spoken)
    if (stateRef.current === InterviewState.LISTENING && transcriptRef.current.trim()) {
      silenceTimerRef.current = setTimeout(() => {
        // Double-check state and transcript before moving to silence detected
        if (stateRef.current === InterviewState.LISTENING && transcriptRef.current.trim()) {
          console.log('🔄 3.5 seconds of silence detected after speech, moving to processing...')
          setState(InterviewState.SILENCE_DETECTED)
        }
      }, 3500) // 3.5 seconds of silence AFTER user stops speaking
    }
  }

  const handleSilenceDetected = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setState(InterviewState.PROCESSING)
  }

  const processAnswer = async () => {
    const answerText = transcript.trim()
    console.log('📝 Processing answer:', answerText.substring(0, 50) + '...')
    
    if (!answerText) {
      console.log('⚠️ No answer text, saving empty answer')
      saveEmptyAnswer()
      setState(InterviewState.NEXT_READY)
      return
    }

    try {
      // Analyze answer with AI
      const result = await fetchJSON('/api/ai/interview/analyze', {
        method: 'POST',
        body: JSON.stringify({
          question: questions[currentQuestion]?.question || questions[currentQuestion],
          answer: answerText,
          jobTitle: eventData?.job?.title
        })
      })

      setAnswers(prev => [...prev, {
        questionIndex: currentQuestion,
        question: questions[currentQuestion]?.question || questions[currentQuestion],
        answer: answerText,
        score: result.score || 7,
        feedback: result.feedback || 'Answer recorded',
        timestamp: elapsedTime
      }])
      console.log('✅ Answer processed and saved')
    } catch (error) {
      console.error('Error analyzing answer:', error)
      // Save without AI analysis
      setAnswers(prev => [...prev, {
        questionIndex: currentQuestion,
        question: questions[currentQuestion]?.question || questions[currentQuestion],
        answer: answerText,
        score: 7,
        feedback: 'Answer recorded',
        timestamp: elapsedTime
      }])
      console.log('✅ Answer saved without AI analysis')
    }

    console.log('➡️ Moving to NEXT_READY state')
    setState(InterviewState.NEXT_READY)
  }

  const saveEmptyAnswer = () => {
    setAnswers(prev => [...prev, {
      questionIndex: currentQuestion,
      question: questions[currentQuestion]?.question || questions[currentQuestion],
      answer: '',
      score: 0,
      feedback: 'No response provided',
      timestamp: elapsedTime
    }])
  }

  const goToNextQuestion = () => {
    console.log(`🔄 Moving to next question. Current: ${currentQuestion + 1}/${questions.length}`)
    
    // Reset speech tracking for new question
    hasSpokenRef.current = false
    lastSpeechTimeRef.current = null
    
    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion(q => {
        const next = q + 1
        console.log(`✅ Question updated to ${next + 1}/${questions.length}`)
        return next
      })
      setTranscript('')
      setState(InterviewState.AI_SPEAKING)
    } else {
      console.log('✅ All questions completed, moving to COMPLETE state')
      setState(InterviewState.COMPLETE)
    }
  }

  const generateReport = async () => {
    clearInterval(timerRef.current)
    
    try {
      const data = await fetchJSON('/api/ai/interview/report', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          answers,
          duration: elapsedTime,
          jobTitle: eventData?.job?.title,
          candidateName: eventData?.candidate?.name
        })
      })
      setReport(data)
    } catch (error) {
      // Generate local report
      const avgScore = answers.length > 0 
        ? Math.round(answers.reduce((sum, a) => sum + (a.score || 0), 0) / answers.length * 10)
        : 70
      
      setReport({
        overallScore: avgScore,
        fit: avgScore >= 80 ? 'STRONG' : avgScore >= 60 ? 'MODERATE' : 'WEAK',
        confidence: 'HIGH',
        summary: 'Interview completed successfully. Detailed analysis is being generated.',
        strengths: ['Communication skills', 'Engagement'],
        gaps: ['Could provide more specific examples'],
        skills: { technical: 7, communication: 8, problemSolving: 7 }
      })
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

  const handleExit = () => setShowExitModal(true)

  const confirmExit = () => {
    cleanup()
    if (onExit) onExit()
    else router.push('/calendar')
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercent = () => {
    if (questions.length === 0) return 0
    return Math.round(((currentQuestion + (state === InterviewState.COMPLETE ? 1 : 0)) / questions.length) * 100)
  }

  // ============ RENDER STATES ============

  // State: INIT (Setup Screen)
  if (state === InterviewState.INIT) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">🤖</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Preparing Interview</h1>
          <p className="text-gray-400">Loading questions...</p>
          <div className="mt-8">
            <div className="w-48 h-1 bg-gray-700 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // State: COMPLETE (Report Screen)
  if (state === InterviewState.COMPLETE && report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">AI Interview Report</h1>
              <p className="text-gray-400 mt-1">
                {eventData?.candidate?.name || 'Candidate'} • {eventData?.job?.title || 'Interview'}
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2">
                ⬇️ Download PDF
              </button>
            </div>
          </div>

          {/* Overall Score Card */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Overall Fit</p>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-white">{report.overallScore}</span>
                  <span className="text-gray-400">/100</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    report.fit === 'STRONG' ? 'bg-green-500/20 text-green-400' :
                    report.fit === 'MODERATE' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {report.fit === 'STRONG' ? '✓ Strong Fit' : 
                     report.fit === 'MODERATE' ? '~ Moderate Fit' : '✗ Weak Fit'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Confidence</p>
                <p className="text-white font-medium">{report.confidence}</p>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  report.overallScore >= 80 ? 'bg-green-500' :
                  report.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${report.overallScore}%` }}
              ></div>
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
              🧠 AI Summary
            </h3>
            <p className="text-gray-300 leading-relaxed">{report.summary}</p>
          </div>

          {/* Strengths & Gaps */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                ⭐ Strengths
              </h3>
              <div className="space-y-2">
                {(report.strengths || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                ⚠️ Areas to Improve
              </h3>
              <div className="space-y-2">
                {(report.gaps || []).map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-amber-400">
                    <span>•</span>
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Skill Breakdown */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700">
            <h3 className="text-white font-semibold mb-4">📈 Skill Signals</h3>
            <div className="space-y-4">
              {Object.entries(report.skills || {}).map(([skill, score]) => (
                <div key={skill}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 capitalize">{skill.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-white">{score}/10</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${score * 10}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Scores are AI-assisted and require human review.
            </p>
          </div>

          {/* Question Breakdown (Collapsible) */}
          <details className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700 mb-6">
            <summary className="p-6 cursor-pointer text-white font-semibold flex items-center justify-between">
              <span>📝 Question-wise Breakdown</span>
              <svg className="w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-6 pb-6 space-y-4">
              {answers.map((a, i) => (
                <div key={i} className="p-4 bg-gray-700/50 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-purple-400 text-sm font-medium">Q{i + 1}: {a.question}</p>
                    <span className="text-white text-sm">{a.score}/10</span>
                  </div>
                  <p className="text-gray-300 text-sm">{a.answer || 'No response'}</p>
                  <p className="text-gray-500 text-xs mt-2">{a.feedback}</p>
                </div>
              ))}
            </div>
          </details>

          {/* Actions */}
          <div className="flex gap-4">
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
              View Candidate Profile
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-500 text-xs mt-8">
            This report is AI-assisted and requires human review. Generated by QHire AI Interview Engine.
          </p>
        </div>
      </div>
    )
  }

  // ============ MAIN INTERVIEW UI ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Top Header */}
      <header className="bg-gray-800/80 backdrop-blur border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">Q</span>
              </div>
              <span className="text-white font-semibold">QHire AI Interview</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <span className="text-white font-mono bg-gray-700 px-3 py-1 rounded-lg">
              ⏱ {formatTime(elapsedTime)}
            </span>
            <button
              onClick={handleExit}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
          <span>👤 {eventData?.candidate?.name || 'Candidate'}</span>
          <span className="text-gray-600">|</span>
          <span>💼 {eventData?.job?.title || 'Interview'}</span>
          <span className="text-gray-600">|</span>
          <span>🧪 Technical Interview</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Video Section */}
        <div className="relative w-full max-w-3xl aspect-video bg-gray-800 rounded-2xl overflow-hidden mb-6 shadow-2xl">
          {/* Candidate Video */}
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
                <span className="text-4xl">👤</span>
              </div>
            </div>
          )}

          {/* AI Avatar */}
          <div className={`
            absolute bottom-4 right-4 w-16 h-16 rounded-full 
            bg-gradient-to-br from-purple-500 to-indigo-600 
            flex items-center justify-center shadow-lg
            transition-all duration-300
            ${state === InterviewState.AI_SPEAKING ? 'ring-4 ring-purple-400/50 scale-110' : ''}
          `}>
            <span className="text-2xl">🤖</span>
          </div>

          {/* Status Badge */}
          <div className="absolute top-4 left-4">
            <div className={`
              px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 backdrop-blur
              ${state === InterviewState.AI_SPEAKING ? 'bg-purple-500/30 text-purple-300' :
                state === InterviewState.LISTENING ? 'bg-green-500/30 text-green-300' :
                state === InterviewState.PROCESSING ? 'bg-blue-500/30 text-blue-300' :
                'bg-gray-700/50 text-gray-300'}
            `}>
              {state === InterviewState.AI_SPEAKING && (
                <><span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span> AI is asking a question...</>
              )}
              {state === InterviewState.LISTENING && (
                <><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> {transcript.trim() ? 'Listening...' : 'Ready for your answer'}</>
              )}
              {state === InterviewState.SILENCE_DETECTED && (
                <><span className="w-2 h-2 bg-amber-400 rounded-full"></span> Processing...</>
              )}
              {state === InterviewState.PROCESSING && (
                <><span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span> Analyzing your response...</>
              )}
              {state === InterviewState.NEXT_READY && (
                <><span className="w-2 h-2 bg-green-400 rounded-full"></span> Answer recorded ✓</>
              )}
            </div>
          </div>

          {/* Connection Status */}
          <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-800/50 backdrop-blur px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Connected
          </div>
        </div>

        {/* Question Panel */}
        <div className="w-full max-w-3xl bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">Question {currentQuestion + 1} of {questions.length}</span>
            <div className="flex gap-1">
              {questions.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < currentQuestion ? 'bg-green-500' :
                    i === currentQuestion ? 'bg-purple-500' : 'bg-gray-600'
                  }`}
                ></div>
              ))}
            </div>
          </div>

          {/* Question Text */}
          <p className="text-white text-xl leading-relaxed">
            "{questions[currentQuestion]?.question || questions[currentQuestion] || 'Loading...'}"
          </p>

          {/* Voice Waveform */}
          {state === InterviewState.LISTENING && (
            <div className="mt-6 flex items-center justify-center gap-1 h-12">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-green-400 rounded-full transition-all"
                  style={{
                    height: `${20 + Math.random() * 80}%`,
                    animationDelay: `${i * 0.05}s`,
                    animation: 'pulse 0.5s ease-in-out infinite alternate'
                  }}
                ></div>
              ))}
            </div>
          )}

          {/* Transcript Preview */}
          {transcript && (
            <div className="mt-4 p-4 bg-gray-700/50 rounded-xl max-h-32 overflow-y-auto">
              <p className="text-gray-300 text-sm">{transcript}</p>
            </div>
          )}
        </div>

        {/* Next Question Button */}
        {(state === InterviewState.LISTENING || state === InterviewState.NEXT_READY || state === InterviewState.PROCESSING) && (
          <button
            onClick={goToNextQuestion}
            disabled={state === InterviewState.PROCESSING}
            className={`px-8 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
              state === InterviewState.PROCESSING
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {state === InterviewState.PROCESSING ? (
              <>⏳ Processing...</>
            ) : currentQuestion < questions.length - 1 ? (
              <>⏭ Next Question</>
            ) : (
              <>✓ Finish Interview</>
            )}
          </button>
        )}
      </main>

      {/* Bottom Controls */}
      <footer className="bg-gray-800/80 backdrop-blur border-t border-gray-700 px-6 py-4">
        <div className="flex items-center justify-center gap-6">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`flex flex-col items-center gap-1 ${isMuted ? 'text-red-400' : 'text-white'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}>
              {isMuted ? '🔇' : '🎤'}
            </div>
            <span className="text-xs">{isMuted ? 'Unmute' : 'Mic On'}</span>
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center gap-1 ${!isVideoOn ? 'text-red-400' : 'text-white'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              !isVideoOn ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}>
              {isVideoOn ? '🎥' : '📵'}
            </div>
            <span className="text-xs">{isVideoOn ? 'Camera On' : 'Camera Off'}</span>
          </button>

          {/* End Interview */}
          <button
            onClick={handleExit}
            className="flex flex-col items-center gap-1 text-white"
          >
            <div className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all">
              ⛔
            </div>
            <span className="text-xs">End Interview</span>
          </button>
        </div>
      </footer>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-2">End Interview?</h3>
            <p className="text-gray-400 mb-2">Are you sure you want to end the interview?</p>
            <ul className="text-gray-400 text-sm mb-6 space-y-1">
              <li>• Your answers will be saved</li>
              <li>• You cannot rejoin once ended</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
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

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

