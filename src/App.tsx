import React from 'react';
import styled from 'styled-components';
import FretboardControls from './components/FretboardControls/FretboardControls';

const AppBody = styled.div`
  margin: 20px;
`;

const AppHeader = styled.header`
  display: flex;
  justify-content: center;
`;

const HelloWorld = styled.p`
  font-size: 18px;
  text-align: center;
  color: #333;
`;

function App() {
  return (
    <div className="App">
      <AppHeader>
        <h1>Jam Dashboard</h1>
        <HelloWorld>Hello World</HelloWorld>
      </AppHeader>
      <AppBody>
        <FretboardControls />
      </AppBody>
    </div>
  );
}

export default App;
