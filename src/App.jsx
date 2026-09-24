import { useCallback, useMemo, useState } from 'react';
import { computeHydraulics, statusMessages } from './physics/hydraulics.js';
import SceneView from './components/SceneView.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import ReadoutPanel from './components/ReadoutPanel.jsx';
import ModePanel from './components/ModePanel.jsx';
import Legend from './components/Legend.jsx';
import ProbePanel from './components/ProbePanel.jsx';
import FillPanel from './components/FillPanel.jsx';

const INITIAL_PARAMS = { flowRate: 120, smallDiameter: 25, valveOpening: 70, inletPressure: 200 };

export default function App() {
  const [params, setParams] = useState(INITIAL_PARAMS);
  const [mode, setMode] = useState('water');

  const result = useMemo(() => computeHydraulics(params), [params]);
  const status = useMemo(() => statusMessages(result), [result]);
  const updateParam = useCallback((key, value) => setParams(p => ({ ...p, [key]: value })), []);

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [cameraRequest, setCameraRequest] = useState(null);
  const [showTracers, setShowTracers] = useState(true);
  const [fillMode, setFillMode] = useState('full');
  const [customLevel, setCustomLevel] = useState(60);
  const fillLevel = fillMode === 'full' ? 1 : fillMode === 'half' ? 0.5 : customLevel / 100;
  const requestCamera = useCallback(preset => setCameraRequest({ preset, id: Date.now() }), []);

  return (
    <>
      <SceneView result={result} mode={mode} selectedPoint={selectedPoint}
        onSelectPoint={setSelectedPoint} cameraRequest={cameraRequest} showTracers={showTracers} fillLevel={fillLevel} />
      <FillPanel fillMode={fillMode} customLevel={customLevel} onModeChange={setFillMode} onLevelChange={setCustomLevel} />
      <ControlPanel params={params} onChange={updateParam} status={status} />
      <ReadoutPanel r={result} valveOpening={params.valveOpening} />
      <ModePanel mode={mode} onChange={setMode} onCamera={requestCamera}
        showTracers={showTracers} onToggleTracers={setShowTracers} />
      <ProbePanel result={result} point={selectedPoint} onClose={() => setSelectedPoint(null)} />
      <Legend mode={mode} result={result} />
    </>
  );
}
