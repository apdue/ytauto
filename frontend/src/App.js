import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ProjectDetailNew from './components/ProjectDetailNew';
import CreateProject from './components/CreateProject';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Auto Video Create</h1>
          <p>Automated YouTube Video Generation System</p>
        </header>
        <main className="App-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectDetailNew />} />
            <Route path="/create" element={<CreateProject />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

