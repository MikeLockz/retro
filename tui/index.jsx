import React, { useState, useEffect } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import { createRetroStore } from '../src/core/createStore.js';
import * as NodePlatform from '../src/core/platform/node.js';
import { getRandomAnimal } from '../src/utils/animals.js';
import { getRandomColor } from '../src/utils/colors.js';
import TuiCard from './components/TuiCard.jsx';

const TuiApp = ({ roomName }) => {
  const { exit } = useApp();
  const [status, setStatus] = useState({ signaling: 'connecting' });
  const [cards, setCards] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [store, setStore] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' or 'input'
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const user = {
      id: Math.random().toString(36).substring(2, 15),
      name: getRandomAnimal(),
      color: getRandomColor(),
    };

    const newStore = createRetroStore({
      roomName,
      user,
      platform: NodePlatform,
      onAlert: (msg) => {}, // Suppress for TUI
    });

    setStore(newStore);

    const unsubscribe = newStore.connectionStatus.subscribe((s) => {
      setStatus(s);
    });

    const updateCards = () => {
        const all = [
            ...newStore.kudosCards.toArray().map(c => ({ ...c, type: 'kudos', ref: newStore.kudosCards })),
            ...newStore.goodCards.toArray().map(c => ({ ...c, type: 'good', ref: newStore.goodCards })),
            ...newStore.improveCards.toArray().map(c => ({ ...c, type: 'improve', ref: newStore.improveCards })),
            ...newStore.actionCards.toArray().map(c => ({ ...c, type: 'action', ref: newStore.actionCards })),
        ].sort((a, b) => b.createdAt - a.createdAt);
        setCards(all);
    };

    newStore.kudosCards.observe(updateCards);
    newStore.goodCards.observe(updateCards);
    newStore.improveCards.observe(updateCards);
    newStore.actionCards.observe(updateCards);

    updateCards();

    return () => {
      unsubscribe();
      newStore.destroy();
    };
  }, [roomName]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      exit();
    }

    if (mode === 'view') {
      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        setSelectedIndex(prev => Math.min(cards.length - 1, prev + 1));
      }
      if (input === 'v' && cards[selectedIndex]) {
        const card = cards[selectedIndex];
        store.toggleVote(card.ref, card.id);
      }
      if (input === 'a') {
        setMode('input');
        setInputValue('');
      }
      if (input === 'r') {
          store.reconnect();
      }
    } else if (mode === 'input') {
      if (key.return) {
        if (inputValue.trim()) {
          store.createCard(store.goodCards, inputValue); // Default to 'good' for now
        }
        setMode('view');
      } else if (key.backspace) {
        setInputValue(prev => prev.slice(0, -1));
      } else if (!key.ctrl && !key.meta && !key.alt) {
        setInputValue(prev => prev + input);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={2} marginBottom={1} justifyContent="space-between">
        <Box>
            <Text color="magenta" bold italic> RETRO_SYSTEM </Text>
            <Text color="white"> | Room: </Text>
            <Text color="cyan" bold>{roomName.toUpperCase()}</Text>
        </Box>
        <Box>
            <Text color={status.signaling === 'connected' ? 'green' : 'yellow'}>
                {status.signaling.toUpperCase()}
            </Text>
            {status.synced && <Text color="cyan"> [SYNCED]</Text>}
        </Box>
      </Box>

      {mode === 'input' ? (
        <Box borderStyle="bold" borderColor="magenta" paddingX={1} marginBottom={1}>
          <Text color="white">ADD CARD (ENTER TO SUBMIT): </Text>
          <Text color="cyan">{inputValue}</Text>
          <Text color="cyan" underline> </Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text color="gray">Keys: [a] Add Card | [v] Vote | [r] Reconnect | [↑/↓] Navigate | [Esc] Exit</Text>
        </Box>
      )}

      <Box flexDirection="column">
        {cards.length === 0 ? (
          <Text color="gray" italic>No data streams detected...</Text>
        ) : (
          cards.map((c, i) => (
            <TuiCard key={c.id} card={c} isSelected={i === selectedIndex && mode === 'view'} />
          ))
        )}
      </Box>
    </Box>
  );
};

const room = process.argv[2] || 'default-room';
render(<TuiApp roomName={room} />);