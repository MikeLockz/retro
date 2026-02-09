import React, { useState, useEffect } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import 'dotenv/config';
import { createRetroStore } from '../src/core/createStore.js';
import * as NodePlatform from '../src/core/platform/node.js';
import { getRandomAnimal } from '../src/utils/animals.js';
import { getRandomColor } from '../src/utils/colors.js';
import TuiCard from './components/TuiCard.jsx';

const TuiApp = ({ roomName }) => {
  const { exit } = useApp();
  const [status, setStatus] = useState({ signaling: 'connecting' });
  const [peerCount, setPeerCount] = useState(0);
  const [timerState, setTimerState] = useState({ active: false, remaining: 0 });
  const [cards, setCards] = useState([]);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [store, setStore] = useState(null);
  const [mode, setMode] = useState('view'); // 'view', 'input', 'edit'
  const [inputValue, setInputValue] = useState('');
  const [editingCardId, setEditingCardId] = useState(null);

  const columns = [
    { key: 'kudos', label: 'Kudos 💖', color: 'magenta' },
    { key: 'good', label: 'Good 🎉', color: 'green' },
    { key: 'improve', label: 'Improve 🔧', color: 'yellow' },
    { key: 'action', label: 'Actions 🚀', color: 'cyan' }
  ];

  useEffect(() => {
    // ... (keep user setup)
    const user = {
      id: Math.random().toString(36).substring(2, 15),
      name: getRandomAnimal(),
      color: getRandomColor(),
    };

    const newStore = createRetroStore({
      roomName,
      user,
      platform: NodePlatform,
      onAlert: (msg) => {}, 
      signalingUrl: process.env.VITE_SIGNALING_URL
    });

    setStore(newStore);

    const unsubscribe = newStore.connectionStatus.subscribe((s) => {
      setStatus(s);
    });

    const updatePeerCount = () => {
        setPeerCount(newStore.awareness.getStates().size);
    };

    newStore.awareness.on('change', updatePeerCount);
    updatePeerCount();

    const updateTimer = () => {
        const startedAt = newStore.timer.get('startedAt');
        const duration = newStore.timer.get('duration');
        if (startedAt && duration) {
            const remaining = Math.max(0, (startedAt + duration) - Date.now());
            setTimerState({ active: true, remaining });
        } else {
            setTimerState({ active: false, remaining: 0 });
        }
    };

    newStore.timer.observe(updateTimer);
    const timerInterval = setInterval(updateTimer, 1000);
    updateTimer();

    const updateCards = () => {
        const getCards = (arr, type, ref) => arr.toArray().map(c => ({ ...c, type, ref }));
        const newCards = {
            kudos: getCards(newStore.kudosCards, 'kudos', newStore.kudosCards),
            good: getCards(newStore.goodCards, 'good', newStore.goodCards),
            improve: getCards(newStore.improveCards, 'improve', newStore.improveCards),
            action: getCards(newStore.actionCards, 'action', newStore.actionCards),
        };
        setCards(newCards);
    };

    newStore.kudosCards.observe(updateCards);
    newStore.goodCards.observe(updateCards);
    newStore.improveCards.observe(updateCards);
    newStore.actionCards.observe(updateCards);

    updateCards();

    return () => {
      clearInterval(timerInterval);
      unsubscribe();
      newStore.destroy();
    };
  }, [roomName]);

  const currentColumn = columns[selectedColumnIndex];
  const columnCards = cards[currentColumn?.key] || [];

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      exit();
    }

    if (mode === 'view') {
      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        setSelectedIndex(prev => Math.min(columnCards.length - 1, prev + 1));
      }
      if (key.leftArrow) {
        setSelectedColumnIndex(prev => Math.max(0, prev - 1));
        setSelectedIndex(0);
      }
      if (key.rightArrow) {
        setSelectedColumnIndex(prev => Math.min(columns.length - 1, prev + 1));
        setSelectedIndex(0);
      }
      if (input === 'v' && columnCards[selectedIndex]) {
        const card = columnCards[selectedIndex];
        store.toggleVote(card.ref, card.id);
      }
      if (input === 'a') {
        setMode('input');
        setInputValue('');
      }
      if (input === 'e' && columnCards[selectedIndex]) {
        const card = columnCards[selectedIndex];
        setMode('edit');
        setEditingCardId(card.id);
        setInputValue(card.text || '');
      }
      if (input === 'd' && columnCards[selectedIndex]) {
        const card = columnCards[selectedIndex];
        store.deleteCard(card.ref, card.id);
      }
      if (input === 'r') {
          store.reconnect();
      }
      if (input === 't') {
          store.startTimer();
      }
      if (input === 'x') {
          store.stopTimer();
      }
      if (input === 'c') {
          store.clearBoard();
      }
    } else if (mode === 'input' || mode === 'edit') {
      if (key.return) {
        if (inputValue.trim()) {
          if (mode === 'input') {
            const ref = store[`${currentColumn.key}Cards`];
            store.createCard(ref, inputValue);
          } else {
            const ref = store[`${currentColumn.key}Cards`];
            store.updateCard(ref, editingCardId, { text: inputValue });
            store.commitCard(ref, editingCardId);
          }
        }
        setMode('view');
        setEditingCardId(null);
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
            {timerState.active && (
                <Box marginRight={2}>
                    <Text color="yellow" bold> ⏱ {Math.floor(timerState.remaining / 60000)}:{(Math.floor(timerState.remaining / 1000) % 60).toString().padStart(2, '0')} </Text>
                </Box>
            )}
            <Text color={status.signaling === 'connected' ? 'green' : 'yellow'}>
                {status.signaling.toUpperCase()}
            </Text>
            <Text color="white"> | Peers: </Text>
            <Text color="cyan">{peerCount}</Text>
            {status.synced && <Text color="cyan"> [SYNCED]</Text>}
        </Box>
      </Box>

      <Box marginBottom={1}>
        {columns.map((col, i) => (
            <Box key={col.key} marginRight={2} borderStyle={i === selectedColumnIndex ? 'bold' : 'single'} borderColor={i === selectedColumnIndex ? col.color : 'gray'} paddingX={1}>
                <Text color={i === selectedColumnIndex ? col.color : 'white'} bold={i === selectedColumnIndex}>
                    {col.label} ({cards[col.key]?.length || 0})
                </Text>
            </Box>
        ))}
      </Box>

      {mode === 'input' || mode === 'edit' ? (
        <Box borderStyle="bold" borderColor="magenta" paddingX={1} marginBottom={1}>
          <Text color="white">{mode === 'input' ? 'ADD TO' : 'EDIT IN'} {currentColumn.label.toUpperCase()} (ENTER TO SUBMIT): </Text>
          <Text color="cyan">{inputValue}</Text>
          <Text color="cyan" underline> </Text>
        </Box>
      ) : (
        <Box marginBottom={1} flexDirection="column">
          <Text color="gray">Keys: [a] Add | [e] Edit | [d] Delete | [v] Vote | [r] Reconnect | [c] Clear Board</Text>
          <Text color="gray">      [t] Start Timer | [x] Stop Timer | [←/→] Column | [↑/↓] Navigate | [Esc] Exit</Text>
        </Box>
      )}

      <Box flexDirection="column">
        {columnCards.length === 0 ? (
          <Text color="gray" italic>No data streams in this sector...</Text>
        ) : (
          columnCards.map((c, i) => (
            <TuiCard key={c.id} card={c} isSelected={i === selectedIndex && mode === 'view'} />
          ))
        )}
      </Box>
    </Box>
  );
};

const room = process.argv[2] || 'default-room';
render(<TuiApp roomName={room} />);