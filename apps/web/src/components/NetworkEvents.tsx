import type { Event } from '../types';

interface NetworkEventsProps {
  events: Event[];
}

const NetworkEvents = ({ events }: NetworkEventsProps) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📌';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-2xl mb-2">✅</p>
        <p>No recent events</p>
        <p className="text-sm mt-1">All systems operating normally</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {events.map((event) => (
        <div
          key={event.id}
          className={`border rounded-lg p-4 ${getSeverityColor(event.severity)}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{getSeverityIcon(event.severity)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm truncate">{event.title}</h4>
                <span className="text-xs whitespace-nowrap">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <p className="text-sm opacity-90 mb-2">{event.message}</p>
              
              {/* Metadata */}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(event.metadata).slice(0, 3).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded"
                    >
                      <span className="font-medium">{key}:</span> {String(value)}
                    </span>
                  ))}
                </div>
              )}

              {/* Occurrence Count */}
              {event.occurrenceCount && event.occurrenceCount > 1 && (
                <div className="mt-2 text-xs opacity-75">
                  🔄 Occurred {event.occurrenceCount} times
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NetworkEvents;
