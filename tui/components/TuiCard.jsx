import React from 'react';
import { Text, Box } from 'ink';

const TuiCard = ({ card, isSelected }) => {
  const columnColors = {
    kudos: 'magenta',
    good: 'green',
    improve: 'yellow',
    action: 'cyan'
  };

  const color = columnColors[card.type] || 'white';
  const borderColor = isSelected ? 'white' : color;

  return (
    <Box 
      borderStyle="round" 
      borderColor={borderColor} 
      paddingX={1} 
      flexDirection="column"
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text color={color} bold>{card.type.toUpperCase()}</Text>
        <Text color="gray">{new Date(card.createdAt).toLocaleTimeString()}</Text>
      </Box>
      <Text>{card.text || '(No text)'}</Text>
      <Box marginTop={1}>
        <Text color="yellow">👍 {card.votes || 0}</Text>
        {card.reactions && Object.keys(card.reactions).length > 0 && (
            <Text color="gray"> +{Object.keys(card.reactions).length} others</Text>
        )}
      </Box>
    </Box>
  );
};

export default TuiCard;
