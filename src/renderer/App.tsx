import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { Toaster } from 'react-hot-toast';
import Utils from './components/Utils/Utils';
import PanelContainer from './components/Panel/PanelContainer';
import Tabs from './components/Tabs/Tabs';
import { GitProvider } from './ContextManager/GitContext';
import AuthPanel from './components/AuthPanel/AuthPanel';

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
    <>
      <div>
        <Toaster position="bottom-center" />
      </div>
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
          <Route
            path="/settings"
            element={
              <GitProvider>
                <AuthPanel />
              </GitProvider>
            }
          />
        </Routes>
      </Router>
    </>
  );
}
