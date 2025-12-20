'use client'

import React, { useState } from 'react'
import { format, addMinutes, setHours, setMinutes, startOfDay, isBefore, isAfter } from 'date-fns'

/**
 * TimePicker Component
 * Allows candidates to select available time slots for interviews
 */
export default function TimePicker({ 
  availableSlots = [], 
  duration = 30, 
  timezone = 'UTC',
  onTimeSelect,
  selectedDate = new Date()
}) {
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Generate time slots for the selected date
  const generateTimeSlots = (date) => {
    const slots = []
    const startTime = setHours(setMinutes(startOfDay(date), 0), 9) // 9 AM
    const endTime = setHours(setMinutes(startOfDay(date), 0), 17) // 5 PM
    let currentTime = startTime

    while (isBefore(currentTime, endTime) || currentTime.getTime() === endTime.getTime()) {
      // Check if this slot is available
      const isAvailable = !availableSlots.some(slot => {
        const slotStart = new Date(slot.start)
        const slotEnd = new Date(slot.end)
        return (
          (currentTime >= slotStart && currentTime < slotEnd) ||
          (addMinutes(currentTime, duration) > slotStart && addMinutes(currentTime, duration) <= slotEnd)
        )
      })

      if (isAvailable) {
        slots.push({
          start: new Date(currentTime),
          end: addMinutes(currentTime, duration),
        })
      }

      currentTime = addMinutes(currentTime, duration)
    }

    return slots
  }

  const timeSlots = generateTimeSlots(selectedDate)

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot)
    if (onTimeSelect) {
      onTimeSelect(slot)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Select a Time Slot</h3>
      <p className="text-sm text-gray-600">
        Duration: {duration} minutes | Timezone: {timezone}
      </p>

      {timeSlots.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No available time slots for this date.</p>
          <p className="text-sm mt-2">Please select a different date.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {timeSlots.map((slot, index) => {
            const isSelected = selectedSlot?.start?.getTime() === slot.start.getTime()
            return (
              <button
                key={index}
                onClick={() => handleSlotSelect(slot)}
                className={`px-4 py-2 rounded-md border-2 transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {format(slot.start, 'h:mm a')}
              </button>
            )
          })}
        </div>
      )}

      {selectedSlot && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm font-medium text-green-800">
            Selected: {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')} at {format(selectedSlot.start, 'h:mm a')}
          </p>
          <p className="text-xs text-green-600 mt-1">
            End time: {format(selectedSlot.end, 'h:mm a')}
          </p>
        </div>
      )}
    </div>
  )
}

