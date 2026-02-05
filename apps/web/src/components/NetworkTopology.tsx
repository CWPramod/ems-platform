import { useEffect, useRef } from 'react';
import type { NetworkDevice } from '../types';

interface NetworkTopologyProps {
  devices: NetworkDevice[];
  onDeviceSelect: (device: NetworkDevice) => void;
}

const NetworkTopology = ({ devices, onDeviceSelect }: NetworkTopologyProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || devices.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 500;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate positions for devices
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    // Group devices by type
    // Draw connections (simplified - connect all to center)
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 2;
    devices.forEach((_device, index) => {
      const angle = (index / devices.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    // Draw center node (core network)
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CORE', centerX, centerY);

    // Draw devices
    devices.forEach((device, index) => {
      const angle = (index / devices.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Device color based on status
      let color = '#9CA3AF'; // gray (unknown)
      if (device.status === 'reachable') color = '#10B981'; // green
      else if (device.status === 'unreachable') color = '#EF4444'; // red
      else if (device.status === 'degraded') color = '#F59E0B'; // yellow

      // Draw device circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, 2 * Math.PI);
      ctx.fill();

      // Draw device icon
      ctx.fillStyle = 'white';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let icon = '🌐';
      if (device.type === 'router') icon = '🔀';
      else if (device.type === 'switch') icon = '🔌';
      else if (device.type === 'firewall') icon = '🛡️';
      else if (device.type === 'load_balancer') icon = '⚖️';
      
      ctx.fillText(icon, x, y);

      // Draw device label
      ctx.fillStyle = '#1F2937';
      ctx.font = '12px sans-serif';
      ctx.fillText(device.name, x, y + 45);
    });

  }, [devices]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    // Check if click is on a device
    devices.forEach((device, index) => {
      const angle = (index / devices.length) * 2 * Math.PI;
      const deviceX = centerX + radius * Math.cos(angle);
      const deviceY = centerY + radius * Math.sin(angle);

      const distance = Math.sqrt(
        Math.pow(x - deviceX, 2) + Math.pow(y - deviceY, 2)
      );

      if (distance <= 25) {
        onDeviceSelect(device);
      }
    });
  };

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-4xl mb-2">🔍</p>
          <p>No devices to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full cursor-pointer border border-gray-200 rounded-lg"
        style={{ height: '500px' }}
      />
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Degraded</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Offline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
          <span>Unknown</span>
        </div>
      </div>
    </div>
  );
};

export default NetworkTopology;
