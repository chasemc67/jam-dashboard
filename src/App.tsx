import React from 'react';
import styled from 'styled-components';
import FretboardControls from './components/FretboardControls/FretboardControls';
import RandomPlayer from './components/Player/RandomPlayer';
import GamePlayer from './components/Player/GamePlayer';
import './styles/globals.css';

const AppBody = styled.div`
  margin: 20px;
`;

const AppHeader = styled.header`
  display: flex;
  justify-content: center;
`;

const ComponentDivider = styled.div`
  margin: 40px 0;
  border-top: 1px solid #eee;
`;

function App() {
  return (
    <div className="App">
      <AppHeader>
        <h1>Jam Dashboard</h1>
      </AppHeader>
      <AppBody>
        <FretboardControls />
        <ComponentDivider />
        <RandomPlayer />
        <ComponentDivider />
        <GamePlayer />
      </AppBody>
    </div>
  );
}

export default App;
