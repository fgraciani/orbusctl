import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ORBUSCTL_ASCII } from '../assets/logo.js';
import type { AuthState } from '../types.js';
import { getOrgName, formatTokenAge } from '../core/config.js';

interface WelcomeModalProps {
  auth: AuthState;
  onAuthenticated: (token: string) => Promise<void>;
  onSkip: () => void;
  onDismiss: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  auth, onAuthenticated, onSkip, onDismiss,
}) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const needsAuth = auth.status !== 'authenticated';

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError('Token cannot be empty');
      return;
    }
    setValidating(true);
    setError('');
    try {
      await onAuthenticated(token.trim());
    } catch {
      setError('Authentication failed — check your token');
    } finally {
      setValidating(false);
    }
  };

  useInput((input, key) => {
    if (validating) return;

    if (!needsAuth) {
      onDismiss();
      return;
    }

    if (key.escape) {
      onSkip();
      return;
    }

    if (key.return) {
      if (token.length > 0) handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setToken(prev => prev.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setToken(prev => prev + input);
    }
  });

  const tokenAge = formatTokenAge();
  const statusLine = auth.status === 'expired'
    ? `⚠  Session expired — enter a new bearer token${tokenAge ? ` (previous token: ${tokenAge})` : ''}`
    : '   Enter your bearer token to authenticate';

  const tokenDisplay = token.length === 0
    ? <Text dimColor>paste token and press Enter</Text>
    : <Text color="green">{token.slice(0, 20)}…{token.slice(-10)} <Text color="gray" dimColor>({token.length} chars)</Text></Text>;

  return (
    <Box flexDirection="column" width="100%" height="100%" alignItems="center" justifyContent="center">
      <Box flexDirection="column" alignItems="center" borderStyle="round" borderColor="cyan" paddingX={4} paddingY={1}>

        <Box marginBottom={1}>
          <Text color="cyan">{ORBUSCTL_ASCII}</Text>
        </Box>

        <Text color="gray" dimColor>Orbus Administration CLI  ·  {getOrgName()}</Text>

        <Box marginTop={2} flexDirection="column" alignItems="center">
          {needsAuth ? (
            <>
              <Text color={auth.status === 'expired' ? 'yellow' : 'gray'}>{statusLine}</Text>

              {validating ? (
                <Box marginTop={1}>
                  <Text color="cyan">Validating token...</Text>
                </Box>
              ) : (
                <>
                  <Box marginTop={1} gap={1}>
                    <Text color="cyan">Token›</Text>
                    {tokenDisplay}
                  </Box>

                  {error ? (
                    <Text color="red">{error}</Text>
                  ) : (
                    <Box marginTop={1}>
                      <Text dimColor>[Enter] authenticate  [Esc] continue without auth</Text>
                    </Box>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Text color="green">●  Welcome, {auth.user}!</Text>
              <Text color="gray" dimColor>Auth token valid</Text>
              <Box marginTop={1}>
                <Text dimColor>Press any key to enter</Text>
              </Box>
            </>
          )}
        </Box>

      </Box>
    </Box>
  );
};
