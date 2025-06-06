import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Utils from './components/Utils/Utils';
import PanelContainer from './components/Panel/PanelContainer';

function Main() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Utils />
      <PanelContainer />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
      </Routes>
    </Router>
  );
}
