import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Utils from './components/Utils/Utils';
import PanelContainer from './components/Panel/PanelContainer';
import Tabs from './components/Tabs/Tabs';
import { GitProvider } from './ContextManager/GitContext';

function Main() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Utils />
      <Tabs />
      <PanelContainer />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <GitProvider>
              <Main />
            </GitProvider>
          }
        />
      </Routes>
    </Router>
  );
}
