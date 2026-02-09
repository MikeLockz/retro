import React, { useState, useEffect } from 'react';
import { render, Text, Box } from 'ink';
import { createRetroStore } from '../src/core/createStore.js';
import * as NodePlatform from '../src/core/platform/node.js';
import { getRandomAnimal } from '../src/utils/animals.js';
import { getRandomColor } from '../src/utils/colors.js';

const TuiApp = ({ roomName }) => {
  const [status, setStatus] = useState({ signaling: 'connecting' });
  const [cards, setCards] = useState([]);
  const [store, setStore] = useState(null);

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
      onAlert: (msg) => console.log('ALERT:', msg),
    });

    setStore(newStore);

    const unsubscribe = newStore.connectionStatus.subscribe((s) => {
      setStatus(s);
    });

    const updateCards = () => {
        // Collect all cards for display
        const all = [
            ...newStore.kudosCards.toArray().map(c => ({ ...c, type: 'kudos' })),
            ...newStore.goodCards.toArray().map(c => ({ ...c, type: 'good' })),
            ...newStore.improveCards.toArray().map(c => ({ ...c, type: 'improve' })),
            ...newStore.actionCards.toArray().map(c => ({ ...c, type: 'action' })),
        ];
        setCards(all);
        console.log(`UPDATED CARDS: ${all.length}`);
    };

    newStore.kudosCards.observe(updateCards);
    newStore.goodCards.observe(updateCards);
    newStore.improveCards.observe(updateCards);
    newStore.actionCards.observe(updateCards);

    // Initial load
    updateCards();

    return () => {
      unsubscribe();
      newStore.destroy();
    };
  }, [roomName]);

  return (
    <Box flexDirection="column">
      <Text>Retro TUI - Room: {roomName}</Text>
      <Text>Status: {status.signaling} {status.synced ? '(Synced)' : ''}</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text>Cards: {cards.length}</Text>
        {cards.map(c => (
             <Text key={c.id}>[{c.type}] {c.text || '(Image)'}</Text>
        ))}
      </Box>
    </Box>
  );
};

const room = process.argv[2] || 'default-room';
render(<TuiApp roomName={room} />);
