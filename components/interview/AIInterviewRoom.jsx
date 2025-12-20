'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Room, RoomEvent, createLocalTracks } from 'livekit-client'
import toast from 'react-hot-toast'
import { fetchJSON } from '../../lib/fetch.js'

export default function AIInterviewRoom({ eventId, roomName, onExit, role = 'participant', eventData = null }) {
  const { data: session } = useSession()
  const [room, setRoom] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false) // Track if video is actually loaded
  const [transcription, setTranscription] = useState([])
  const [aiQuestions, setAiQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isWaitingForAnswer, setIsWaitingForAnswer] = useState(false)
  const [promptCount, setPromptCount] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioLevels, setAudioLevels] = useState([]) // For frequency visualization
  const [isAISpeaking, setIsAISpeaking] = useState(false) // Track when AI is speaking
  const [interviewNotes, setInterviewNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isCallStarted, setIsCallStarted] = useState(false)
  const [silenceCountdown, setSilenceCountdown] = useState(null) // Visual countdown for silence timer
  
  const localVideoRef = useRef(null)
  const remoteVideoRefs = useRef({})
  const localTrackRef = useRef(null)
  const recognitionRef = useRef(null)
  const answerTimeoutRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const voiceDetectionInitializedRef = useRef(false)
  const isAskingQuestionRef = useRef(false)
  const answerCompleteRef = useRef(false) // Prevent multiple calls to handleAnswerComplete
  const lastSpeechTimeRef = useRef(null) // Track when user last spoke
  const baselineNoiseLevelRef = useRef(null) // Track baseline ambient noise level
  const speakingAudioLevelRef = useRef(null) // Track audio level when user is speaking
  const countdownIntervalRef = useRef(null) // Track countdown interval to prevent duplicates
  const answerCompleteTimeRef = useRef(null) // Track when answer was completed to prevent immediate restart
  const silenceDetectionTimerRef = useRef(null) // Timer to detect when user stops speaking

  useEffect(() => {
    if (session && roomName && isCallStarted) {
      joinRoom()
    }

    return () => {
      if (room) {
        room.disconnect()
      }
      if (localTrackRef.current) {
        localTrackRef.current.stop()
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (answerTimeoutRef.current) {
        clearTimeout(answerTimeoutRef.current)
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      if (silenceDetectionTimerRef.current) {
        clearTimeout(silenceDetectionTimerRef.current)
        silenceDetectionTimerRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [session, roomName, isCallStarted])

  // Initialize speech recognition for answer detection
  useEffect(() => {
    if (isCallStarted && isConnected && room && !voiceDetectionInitializedRef.current) {
      console.log('🎤 Voice detection useEffect triggered:', { isCallStarted, isConnected, hasRoom: !!room })
      
      // Small delay to ensure room is fully ready
      const timer = setTimeout(() => {
        console.log('🎤 Initializing speech recognition and audio analysis...')
        initializeSpeechRecognition()
        
        // Initialize audio analysis after speech recognition
        setTimeout(() => {
          initializeAudioAnalysis()
        }, 500)
      }, 1000)
      
      return () => {
        clearTimeout(timer)
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop()
            voiceDetectionInitializedRef.current = false
          } catch (e) {
            // Ignore errors
          }
        }
      }
    }
  }, [isCallStarted, isConnected, room])

  // Auto-ask first question when questions are loaded
  useEffect(() => {
    if (aiQuestions.length > 0 && currentQuestionIndex === 0 && isCallStarted && isConnected && !isAskingQuestionRef.current) {
      console.log('Auto-asking first question:', aiQuestions[0])
      const timer = setTimeout(() => {
        if (!isAskingQuestionRef.current) {
          isAskingQuestionRef.current = true
          askQuestion(0)
        }
      }, 2000) // Wait 2 seconds after connection
      
      return () => clearTimeout(timer)
    }
  }, [aiQuestions.length, isCallStarted, isConnected, currentQuestionIndex])

  const initializeSpeechRecognition = () => {
    if (typeof window === 'undefined') {
      console.warn('Window not available')
      return
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser')
      toast.error('Speech recognition not supported in this browser')
      return
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      
      // Stop existing recognition if any
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.maxAlternatives = 1

      let hasShownToast = false
      
      recognition.onstart = () => {
        console.log('✅✅✅ Speech recognition ACTIVE and listening!')
        if (!hasShownToast) {
          hasShownToast = true
          voiceDetectionInitializedRef.current = true
          toast.success('Voice detection enabled - Start speaking!', { duration: 3000 })
        }
      }

      recognition.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        // Process final results - detect any speech (even single characters)
        if (finalTranscript.trim().length > 0) {
          console.log('🎤✅✅✅ FINAL Speech detected:', finalTranscript)
          console.log('🎤 Transcript length:', finalTranscript.trim().length)
          setIsSpeaking(true)
          setIsWaitingForAnswer(false) // Stop waiting when speech is detected
          setPromptCount(0)
          clearTimeout(answerTimeoutRef.current)
          
          // Clear any existing timer when new speech is detected
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          setSilenceCountdown(null) // Hide countdown while speaking
          
          // Add to transcription
          setTranscription(prev => [...prev, {
            speaker: 'Candidate',
            text: finalTranscript.trim(),
            timestamp: new Date()
          }])

          // Update last speech time - timer will start when silence is detected
          answerCompleteRef.current = false // Reset flag when new speech detected
          lastSpeechTimeRef.current = Date.now() // Track when user last spoke
          
          // Clear any existing silence detection timer
          if (silenceDetectionTimerRef.current) {
            clearTimeout(silenceDetectionTimerRef.current)
            silenceDetectionTimerRef.current = null
          }
          
          // Start a timer that will trigger when user stops speaking (no new speech for 1 second)
          silenceDetectionTimerRef.current = setTimeout(() => {
            // User stopped speaking - start the 5 second countdown timer
            const timeSinceAnswerComplete = answerCompleteTimeRef.current ? Date.now() - answerCompleteTimeRef.current : Infinity
            const cooldownPeriod = 3000 // 3 seconds cooldown after answering
            
            if (!silenceTimerRef.current && timeSinceAnswerComplete > cooldownPeriod && lastSpeechTimeRef.current) {
              console.log('🔇✅ User stopped speaking (no new speech for 1s) - Starting 5 second timer!')
              
              // Clear any existing countdown interval
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
              }
              
              // Start visual countdown
              let countdown = 5
              setSilenceCountdown(countdown)
              countdownIntervalRef.current = setInterval(() => {
                countdown--
                if (countdown > 0) {
                  setSilenceCountdown(countdown)
                } else {
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current)
                    countdownIntervalRef.current = null
                  }
                  setSilenceCountdown(null)
                }
              }, 1000)
              
              silenceTimerRef.current = setTimeout(() => {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current)
                  countdownIntervalRef.current = null
                }
                setSilenceCountdown(null)
                silenceTimerRef.current = null
                console.log('✅✅✅ 5 seconds of silence completed - Stopping recognition and moving to next question!')
                
                // STEP 1: Stop speech recognition to get final transcript
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.stop()
                    console.log('🛑 Speech recognition stopped to finalize transcript')
                  } catch (e) {
                    console.log('Speech recognition already stopped or error:', e)
                  }
                }
                
                // STEP 2: Wait a moment for final transcript, then process answer
                setTimeout(() => {
                  // Get current state values (capture them in closure)
                  const currentTranscription = [...transcription]
                  const currentQIndex = currentQuestionIndex
                  const currentQuestions = [...aiQuestions]
                  
                  // Get the latest transcript from state
                  const latestAnswer = currentTranscription[currentTranscription.length - 1]?.text || ''
                  console.log('📝 Final answer transcript:', latestAnswer)
                  
                  // STEP 3: Process answer (save to backend if needed)
                  // This is optional but good practice
                  if (latestAnswer && eventId) {
                    // Save answer to interview notes (async, don't wait)
                    fetch(`/api/events/${eventId}/interview-notes`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        question: currentQuestions[currentQIndex],
                        answer: latestAnswer,
                        questionIndex: currentQIndex
                      })
                    }).catch(err => console.error('Failed to save answer:', err))
                  }
                  
                  // STEP 4: Move to next question
                  // Reset flag before calling (like the button does)
                  answerCompleteRef.current = false
                  handleAnswerComplete()
                }, 500) // Small delay to ensure final transcript is captured
              }, 5000)
            }
            silenceDetectionTimerRef.current = null
          }, 1000) // Wait 1 second of no new speech before starting countdown
          
          console.log('🎤 User speaking - silence detection timer started')
        }
        
        // Process interim results - show we're listening
        if (interimTranscript.trim().length > 0) {
          console.log('🎤 INTERIM Listening...', interimTranscript)
          setIsSpeaking(true)
          setIsWaitingForAnswer(false) // Stop showing "waiting" when we detect speech
          setPromptCount(0)
          // Only set timer if one isn't already running AND we haven't just completed an answer
          const timeSinceAnswerComplete = answerCompleteTimeRef.current ? Date.now() - answerCompleteTimeRef.current : Infinity
          const cooldownPeriod = 3000 // 3 seconds cooldown after answering
          
          if (!silenceTimerRef.current && timeSinceAnswerComplete > cooldownPeriod) {
            answerCompleteRef.current = false // Reset flag when new speech detected
            lastSpeechTimeRef.current = Date.now() // Track when user last spoke
            console.log('⏱️ Setting silence timer for interim results (5 seconds)...', { time: new Date().toISOString() })
            
            // Clear any existing countdown interval
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
              countdownIntervalRef.current = null
            }
            
            // Start visual countdown
            let countdown = 5
            setSilenceCountdown(countdown)
            countdownIntervalRef.current = setInterval(() => {
              countdown--
              if (countdown > 0) {
                setSilenceCountdown(countdown)
              } else {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current)
                  countdownIntervalRef.current = null
                }
                setSilenceCountdown(null)
              }
            }, 1000)
            
            silenceTimerRef.current = setTimeout(() => {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
              }
              setSilenceCountdown(null)
              silenceTimerRef.current = null // Clear ref
              const timeSinceLastSpeech = Date.now() - (lastSpeechTimeRef.current || 0)
              console.log('✅✅✅ Silence detected after interim speech, answer complete - CALLING handleAnswerComplete', {
                timeSinceLastSpeech: `${(timeSinceLastSpeech / 1000).toFixed(1)}s`,
                isSpeaking,
                isWaitingForAnswer
              })
              // Reset flag before calling (like the button does)
              answerCompleteRef.current = false
              handleAnswerComplete()
            }, 5000) // 5 seconds of silence = answer complete
          } else {
            // Timer already running, just update last speech time
            lastSpeechTimeRef.current = Date.now()
            console.log('⏱️ Timer already running (interim), updated last speech time')
          }
        }
      }

      recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error)
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow microphone access in browser settings.')
        } else if (event.error === 'no-speech') {
          // This is normal, just continue
          console.log('No speech detected (this is normal)')
        } else if (event.error === 'aborted') {
          // Recognition was stopped, try to restart
          if (isCallStarted && isConnected) {
            setTimeout(() => {
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start()
                } catch (e) {
                  console.error('Error restarting after abort:', e)
                }
              }
            }, 500)
          }
        } else {
          console.error('Speech recognition error:', event.error)
        }
      }

      recognition.onend = () => {
        console.log('Speech recognition ended - user stopped speaking')
        
        // If user was speaking, start silence timer now
        if (isSpeaking && lastSpeechTimeRef.current) {
          const timeSinceAnswerComplete = answerCompleteTimeRef.current ? Date.now() - answerCompleteTimeRef.current : Infinity
          const cooldownPeriod = 3000 // 3 seconds cooldown after answering
          
          if (!silenceTimerRef.current && timeSinceAnswerComplete > cooldownPeriod) {
            console.log('🔇✅ Speech recognition ended - Starting 5 second timer!')
            
            // Clear any existing countdown interval
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
              countdownIntervalRef.current = null
            }
            
            // Start visual countdown
            let countdown = 5
            setSilenceCountdown(countdown)
            countdownIntervalRef.current = setInterval(() => {
              countdown--
              if (countdown > 0) {
                setSilenceCountdown(countdown)
              } else {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current)
                  countdownIntervalRef.current = null
                }
                setSilenceCountdown(null)
              }
            }, 1000)
            
            silenceTimerRef.current = setTimeout(() => {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
              }
              setSilenceCountdown(null)
              silenceTimerRef.current = null
              console.log('✅✅✅ 5 seconds of silence completed (speech recognition) - Moving to next question!')
              // Reset flag before calling (like the button does)
              answerCompleteRef.current = false
              handleAnswerComplete()
            }, 5000)
          }
        }
        
        // Only restart if we're still in the call and it wasn't manually stopped
        if (isCallStarted && isConnected && voiceDetectionInitializedRef.current) {
          // Restart after a short delay, but don't show toast again
          setTimeout(() => {
            if (recognitionRef.current && isCallStarted && isConnected && voiceDetectionInitializedRef.current) {
              try {
                console.log('Restarting speech recognition...')
                recognitionRef.current.start()
              } catch (err) {
                // Ignore errors if recognition is already running
                if (err.name !== 'InvalidStateError') {
                  console.error('Error restarting recognition:', err)
                }
              }
            }
          }, 500)
        }
      }

      recognitionRef.current = recognition
      
      // Request microphone permission first, then start recognition
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          console.log('✅ Microphone permission granted, stream:', stream)
          console.log('🎤 Starting speech recognition...')
          
          // Start recognition
          try {
            recognition.start()
            console.log('✅ Speech recognition started successfully')
            voiceDetectionInitializedRef.current = true
          } catch (startErr) {
            console.error('❌ Error starting recognition:', startErr)
            // Try again after a short delay
            setTimeout(() => {
              try {
                recognition.start()
                console.log('✅ Speech recognition started on retry')
                voiceDetectionInitializedRef.current = true
              } catch (retryErr) {
                console.error('❌ Retry failed:', retryErr)
                toast.error('Failed to start voice detection. Please refresh the page.')
              }
            }, 1000)
          }
        })
        .catch((err) => {
          console.error('❌ Microphone permission denied:', err)
          console.error('Error details:', {
            name: err.name,
            message: err.message,
            constraint: err.constraint
          })
          toast.error('Please allow microphone access to enable voice detection')
        })
    } catch (err) {
      console.error('Error initializing speech recognition:', err)
      toast.error('Failed to initialize voice recognition: ' + err.message)
    }
  }

  const initializeAudioAnalysis = () => {
    if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) {
      return
    }

    if (!room || !room.localParticipant) {
      console.warn('Room not ready for audio analysis')
      return
    }

    try {
      // Close existing context if any
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      const AudioContext = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512 // Higher FFT size for better frequency resolution
      analyser.smoothingTimeConstant = 0.8 // Smooth transitions
      analyser.minDecibels = -90
      analyser.maxDecibels = -10

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Connect to microphone/audio track from room
      const audioTracks = Array.from(room.localParticipant.audioTrackPublications.values())
      if (audioTracks.length > 0 && audioTracks[0].track) {
        try {
          const mediaStream = new MediaStream([audioTracks[0].track.mediaStreamTrack])
          const source = audioContext.createMediaStreamSource(mediaStream)
          source.connect(analyser)
          console.log('✅ Audio analysis connected to microphone')
        } catch (err) {
          console.error('❌ Error connecting audio source:', err)
          // Try alternative method - get stream directly from getUserMedia
          navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const source = audioContext.createMediaStreamSource(stream)
            source.connect(analyser)
            console.log('✅ Audio analysis connected via getUserMedia fallback')
          }).catch(e => {
            console.error('❌ Fallback audio connection failed:', e)
          })
        }
      } else {
        console.warn('⚠️ No audio tracks found, trying getUserMedia fallback')
        // Fallback: get audio directly from microphone
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          const source = audioContext.createMediaStreamSource(stream)
          source.connect(analyser)
          console.log('✅ Audio analysis connected via getUserMedia fallback')
        }).catch(e => {
          console.error('❌ Fallback audio connection failed:', e)
        })
      }

      // Monitor audio levels to detect speaking and visualize frequency
      const checkAudioLevel = () => {
        if (!analyserRef.current || !room) return
        
        // Don't update audio levels if AI is speaking (to prevent glitching)
        if (isAISpeaking) {
          return
        }

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        
        // Calculate average and peak levels
        const sum = dataArray.reduce((a, b) => a + b, 0)
        const average = sum / dataArray.length
        const peak = Math.max(...Array.from(dataArray))
        
        // Create frequency bars for visualization - use more bars for smoother waveform
        const frequencyBars = []
        const barCount = 40 // More bars for better waveform visualization
        
        // Sample frequency data to create bars
        const step = Math.floor(dataArray.length / barCount)
        for (let i = 0; i < barCount; i++) {
          const index = i * step
          const value = dataArray[index] || 0
          // Normalize to 0-100, with minimum height for visibility
          const normalized = Math.max(5, Math.min(100, (value / 255) * 100))
          frequencyBars.push(normalized)
        }
        
        // Apply smoothing to create wave-like effect
        const smoothedBars = frequencyBars.map((bar, i) => {
          if (i === 0 || i === frequencyBars.length - 1) return bar
          // Average with neighbors for smoother wave
          const prev = frequencyBars[i - 1]
          const next = frequencyBars[i + 1]
          return (bar * 0.6 + prev * 0.2 + next * 0.2)
        })
        
        // Only update audio levels if AI is not speaking
        setAudioLevels(smoothedBars)

        // Establish baseline ambient noise level (first few seconds when not speaking)
        if (baselineNoiseLevelRef.current === null && !isSpeaking) {
          // Sample ambient noise for first 2 seconds
          if (average > 0) {
            baselineNoiseLevelRef.current = average * 1.5 // Set baseline 50% higher than measured
            console.log('🔇 Baseline ambient noise level established:', baselineNoiseLevelRef.current.toFixed(2))
          }
        }

        // Dynamic threshold based on baseline noise
        const baseline = baselineNoiseLevelRef.current || 3 // Default if not established
        const speechThreshold = baseline * 3 // Speech is 3x baseline noise
        const relativeSilenceThreshold = baseline * 1.5 // Relative silence is 1.5x baseline (allows for ambient noise)
        
        // Log audio levels for debugging (only occasionally to avoid spam)
        if (Math.random() < 0.01) { // 1% of the time
          console.log('🎤 Audio levels:', { 
            average: average.toFixed(2), 
            peak: peak.toFixed(2),
            baseline: baseline.toFixed(2),
            speechThreshold: speechThreshold.toFixed(2),
            relativeSilenceThreshold: relativeSilenceThreshold.toFixed(2),
            isSpeaking
          })
        }
        
        // Detect speech: audio significantly above baseline
        if (average > speechThreshold || peak > speechThreshold * 2) {
          if (!isSpeaking) {
            console.log('🎤✅ VOICE DETECTED!', { 
              average: average.toFixed(2), 
              peak: peak.toFixed(2),
              baseline: baseline.toFixed(2),
              aboveBaseline: (average - baseline).toFixed(2)
            })
          }
          
          setIsSpeaking(true)
          setIsWaitingForAnswer(false) // Stop showing "waiting" when audio is detected
          setPromptCount(0)
          clearTimeout(answerTimeoutRef.current)
          
          // Track speaking audio level
          speakingAudioLevelRef.current = average
          
          // Clear any existing timer when new speech is detected
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          setSilenceCountdown(null) // Hide countdown while speaking
          
          // Update last speech time - timer will start when silence is detected
          answerCompleteRef.current = false // Reset flag when new speech detected
          lastSpeechTimeRef.current = Date.now() // Track when user last spoke
          
          // Clear any existing silence detection timer
          if (silenceDetectionTimerRef.current) {
            clearTimeout(silenceDetectionTimerRef.current)
            silenceDetectionTimerRef.current = null
          }
          
          // Start a timer that will trigger when user stops speaking (no new speech for 1 second)
          silenceDetectionTimerRef.current = setTimeout(() => {
            // User stopped speaking - start the 5 second countdown timer
            const timeSinceAnswerComplete = answerCompleteTimeRef.current ? Date.now() - answerCompleteTimeRef.current : Infinity
            const cooldownPeriod = 3000 // 3 seconds cooldown after answering
            
            if (!silenceTimerRef.current && timeSinceAnswerComplete > cooldownPeriod && lastSpeechTimeRef.current) {
              console.log('🔇✅ User stopped speaking (audio, no new speech for 1s) - Starting 5 second timer!')
              
              // Clear any existing countdown interval
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
              }
              
              // Start visual countdown
              let countdown = 5
              setSilenceCountdown(countdown)
              countdownIntervalRef.current = setInterval(() => {
                countdown--
                if (countdown > 0) {
                  setSilenceCountdown(countdown)
                } else {
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current)
                    countdownIntervalRef.current = null
                  }
                  setSilenceCountdown(null)
                }
              }, 1000)
              
              silenceTimerRef.current = setTimeout(() => {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current)
                  countdownIntervalRef.current = null
                }
                setSilenceCountdown(null)
                silenceTimerRef.current = null
                console.log('✅✅✅ 5 seconds of silence completed (audio) - Moving to next question!')
                // Reset flag before calling (like the button does)
                answerCompleteRef.current = false
                handleAnswerComplete()
              }, 5000)
            }
            silenceDetectionTimerRef.current = null
          }, 1000) // Wait 1 second of no new speech before starting countdown
          
          console.log('🎤 User speaking (audio) - silence detection timer started')
        } 
        // Detect relative silence: audio dropped back to near baseline (not zero, just near ambient)
        // START TIMER HERE - when user stops speaking
        else if (isSpeaking && average <= relativeSilenceThreshold && peak <= relativeSilenceThreshold * 1.5) {
          // User stopped speaking - audio dropped to ambient level
          // Check cooldown and start timer if not already running
          const timeSinceAnswerComplete = answerCompleteTimeRef.current ? Date.now() - answerCompleteTimeRef.current : Infinity
          const cooldownPeriod = 3000 // 3 seconds cooldown after answering
          
          if (!silenceTimerRef.current && timeSinceAnswerComplete > cooldownPeriod && lastSpeechTimeRef.current) {
            console.log('🔇✅ SILENCE DETECTED after speech - Starting 5 second timer!', {
              average: average.toFixed(2),
              baseline: baseline.toFixed(2),
              relativeSilenceThreshold: relativeSilenceThreshold.toFixed(2),
              timeSinceLastSpeech: `${((Date.now() - lastSpeechTimeRef.current) / 1000).toFixed(1)}s`
            })
            
            // Clear any existing countdown interval
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
              countdownIntervalRef.current = null
            }
            
            // Start visual countdown - THIS IS WHEN TIMER SHOULD APPEAR
            let countdown = 5
            setSilenceCountdown(countdown)
            countdownIntervalRef.current = setInterval(() => {
              countdown--
              if (countdown > 0) {
                setSilenceCountdown(countdown)
              } else {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current)
                  countdownIntervalRef.current = null
                }
                setSilenceCountdown(null)
              }
            }, 1000)
            
            silenceTimerRef.current = setTimeout(() => {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
              }
              setSilenceCountdown(null)
              silenceTimerRef.current = null // Clear ref
              const timeSinceLastSpeech = Date.now() - (lastSpeechTimeRef.current || 0)
              console.log('✅✅✅ 5 seconds of silence completed - Moving to next question!', {
                timeSinceLastSpeech: `${(timeSinceLastSpeech / 1000).toFixed(1)}s`
              })
              // Reset flag before calling (like the button does)
              answerCompleteRef.current = false
              handleAnswerComplete()
            }, 5000) // 5 seconds of silence = answer complete
          } else if (silenceTimerRef.current) {
            // Timer already running, just log
            console.log('🔇 Silence continuing, timer running...', {
              average: average.toFixed(2),
              countdown: silenceCountdown
            })
          }
        }
        // Update baseline if we're in ambient noise state
        else if (!isSpeaking && baselineNoiseLevelRef.current !== null) {
          // Gradually update baseline to adapt to changing ambient noise
          baselineNoiseLevelRef.current = baselineNoiseLevelRef.current * 0.95 + average * 0.05
        }
      }

      const interval = setInterval(checkAudioLevel, 50) // Update every 50ms for smooth animation
      
      // Store interval for cleanup
      return () => {
        clearInterval(interval)
        if (audioContextRef.current) {
          audioContextRef.current.close()
        }
      }
    } catch (err) {
      console.error('Audio analysis error:', err)
    }
  }

  const askQuestion = async (index) => {
    console.log('askQuestion called:', { index, totalQuestions: aiQuestions.length, currentIndex: currentQuestionIndex, isAsking: isAskingQuestionRef.current })
    
    // Reset cooldown when starting a new question
    answerCompleteTimeRef.current = null
    
    if (index >= aiQuestions.length) {
      // All questions asked
      isAskingQuestionRef.current = false
      toast.success('Interview completed!')
      return
    }

    // Prevent duplicate questions only if we're already asking the same question
    if (isAskingQuestionRef.current && currentQuestionIndex === index && index > 0) {
      console.log('Question already being asked, skipping...')
      return
    }

    isAskingQuestionRef.current = true
    const question = aiQuestions[index]
    console.log('Asking question', index + 1, ':', question)
    setCurrentQuestionIndex(index)
    setIsWaitingForAnswer(true)
    setPromptCount(0)

    // Small delay before speaking to ensure state is updated
    setTimeout(() => {
      // Speak the question using text-to-speech
      speakQuestion(question)
    }, 500)

    // Set timeout to prompt if no answer (30 seconds)
    answerTimeoutRef.current = setTimeout(() => {
      if (isWaitingForAnswer && promptCount < 2) {
        promptForAnswer(question, promptCount + 1)
      } else if (promptCount >= 2) {
        // Move to next question after 2 prompts
        toast('Moving to next question...', { icon: 'ℹ️' })
        moveToNextQuestion()
      }
    }, 30000) // 30 seconds timeout
  }

  const speakQuestion = (question) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return
    }

    // Stop any ongoing speech
    window.speechSynthesis.cancel()

    // Wait for voices to load
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      
      const utterance = new SpeechSynthesisUtterance(question)
      
      // Alexa-like settings: slower, warmer, friendlier
      utterance.rate = 0.85  // Slower for friendliness
      utterance.pitch = 1.0  // Natural pitch
      utterance.volume = 1
      
      // Find Alexa-like voice (prioritize female, warm voices)
      const voicePriority = [
        'Alex',           // macOS - friendly female
        'Samantha',       // macOS - warm female
        'Karen',          // macOS - Australian female
        'Victoria',       // macOS - British female
        'Google US English', // Chrome - friendly
        'Microsoft Zira',    // Windows - friendly female
        'Microsoft Hazel',   // Windows - British female
      ]
      
      let selectedVoice = null
      for (const voiceName of voicePriority) {
        selectedVoice = voices.find(v => 
          v.name.includes(voiceName) || 
          v.name.toLowerCase().includes(voiceName.toLowerCase())
        )
        if (selectedVoice) {
          console.log('Selected voice:', selectedVoice.name)
          break
        }
      }
      
      // Fallback to first female voice if no preferred found
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
                       voices.find(v => v.lang.startsWith('en'))
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      utterance.onstart = () => {
        console.log('🎤 Speaking question:', question)
        setIsAISpeaking(true)
        
        // Simulate audio levels for AI speaking (waveform animation)
        // Use 40 bars to match user animation
        const aiSpeakingInterval = setInterval(() => {
          // Generate random frequency bars for AI speaking animation (waveform effect)
          const aiBars = Array.from({ length: 40 }, () => {
            // Create a more natural waveform pattern with variation
            const base = 30 + Math.random() * 50
            return Math.min(100, base)
          })
          // Apply smoothing for AI animation too
          const smoothedAiBars = aiBars.map((bar, i) => {
            if (i === 0 || i === aiBars.length - 1) return bar
            const prev = aiBars[i - 1]
            const next = aiBars[i + 1]
            return (bar * 0.6 + prev * 0.2 + next * 0.2)
          })
          setAudioLevels(smoothedAiBars)
        }, 50) // Update every 50ms for smooth animation (matching user animation)
        
        // Store interval to clear later
        utterance._aiInterval = aiSpeakingInterval
      }

      utterance.onend = () => {
        console.log('✅ Question spoken')
        isAskingQuestionRef.current = false
        setIsAISpeaking(false)
        setAudioLevels([]) // Clear animation when done
        if (utterance._aiInterval) {
          clearInterval(utterance._aiInterval)
        }
      }

      utterance.onerror = (err) => {
        console.error('Speech synthesis error:', err)
        isAskingQuestionRef.current = false
        setIsAISpeaking(false)
        setAudioLevels([])
        if (utterance._aiInterval) {
          clearInterval(utterance._aiInterval)
        }
      }

      window.speechSynthesis.speak(utterance)
    }

    // Load voices if not already loaded
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    } else {
      loadVoices()
    }
  }

  const promptForAnswer = (question, count) => {
    setPromptCount(count)
    const prompt = count === 1 
      ? "Please answer the question. Take your time."
      : "If you're unable to answer, we'll move to the next question."
    
    speakQuestion(prompt)
    toast(prompt, { icon: 'ℹ️' })

    // Set another timeout
    answerTimeoutRef.current = setTimeout(() => {
      if (count >= 2) {
        moveToNextQuestion()
      }
    }, 30000)
  }

  const handleAnswerComplete = () => {
    console.log('🎯 handleAnswerComplete called', {
      answerCompleteRef: answerCompleteRef.current,
      isWaitingForAnswer,
      isSpeaking,
      currentIndex: currentQuestionIndex,
      totalQuestions: aiQuestions.length
    })
    
    // REMOVED ALL CHECKS - FORCE IMMEDIATE PROGRESSION
    console.log('🎯🎯🎯 handleAnswerComplete - FORCING NEXT QUESTION IMMEDIATELY')
    
    // Flag is already false from timer/button - don't set it to true
    setSilenceCountdown(null)
    answerCompleteTimeRef.current = Date.now()
    
    setIsWaitingForAnswer(false)
    setIsSpeaking(false)
    clearTimeout(answerTimeoutRef.current)
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (silenceDetectionTimerRef.current) {
      clearTimeout(silenceDetectionTimerRef.current)
      silenceDetectionTimerRef.current = null
    }
    
    // IMMEDIATELY call moveToNextQuestion - NO DELAY, NO CHECKS
    console.log('⏭️⏭️⏭️ CALLING moveToNextQuestion IMMEDIATELY')
    moveToNextQuestion()
  }

  const moveToNextQuestion = () => {
    console.log('🔄🔄🔄 moveToNextQuestion CALLED', {
      currentIndex: currentQuestionIndex,
      totalQuestions: aiQuestions?.length || 0,
      nextIndex: currentQuestionIndex + 1,
      hasQuestions: (aiQuestions?.length || 0) > 0,
      questionsArray: aiQuestions
    })
    
    setIsWaitingForAnswer(false)
    setIsSpeaking(false)
    setSilenceCountdown(null) // Clear countdown
    clearTimeout(answerTimeoutRef.current)
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (silenceDetectionTimerRef.current) {
      clearTimeout(silenceDetectionTimerRef.current)
      silenceDetectionTimerRef.current = null
    }
    setPromptCount(0)
    isAskingQuestionRef.current = false
    answerCompleteRef.current = false // Reset flag
    
    const nextIndex = currentQuestionIndex + 1
    const totalQuestions = aiQuestions?.length || 0
    
    console.log('📊 Next question index:', nextIndex, 'Total questions:', totalQuestions)
    
    // FORCE PROCEED - Check if we have questions array and next question exists
    if (totalQuestions > 0 && nextIndex < totalQuestions) {
      console.log('✅✅✅ PROCEEDING TO NEXT QUESTION:', nextIndex)
      
      // Update the question index first
      setCurrentQuestionIndex(nextIndex)
      
      // IMMEDIATELY ask next question - no delay
      console.log('⏭️⏭️⏭️ Asking next question IMMEDIATELY:', nextIndex, 'Question:', aiQuestions[nextIndex])
      if (aiQuestions && aiQuestions[nextIndex]) {
        // Reset cooldown
        answerCompleteTimeRef.current = null
        askQuestion(nextIndex)
      } else {
        console.error('❌ Question not found at index:', nextIndex, 'Questions:', aiQuestions)
        toast.error('Error: Question not found')
      }
    } else {
      console.log('✅ All questions completed!', { nextIndex, totalQuestions })
      toast.success('All questions completed!')
      setIsWaitingForAnswer(false)
    }
  }

  const attachVideoTrack = (track) => {
    if (!localVideoRef.current || !track) {
      console.error('Cannot attach video: missing ref or track', { hasRef: !!localVideoRef.current, hasTrack: !!track })
      return
    }

    try {
      console.log('🎥 Attaching video track:', track.kind, track.track?.id)
      
      // Clear container first
      localVideoRef.current.innerHTML = ''
      
      // Attach track to element
      const element = track.attach()
      if (!element) {
        console.error('❌ Failed to attach video track - no element returned')
        return
      }

      console.log('✅ Video element created:', element.tagName, element)
      
      // Ensure it's a video element
      if (element.tagName === 'VIDEO' || element.tagName === 'video') {
        // Set all properties BEFORE appending
        element.className = 'w-full h-full object-cover'
        element.autoplay = true
        element.playsInline = true
        element.muted = true
        element.style.width = '100%'
        element.style.height = '100%'
        element.style.objectFit = 'cover'
        element.style.display = 'block'
        element.style.visibility = 'visible'
        element.style.opacity = '1'
        element.style.backgroundColor = '#000'
        element.style.transform = 'scaleX(-1)' // Flip horizontally to fix mirror effect
        
        // Set attributes
        element.setAttribute('autoplay', 'true')
        element.setAttribute('playsinline', 'true')
        element.setAttribute('muted', 'true')
        
        // Add event listeners BEFORE appending
        const handleLoadedMetadata = () => {
          console.log('✅ Video metadata loaded')
          setIsVideoLoaded(true)
        }
        
        const handlePlaying = () => {
          console.log('✅ Video is playing')
          setIsVideoLoaded(true)
        }
        
        const handleCanPlay = () => {
          console.log('✅ Video can play')
          setIsVideoLoaded(true)
        }
        
        const handleError = (e) => {
          console.error('❌ Video error:', e)
          setIsVideoLoaded(false)
        }
        
        element.addEventListener('loadedmetadata', handleLoadedMetadata)
        element.addEventListener('playing', handlePlaying)
        element.addEventListener('canplay', handleCanPlay)
        element.addEventListener('canplaythrough', handleCanPlay)
        element.addEventListener('error', handleError)
        
        // Append to container
        localVideoRef.current.appendChild(element)
        console.log('✅ Video element appended to container')
        console.log('📊 Video element details:', {
          tagName: element.tagName,
          src: element.src,
          srcObject: element.srcObject,
          readyState: element.readyState,
          videoWidth: element.videoWidth,
          videoHeight: element.videoHeight,
          paused: element.paused,
          muted: element.muted
        })
        
        // Force play immediately
        const playVideo = () => {
          console.log('▶️ Attempting to play video...')
          element.play().then(() => {
            console.log('✅ Video playing successfully')
            console.log('📊 After play:', {
              paused: element.paused,
              readyState: element.readyState,
              videoWidth: element.videoWidth,
              videoHeight: element.videoHeight
            })
            setIsVideoEnabled(true)
            setIsVideoLoaded(true)
          }).catch(err => {
            console.error('❌ Error playing video:', err)
            console.error('Error details:', {
              name: err.name,
              message: err.message,
              code: err.code
            })
            // Try again after a short delay
            setTimeout(() => {
              console.log('🔄 Retrying video play...')
              element.play().then(() => {
                console.log('✅ Video playing on retry')
                setIsVideoEnabled(true)
                setIsVideoLoaded(true)
              }).catch(e => {
                console.error('❌ Retry play failed:', e)
                setIsVideoLoaded(false)
                toast.error('Video playback failed. Please check camera permissions.')
              })
            }, 1000)
          })
        }
        
        // Try to play immediately
        playVideo()
        
        // Also try after short delays in case the track isn't ready
        setTimeout(playVideo, 300)
        setTimeout(playVideo, 800)
        setTimeout(playVideo, 1500)
        
      } else {
        console.warn('⚠️ Element is not a video element:', element.tagName)
        // Still append it
        localVideoRef.current.appendChild(element)
        setIsVideoLoaded(true) // Assume it's loaded even if not video
      }
    } catch (err) {
      console.error('❌ Error in attachVideoTrack:', err)
      toast.error('Failed to attach video track')
      setIsVideoLoaded(false)
    }
  }

  const joinRoom = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get LiveKit token
      const tokenResponse = await fetchJSON(
        `/api/livekit/token?room=${encodeURIComponent(roomName)}&name=${encodeURIComponent(session.user.name || 'User')}&role=${role}&eventId=${eventId}`
      )

      if (!tokenResponse.token || !tokenResponse.url) {
        throw new Error('Failed to get LiveKit token')
      }

      // Connect to room
      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      const connectUrl = tokenResponse.url.startsWith('wss://') || tokenResponse.url.startsWith('ws://') 
        ? tokenResponse.url 
        : `wss://${tokenResponse.url}`
      
      await lkRoom.connect(connectUrl, tokenResponse.token)
      setRoom(lkRoom)
      setIsConnected(true)

      // Set up event listeners FIRST (before publishing tracks)
      setupRoomListeners(lkRoom)

      // Get local tracks and publish
      console.log('🎥 Creating local tracks...')
      const tracks = await createLocalTracks({
        audio: true,
        video: true
      })
      console.log('✅ Local tracks created:', tracks.length, tracks.map(t => t.kind))

      // Publish and attach local tracks
      for (const track of tracks) {
        console.log(`📤 Publishing ${track.kind} track...`)
        await lkRoom.localParticipant.publishTrack(track)
        console.log(`✅ ${track.kind} track published`)
        
        if (track.kind === 'video') {
          console.log('🎥 Video track found, attaching...')
          localTrackRef.current = track
          
          // Try attaching immediately
          if (localVideoRef.current) {
            attachVideoTrack(track)
          } else {
            console.warn('⚠️ localVideoRef not ready, will retry...')
            // Retry after a short delay
            setTimeout(() => {
              if (localVideoRef.current) {
                console.log('🔄 Retrying video attachment...')
                attachVideoTrack(track)
              } else {
                console.error('❌ localVideoRef is still null after retry')
              }
            }, 500)
          }
        }
      }

      // Initialize audio analysis after tracks are published
      // Wait a bit longer to ensure tracks are fully ready
      setTimeout(() => {
        if (lkRoom && lkRoom.localParticipant) {
          initializeAudioAnalysis()
        }
      }, 2000)

      // Load AI questions if interviewer
      if (role === 'interviewer' || role === 'participant') {
        loadAIQuestions()
      }

      toast.success('Connected to interview room')
    } catch (err) {
      console.error('Failed to join room:', err)
      setError(err.message || 'Failed to join interview room')
      toast.error('Failed to join interview room')
    } finally {
      setLoading(false)
    }
  }

  const setupRoomListeners = (lkRoom) => {
    // Track subscribed (remote participant)
    lkRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === 'video') {
        const elementId = `remote-${participant.identity}`
        let container = document.getElementById(elementId)
        
        if (!container) {
          container = document.createElement('div')
          container.id = elementId
          container.className = 'w-full h-full'
          const remoteContainer = document.getElementById('remote-video-container')
          if (remoteContainer) {
            remoteContainer.appendChild(container)
          }
        }
        
        const element = track.attach()
        if (element) {
          if (element.tagName === 'VIDEO') {
            element.className = 'w-full h-full object-cover'
            element.setAttribute('autoplay', 'true')
            element.setAttribute('playsinline', 'true')
            element.style.width = '100%'
            element.style.height = '100%'
            element.style.objectFit = 'cover'
          }
          container.innerHTML = ''
          container.appendChild(element)
        }
        remoteVideoRefs.current[participant.identity] = container
      }
    })

    // Track unsubscribed
    lkRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      const elementId = `remote-${participant.identity}`
      const element = document.getElementById(elementId)
      if (element) {
        element.remove()
      }
      delete remoteVideoRefs.current[participant.identity]
    })

    // Participant connected
    lkRoom.on(RoomEvent.ParticipantConnected, (participant) => {
      setParticipants(prev => [...prev, participant])
    })

    // Participant disconnected
    lkRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
      setParticipants(prev => prev.filter(p => p.identity !== participant.identity))
    })

    // Data received
    lkRoom.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload))
        
        if (data.type === 'transcription') {
          setTranscription(prev => [...prev, {
            speaker: data.speaker,
            text: data.text,
            timestamp: new Date()
          }])
        } else if (data.type === 'ai_question') {
          setAiQuestions(prev => [...prev, data.question])
        }
      } catch (err) {
        console.error('Failed to parse data:', err)
      }
    })
  }

  const toggleMute = async () => {
    if (!room) return

    const audioPublication = Array.from(room.localParticipant.audioTrackPublications.values())[0]
    if (audioPublication?.track) {
      if (isMuted) {
        await audioPublication.track.unmute()
      } else {
        await audioPublication.track.mute()
      }
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = async () => {
    if (!room) {
      toast.error('Room not connected')
      return
    }

    try {
      if (isVideoEnabled) {
        // Disable video
        const videoPublications = Array.from(room.localParticipant.videoTrackPublications.values())
        for (const publication of videoPublications) {
          if (publication.track) {
            await publication.track.stop()
            await room.localParticipant.unpublishTrack(publication.track)
          }
        }
        if (localVideoRef.current) {
          localVideoRef.current.innerHTML = ''
        }
        if (localTrackRef.current) {
          localTrackRef.current.stop()
          localTrackRef.current = null
        }
        setIsVideoEnabled(false)
        toast('Video disabled', { icon: 'ℹ️' })
      } else {
        // Enable video
        const tracks = await createLocalTracks({ video: true })
        if (tracks.length === 0) {
          toast.error('Failed to access camera. Please check permissions.')
          return
        }
        
        for (const track of tracks) {
          await room.localParticipant.publishTrack(track)
          if (track.kind === 'video') {
            localTrackRef.current = track
            attachVideoTrack(track)
          }
        }
        setIsVideoEnabled(true)
        toast.success('Video enabled')
      }
    } catch (err) {
      console.error('Error toggling video:', err)
      toast.error(`Failed to ${isVideoEnabled ? 'disable' : 'enable'} video: ${err.message}`)
    }
  }

  const loadAIQuestions = async () => {
    try {
      console.log('Loading AI questions for event:', eventId)
      const response = await fetchJSON(`/api/ai/interview/questions?eventId=${eventId}`)
      console.log('AI questions response:', response)
      
      if (response.questions && Array.isArray(response.questions)) {
        setAiQuestions(response.questions)
        console.log('Loaded', response.questions.length, 'AI questions')
      } else {
        console.warn('Invalid questions format:', response)
        setAiQuestions([
          'Tell me about yourself and your background.',
          'Why are you interested in this position?',
          'What are your greatest strengths?'
        ])
      }
    } catch (err) {
      console.error('Failed to load AI questions:', err)
      setAiQuestions([
        'Tell me about yourself and your background.',
        'Why are you interested in this position?',
        'What are your greatest strengths?',
        'Describe a challenging project you worked on.',
        'How do you handle tight deadlines?'
      ])
    }
  }

  const generateAIQuestion = async () => {
    try {
      const response = await fetchJSON('/api/ai/interview/generate-question', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          context: transcription.slice(-5).map(t => t.text).join(' ')
        })
      })
      
      if (response.question) {
        setAiQuestions(prev => [...prev, response.question])
        toast.success('AI question generated')
      }
    } catch (err) {
      console.error('Failed to generate AI question:', err)
      toast.error('Failed to generate AI question')
    }
  }

  const endInterview = async () => {
    if (room) {
      room.disconnect()
    }
    
    if (localTrackRef.current) {
      localTrackRef.current.stop()
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (answerTimeoutRef.current) {
      clearTimeout(answerTimeoutRef.current)
    }
    
    // Save interview notes
    if (interviewNotes || transcription.length > 0) {
      try {
        await fetchJSON(`/api/events/${eventId}/interview-notes`, {
          method: 'POST',
          body: JSON.stringify({
            notes: interviewNotes,
            transcription: transcription,
            duration: Date.now() - (room?.startTime || Date.now())
          })
        })
      } catch (err) {
        console.error('Failed to save interview notes:', err)
      }
    }

    if (onExit) {
      onExit()
    }
  }

  const startCall = () => {
    setIsCallStarted(true)
  }

  // Get job title and candidate name from event data
  const jobTitle = eventData?.application?.job?.title || eventData?.title || 'Interview'
  const candidateName = eventData?.application?.candidate?.name || session?.user?.name || 'Candidate'
  const interviewerName = role === 'interviewer' ? (session?.user?.name || 'Interviewer') : 'AI Interviewer'
  const currentQuestion = aiQuestions[currentQuestionIndex] || ''

  if (loading && isCallStarted) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Joining interview room...</p>
        </div>
      </div>
    )
  }

  if (error && isCallStarted) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
        <div className="text-center bg-red-900/50 p-6 rounded-lg border border-red-800">
          <p className="text-white text-xl mb-4">Failed to join interview</p>
          <p className="text-red-200 mb-4">{error}</p>
          <button
            onClick={joinRoom}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // PrepWise-style UI
  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">H</span>
            </div>
            <div>
              <h1 className="text-white text-lg font-semibold">{jobTitle}</h1>
            </div>
            <button className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
          <span className="text-white text-xs font-medium">Technical</span>
        </div>
      </div>

      {/* Main Content - Two Participant Cards */}
      {!isCallStarted ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="flex gap-8 mb-8">
              {/* AI Interviewer Card */}
              <div className="w-80 h-96 bg-gray-900 rounded-xl border border-gray-800 flex flex-col items-center justify-center p-6">
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-white text-lg font-medium">{interviewerName}</p>
              </div>

              {/* Candidate Card */}
              <div className="w-80 h-96 bg-gray-900 rounded-xl border border-gray-800 flex flex-col items-center justify-center p-6">
                <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt={candidateName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-4xl font-semibold">
                      {candidateName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-white text-lg font-medium lowercase">{candidateName}</p>
              </div>
            </div>
            <button
              onClick={startCall}
              className="bg-green-500 hover:bg-green-600 text-white px-12 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              Call
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 p-6">
          {/* AI Interviewer Card */}
          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden relative flex items-center justify-center">
            {participants.length > 0 ? (
              <div id="remote-video-container" className="w-full h-full" />
            ) : (
              <div className="text-center">
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-white text-lg font-medium">{interviewerName}</p>
              </div>
            )}
          </div>

          {/* Candidate Card (Local Video) */}
          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden relative">
            <div 
              ref={localVideoRef} 
              className="w-full h-full min-h-[500px] flex items-center justify-center bg-black relative"
              style={{ minHeight: '500px' }}
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-white text-4xl font-semibold">
                    {candidateName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="absolute bottom-6 text-white text-lg font-medium lowercase">{candidateName}</p>
              </div>
            )}
            {isVideoEnabled && !isVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-0">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white">Loading video...</p>
                  <p className="text-gray-400 text-sm mt-2">Please allow camera access</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Question Display */}
      {isCallStarted && currentQuestion && (
        <div className="px-6 py-4 bg-gray-900/80 border-t border-gray-800">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-white text-lg font-medium mb-1">{currentQuestion}</p>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>Question {currentQuestionIndex + 1} of {aiQuestions.length}</span>
                  {isAISpeaking && (
                    <span className="flex items-center gap-2 text-purple-400">
                      <div className="flex items-end gap-0.5 h-6">
                        {audioLevels.length > 0 ? audioLevels.map((level, i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-gradient-to-t from-purple-600 via-purple-500 to-purple-400 rounded-full transition-all duration-50"
                            style={{
                              height: `${Math.max(2, (level / 100) * 24)}px`,
                              minHeight: '2px',
                              maxHeight: '24px',
                              transition: 'height 0.05s ease-out'
                            }}
                          />
                        )) : Array.from({ length: 40 }, (_, i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-purple-500 rounded-full"
                            style={{
                              height: `${3 + Math.sin(i * 0.3) * 8}px`,
                              animation: `waveform 1s ease-in-out infinite`,
                              animationDelay: `${i * 0.05}s`
                            }}
                          />
                        ))}
                      </div>
                      <span>AI Speaking...</span>
                    </span>
                  )}
                  {isSpeaking && !isAISpeaking && (
                    <span className="flex items-center gap-2 text-green-400">
                      <div className="flex items-end gap-0.5 h-6">
                        {audioLevels.length > 0 ? audioLevels.map((level, i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-gradient-to-t from-green-600 via-green-500 to-green-400 rounded-full transition-all duration-50"
                            style={{
                              height: `${Math.max(2, (level / 100) * 24)}px`,
                              minHeight: '2px',
                              maxHeight: '24px',
                              transition: 'height 0.05s ease-out'
                            }}
                          />
                        )) : (
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        )}
                      </div>
                      <span>Listening...</span>
                      {silenceCountdown !== null && (
                        <span className="text-yellow-400 font-mono font-bold">(Next in {silenceCountdown}s)</span>
                      )}
                    </span>
                  )}
                  {isWaitingForAnswer && !isSpeaking && !isAISpeaking && (
                    <span className="flex items-center gap-2 text-yellow-400">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                      Waiting for answer... (Speak now!)
                    </span>
                  )}
                  {voiceDetectionInitializedRef.current && (
                    <span className="text-green-400 text-xs flex items-center gap-1 ml-2">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                      Voice detection active
                    </span>
                  )}
                  {/* Manual "Next Question" button as fallback */}
                  {(isWaitingForAnswer || isSpeaking) && (
                    <button
                      onClick={() => {
                        console.log('👤 User clicked "Next Question" button')
                        answerCompleteRef.current = false // Reset flag
                        handleAnswerComplete()
                      }}
                      className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    >
                      Next Question →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      {isCallStarted && (
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <div className="flex gap-3">
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {isMuted ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                !isVideoEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {isVideoEnabled ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={endInterview}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              End Call
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
