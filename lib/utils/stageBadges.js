/**
 * Consistent stage badge colors and styles
 * Used across all dashboards for consistency
 */

export const STAGE_COLORS = {
  Applied: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  Screen: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  Interview: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  Offer: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  Hired: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  Rejected: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' }
}

export function getStageBadge(stage) {
  const colors = STAGE_COLORS[stage] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }
  return {
    className: `px-2 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`,
    colors
  }
}

export function StageBadge({ stage, className = '' }) {
  const badge = getStageBadge(stage)
  return (
    <span className={`${badge.className} ${className}`}>
      {stage || 'Unknown'}
    </span>
  )
}

