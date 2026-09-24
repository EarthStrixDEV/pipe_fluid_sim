import { useEffect, useRef } from 'react';
import { PipeFlowScene } from '../scene/PipeFlowScene.js';

/**
 * cameraRequest = { preset, id } — a new id triggers a fly-to even if the preset is repeated.
 */
export default function SceneView({ result, mode, selectedPoint, onSelectPoint, cameraRequest, showTracers, fillLevel }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const onSelectRef = useRef(onSelectPoint);
  onSelectRef.current = onSelectPoint;

  useEffect(() => {
    const s = new PipeFlowScene(containerRef.current, { onSelectPoint: name => onSelectRef.current?.(name) });
    sceneRef.current = s;
    return () => { s.dispose(); sceneRef.current = null; };
  }, []);

  // Effects run in declaration order, so the scene exists before these fire.
  useEffect(() => { sceneRef.current?.update(result); }, [result]);
  useEffect(() => { sceneRef.current?.setMode(mode); }, [mode]);
  useEffect(() => { sceneRef.current?.setSelectedPoint(selectedPoint); }, [selectedPoint]);
  useEffect(() => { sceneRef.current?.setTracersVisible(showTracers); }, [showTracers]);
  useEffect(() => { sceneRef.current?.setFillLevel(fillLevel); }, [fillLevel]);
  useEffect(() => { if (cameraRequest) sceneRef.current?.flyTo(cameraRequest.preset); }, [cameraRequest]);

  return <div ref={containerRef} className="scene" />;
}
