import { useRef, useCallback, useState } from 'react';

export default function SplitPane({
  direction = 'horizontal',
  initialSize,
  minSize = 100,
  maxSize = 800,
  children,
  onResize,
  className = '',
}) {
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);

    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const startSize = size;

    const handleMouseMove = (moveEvent) => {
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      let delta = currentPos - startPos;

      // For vertical (terminal), dragging up = smaller delta but we want bigger panel
      if (direction === 'vertical') {
        delta = -delta;
      }

      const newSize = Math.min(maxSize, Math.max(minSize, startSize + delta));
      setSize(newSize);
      onResize?.(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, size, minSize, maxSize, onResize]);

  const isHorizontal = direction === 'horizontal';
  const childArray = Array.isArray(children) ? children : [children];

  return (
    <div
      ref={containerRef}
      className={`split-pane split-pane-${direction} ${className}`}
    >
      {/* First pane */}
      <div
        style={isHorizontal
          ? { width: `${size}px`, minWidth: `${minSize}px`, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
          : { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
        }
      >
        {childArray[0]}
      </div>

      {/* Drag handle */}
      <div
        className={`split-pane-handle split-pane-handle-${direction} ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      />

      {/* Second pane */}
      <div
        style={isHorizontal
          ? { flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
          : { height: `${size}px`, minHeight: `${minSize}px`, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
        }
      >
        {childArray[1]}
      </div>
    </div>
  );
}
